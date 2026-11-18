import { normalize, clamp, collectibles } from "./config.js";
import { Simulation } from "./simulation.js";
import { CabinetScene } from "./scene.js";
import { FlatScene } from "./fallback.js";
import { styles } from "./styles.js";
import { portrait } from "./avatars.js";
import type {
  ClawOptions,
  ClawController,
  ClawState,
  ClawEvent,
  Config,
  Prize,
} from "./types.js";
export type * from "./types.js";
export { collectibles };
const messages: Record<string, string> = {
  aiming: "Pick your little favourite. Line up the claw.",
  lowering: "Going down. Fingers crossed.",
  closing: "A little closer…",
  lifting: "Easy does it. Hold on, little friend.",
  carrying: "Special delivery, coming through.",
  releasing: "Something good is on its way.",
  returning: "Another little chance.",
};
function inert(): ClawController {
  return {
    move() {},
    grab: () => false,
    shuffle() {},
    reset() {},
    pause() {},
    resume() {},
    open() {},
    close() {},
    update: normalize,
    getState: () => ({
      phase: "aiming",
      paused: true,
      ready: false,
      aim: { x: 0, z: 0 },
      claw: { x: 0, y: 4.12, z: 0 },
      heldPrize: null,
      collection: [],
      attempts: 0,
      wins: 0,
      prizes: [],
    }),
    on: () => () => {},
    destroy() {},
  };
}
/** Create a local, activation-free machine. Browser-only rendering is deferred until called. */
export function createClawMachine(options: ClawOptions = {}): ClawController {
  const config = normalize(options);
  if (typeof document === "undefined") return inert();
  return new Machine(config);
}
class Machine implements ClawController {
  private config: Config;
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private shell: HTMLElement;
  private canvas: HTMLCanvasElement;
  private stage: HTMLElement;
  private grabButton: HTMLButtonElement;
  private status: HTMLElement;
  private count: HTMLElement;
  private collectionEl: HTMLElement;
  private win: HTMLElement;
  private launcher: HTMLButtonElement;
  private dialog: HTMLElement;
  private sim: Simulation;
  private scene: CabinetScene | FlatScene | undefined;
  private listeners = new Set<(event: ClawEvent) => void>();
  private cleanups: (() => void)[] = [];
  private collection = new Set<string>();
  private destroyed = false;
  private manuallyPaused = false;
  private visible = true;
  private ready = false;
  private opened = false;
  private raf = 0;
  private last = 0;
  private frameTime = 0;
  private keys = new Set<string>();
  private observer: IntersectionObserver | undefined;
  private resize: ResizeObserver;
  private media: MediaQueryList;
  private activeButton: string | undefined;
  private audio: AudioContext | undefined;
  private previousFocus: HTMLElement | null = null;
  constructor(config: Config) {
    this.config = config;
    let target: HTMLElement | null;
    try {
      target =
        typeof config.container === "string"
          ? document.querySelector(config.container)
          : (config.container ?? document.body);
    } catch {
      throw new TypeError("Invalid container selector");
    }
    if (!target) throw new TypeError("Claw Machine container was not found");
    this.host = document.createElement("div");
    this.host.dataset.fluriClaw = "";
    this.host.style.setProperty("--red", config.accent);
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.shadow.innerHTML = `<style>${styles}</style><button class="launcher" type="button" hidden>✦ A little luck</button><div class="dialog" hidden><section class="shell" aria-label="Claw Machine"><header class="top"><span class="eyebrow live">Fluri arcade / No. 01</span><span class="counter">0 grabs · 0 friends</span><button class="close" type="button" aria-label="Close claw machine" hidden>×</button></header><div class="stage"><div class="stage-copy"><span class="eyebrow">YOUR DAILY DOSE OF</span><h2>A little<br>luck.</h2><p>Six little friends.<br>One good feeling.</p></div><span class="edition">SMALL PRIZES. BIG PERSONALITY.</span><canvas aria-label="Interactive claw machine. Use arrow keys or WASD to aim, then Space or the Grab button." tabindex="0"></canvas><div class="loading" role="status">Warming up the arcade…</div></div><div class="status" role="status" aria-live="polite"></div><div class="controls"><div class="pad" role="group" aria-label="Move the claw"><button type="button" data-move="up" aria-label="Move backward">↑</button><button type="button" data-move="left" aria-label="Move left">←</button><button type="button" data-move="down" aria-label="Move forward">↓</button><button type="button" data-move="right" aria-label="Move right">→</button></div><button class="grab" type="button">GRAB A FRIEND ↘</button><div><button class="minor" data-shuffle type="button">Mix it up</button><br><button class="minor sound" type="button" aria-pressed="false">Sound off</button></div></div><p class="help">ARROWS / WASD TO AIM · SPACE TO GRAB · OR USE THE BUTTONS</p><section class="shelf" aria-label="Your collection"><div class="shelf-head"><span>YOUR LITTLE COLLECTION</span><span data-collection-count>0 / 6</span></div><div class="collection"></div></section><div class="win" hidden><section class="ticket" role="dialog" aria-modal="true" aria-labelledby="prize-name"><span class="eyebrow">ONE LITTLE FRIEND, FOUND.</span><div class="prize-icon"></div><h3 id="prize-name"></h3><p data-prize-message></p><a data-prize-link target="_blank" rel="noopener noreferrer" hidden>Explore your prize ↗</a><button class="grab" data-again type="button">ONE MORE GO ↗</button></section></div></section></div>`;
    const get = <T extends HTMLElement>(s: string) =>
      this.shadow.querySelector<T>(s)!;
    this.shell = get(".shell");
    this.canvas = get("canvas");
    this.stage = get(".stage");
    this.grabButton = get(".grab");
    this.status = get(".status");
    this.count = get(".counter");
    this.collectionEl = get(".collection");
    this.win = get(".win");
    this.launcher = get(".launcher");
    this.dialog = get(".dialog");
    if (config.placement === "embedded") {
      this.dialog.replaceWith(this.shell);
      this.opened = true;
      target.append(this.host);
    } else {
      this.host.style.position = "relative";
      this.host.style.zIndex = String(config.zIndex);
      document.body.append(this.host);
      this.launcher.hidden = false;
      get(".close").hidden = false;
      this.dialog.setAttribute("role", "dialog");
      this.dialog.setAttribute("aria-modal", "true");
      this.dialog.setAttribute("aria-label", "Fluri claw machine");
    }
    this.media = matchMedia("(prefers-reduced-motion: reduce)");
    this.sim = new Simulation(config, (event) => this.handle(event));
    if (config.rememberCollection) this.restore();
    this.renderCollection();
    this.status.textContent = messages.aiming!;
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(this.stage);
    this.onDOM(this.media, "change", () => this.wake());
    this.onDOM(document, "visibilitychange", () => {
      this.keys.clear();
      this.wake();
    });
    this.onDOM(window, "blur", () => {
      this.keys.clear();
      this.activeButton = undefined;
    });
    if (typeof IntersectionObserver !== "undefined") {
      this.observer = new IntersectionObserver(
        (entries) => {
          this.visible = entries[0]?.isIntersecting ?? true;
          this.wake();
        },
        { rootMargin: "100px" },
      );
      this.observer.observe(this.host);
    }
    this.onDOM(this.grabButton, "click", () => this.grab());
    this.onDOM(get("[data-shuffle]"), "click", () => this.shuffle());
    this.onDOM(get("[data-again]"), "click", () => {
      this.win.hidden = true;
      this.grabButton.focus();
      this.wake();
    });
    this.onDOM(this.launcher, "click", () => {
      this.open();
      this.previousFocus = this.launcher;
    });
    this.onDOM(get(".close"), "click", () => this.close());
    this.onDOM(this.dialog, "click", (e) => {
      if (e.target === this.dialog) this.close();
    });
    const sound = get<HTMLButtonElement>(".sound");
    sound.setAttribute("aria-pressed", String(config.sound));
    sound.textContent = config.sound ? "Sound on" : "Sound off";
    this.onDOM(sound, "click", () => {
      this.config.sound = !this.config.sound;
      sound.setAttribute("aria-pressed", String(this.config.sound));
      sound.textContent = this.config.sound ? "Sound on" : "Sound off";
      if (this.config.sound) this.chime(false);
    });
    this.onDOM(this.shadow, "keydown", (event) =>
      this.key(event as KeyboardEvent, true),
    );
    this.onDOM(this.shadow, "keyup", (event) =>
      this.key(event as KeyboardEvent, false),
    );
    this.onDOM(this.shadow, "focusout", () => {
      this.keys.clear();
      this.activeButton = undefined;
    });
    for (const button of this.shadow.querySelectorAll<HTMLButtonElement>(
      "[data-move]",
    )) {
      this.onDOM(button, "pointerdown", (event) => {
        const e = event as PointerEvent;
        if (!e.isPrimary || e.button !== 0) return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        this.activeButton = button.dataset.move;
        this.nudge(button.dataset.move!, 0.06);
        this.wake();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        this.onDOM(button, event, () => {
          this.activeButton = undefined;
        });
      this.onDOM(button, "click", (event) => {
        if ((event as MouseEvent).detail === 0) {
          this.nudge(button.dataset.move!, 0.16);
          this.wake();
        }
      });
    }
    let dragging = false;
    this.onDOM(this.stage, "pointerdown", (event) => {
      if (event.target !== this.canvas) return;
      const e = event as PointerEvent;
      if (e.pointerType === "touch" || e.button !== 0) return;
      dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.focus();
      this.aim(e);
    });
    this.onDOM(this.stage, "pointermove", (event) => {
      if (dragging) this.aim(event as PointerEvent);
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      this.onDOM(this.stage, event, () => {
        dragging = false;
      });
    this.onDOM(this.canvas, "webglcontextlost", (event) => {
      event.preventDefault();
      this.manuallyPaused = true;
      this.status.textContent =
        "Graphics paused. Use Start again to rebuild the machine.";
      this.emit({
        type: "error",
        phase: this.sim.phase,
        message: "WebGL context lost",
      });
    });
    if (this.opened) this.initialize();
  }
  private onDOM(target: EventTarget, name: string, fn: (event: Event) => void) {
    target.addEventListener(name, fn);
    this.cleanups.push(() => target.removeEventListener(name, fn));
  }
  private initialize() {
    if (this.destroyed || this.ready) return;
    try {
      this.scene = new CabinetScene(this.canvas, this.config);
    } catch {
      const replacement = this.canvas.cloneNode() as HTMLCanvasElement;
      this.canvas.replaceWith(replacement);
      this.canvas = replacement;
      try {
        this.scene = new FlatScene(this.canvas, this.config);
        this.status.textContent =
          "Software graphics mode. The same prizes and physics, ready to play.";
      } catch {
        this.shadow.querySelector(".loading")!.textContent =
          "Your browser could not start the arcade. Try a browser with Canvas support.";
        return;
      }
    }
    this.ready = true;
    (this.shadow.querySelector(".loading") as HTMLElement).hidden = true;
    this.size();
    this.emit({ type: "ready", phase: this.sim.phase });
    this.wake();
  }
  private size() {
    if (!this.scene || !this.opened) return;
    const r = this.stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      this.scene.resize(r.width, r.height);
      this.scene.render(this.sim, false);
    }
  }
  private aim(e: PointerEvent) {
    if (!this.win.hidden) return;
    const p = this.scene?.aimAt(e.clientX, e.clientY);
    if (p) this.move(p.x, p.z);
  }
  private key(e: KeyboardEvent, down: boolean) {
    if (e.key === "Escape" && down) {
      if (!this.win.hidden) {
        this.win.hidden = true;
        this.grabButton.focus();
      } else this.close();
      return;
    }
    if (
      e.key === "Tab" &&
      down &&
      (!this.win.hidden ||
        (this.config.placement === "launcher" && this.opened))
    ) {
      const scope = this.win.hidden ? this.shell : this.win,
        items = [
          ...scope.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],canvas[tabindex]",
          ),
        ].filter((el) => el.getBoundingClientRect().width > 0);
      const first = items[0],
        last = items.at(-1),
        active = this.shadow.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (
      ![
        "arrowleft",
        "arrowright",
        "arrowup",
        "arrowdown",
        "w",
        "a",
        "s",
        "d",
        " ",
      ].includes(key)
    )
      return;
    // Never turn Space on a focused button into a second action.
    if ((e.target as HTMLElement).tagName === "BUTTON" && key === " ") return;
    e.preventDefault();
    if (!this.win.hidden) return;
    if (key === " ") {
      if (down && !e.repeat) this.grab();
      return;
    }
    if (down) {
      this.keys.add(key);
      if (!e.repeat)
        this.nudge(
          (
            {
              arrowleft: "left",
              a: "left",
              arrowright: "right",
              d: "right",
              arrowup: "up",
              w: "up",
              arrowdown: "down",
              s: "down",
            } as Record<string, string>
          )[key]!,
          0.06,
        );
    } else this.keys.delete(key);
    this.wake();
  }
  private nudge(direction: string, amount: number) {
    const a = this.sim.aim;
    this.sim.move(
      a.x +
        (direction === "left" ? -amount : direction === "right" ? amount : 0),
      a.z + (direction === "up" ? -amount : direction === "down" ? amount : 0),
    );
  }
  private wake() {
    if (this.destroyed) return;
    const allowed =
      this.ready &&
      this.opened &&
      (this.visible || this.config.placement === "launcher") &&
      !document.hidden &&
      !this.manuallyPaused &&
      this.win.hidden;
    if (!allowed) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.last = 0;
      return;
    }
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  private frame(t: number) {
    this.raf = 0;
    if (this.destroyed) return;
    const elapsed = this.last ? Math.min(0.25, (t - this.last) / 1000) : 1 / 60;
    this.last = t;
    this.frameTime += elapsed;
    if (this.frameTime >= 1 / this.config.maxFPS) {
      const dt = Math.min(0.25, this.frameTime);
      this.frameTime = 0;
      const mapping: Record<string, string> = {
        arrowleft: "left",
        a: "left",
        arrowright: "right",
        d: "right",
        arrowup: "up",
        w: "up",
        arrowdown: "down",
        s: "down",
      };
      for (const key of this.keys) this.nudge(mapping[key]!, dt * 0.9);
      if (this.activeButton) this.nudge(this.activeButton, dt * 0.9);
      for (let remaining = dt; remaining > 1e-6; remaining -= 1 / 60)
        this.sim.step(Math.min(remaining, 1 / 60));
      this.scene?.render(
        this.sim,
        !(this.media.matches && this.config.reducedMotion === "respect"),
      );
      this.grabButton.disabled = this.sim.phase !== "aiming";
      this.grabButton.textContent =
        this.sim.phase === "aiming" ? "GRAB A FRIEND ↘" : "HOLD TIGHT…";
      this.count.textContent = `${this.sim.attempts} grabs · ${this.sim.wins} friends`;
    }
    this.wake();
  }
  private emit(event: ClawEvent) {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        /* A consumer callback must not stop the machine. */
      }
    }
  }
  private handle(event: ClawEvent) {
    if (event.type === "phase")
      this.status.textContent = messages[event.phase]!;
    if (event.type === "slip")
      this.status.textContent = "Almost! Try lining up a little closer.";
    if (event.type === "win" && event.prize) {
      const prize = { ...event.prize };
      this.collection.add(prize.id);
      this.save();
      this.renderCollection();
      this.chime(true);
      this.win.querySelector(".prize-icon")!.replaceChildren(portrait(prize));
      this.win.querySelector("h3")!.textContent = prize.name;
      this.win.querySelector("[data-prize-message]")!.textContent =
        prize.message ?? "A little friend. All yours.";
      const link =
        this.win.querySelector<HTMLAnchorElement>("[data-prize-link]")!;
      link.hidden = !prize.url;
      if (prize.url) link.href = prize.url;
      else link.removeAttribute("href");
      this.win.hidden = false;
      this.win.querySelector<HTMLButtonElement>("button")!.focus();
      this.wake();
      try {
        this.config.onWin?.(Object.freeze(prize));
      } catch {
        /* External callbacks are isolated. */
      }
    }
    this.emit(event);
  }
  private renderCollection() {
    this.collectionEl.replaceChildren();
    for (const prize of this.config.prizes) {
      const item = document.createElement("span");
      item.className = "slot" + (this.collection.has(prize.id) ? " found" : "");
      item.title =
        prize.name +
        (this.collection.has(prize.id)
          ? " — collected"
          : " — waiting to be found");
      item.setAttribute("aria-label", item.title);
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.append(portrait(prize));
      mark.setAttribute("aria-hidden", "true");
      item.append(mark);
      this.collectionEl.append(item);
    }
    this.shadow.querySelector("[data-collection-count]")!.textContent =
      `${this.config.prizes.filter((p) => this.collection.has(p.id)).length} / ${this.config.prizes.length}`;
  }
  private restore() {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(this.config.storageKey) ?? "[]",
      );
      if (Array.isArray(value))
        for (const id of value.slice(0, 24))
          if (
            typeof id === "string" &&
            this.config.prizes.some((p) => p.id === id)
          )
            this.collection.add(id);
    } catch {
      /* Storage may be disabled. */
    }
  }
  private save() {
    if (!this.config.rememberCollection) return;
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify([...this.collection]),
      );
    } catch {
      /* Storage may be disabled. */
    }
  }
  private chime(won: boolean) {
    if (!this.config.sound) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      for (const [i, f] of (won
        ? [523, 659, 784, 1047]
        : [523, 784]
      ).entries()) {
        const oscillator = this.audio.createOscillator(),
          gain = this.audio.createGain(),
          start = this.audio.currentTime + i * 0.11;
        oscillator.type = "sine";
        oscillator.frequency.value = f;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.04, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        oscillator.connect(gain);
        gain.connect(this.audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.22);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    } catch {
      /* Audio remains optional. */
    }
  }
  move(x: number, z: number) {
    if (this.destroyed || !Number.isFinite(x) || !Number.isFinite(z)) return;
    this.sim.move(clamp(x, -1, 1), clamp(z, -1, 1));
    this.wake();
  }
  grab() {
    if (
      this.destroyed ||
      this.manuallyPaused ||
      !this.ready ||
      !this.opened ||
      !this.win.hidden
    )
      return false;
    this.chime(false);
    const ok = this.sim.grab();
    this.wake();
    return ok;
  }
  shuffle() {
    if (this.destroyed) return;
    this.sim.shuffle();
    this.wake();
  }
  reset() {
    if (this.destroyed) return;
    this.manuallyPaused = false;
    this.win.hidden = true;
    this.sim.reset();
    if (!this.ready) this.initialize();
    this.scene?.render(this.sim, false);
    this.wake();
  }
  pause() {
    this.manuallyPaused = true;
    this.keys.clear();
    this.activeButton = undefined;
    this.wake();
  }
  resume() {
    if (this.destroyed) return;
    this.manuallyPaused = false;
    this.wake();
  }
  open() {
    if (this.destroyed) return;
    this.previousFocus = (this.shadow.activeElement ??
      document.activeElement) as HTMLElement;
    this.opened = true;
    if (this.config.placement === "launcher") {
      this.dialog.hidden = false;
      this.launcher.hidden = true;
    }
    this.initialize();
    this.size();
    this.grabButton.focus();
    this.wake();
  }
  close() {
    if (this.config.placement !== "launcher" || this.destroyed) return;
    this.opened = false;
    this.dialog.hidden = true;
    this.launcher.hidden = false;
    this.keys.clear();
    this.activeButton = undefined;
    this.wake();
    (this.previousFocus?.isConnected
      ? this.previousFocus
      : this.launcher
    ).focus();
  }
  update(options: Partial<ClawOptions>) {
    if (this.destroyed) return;
    const merged = { ...this.config, ...options };
    if (options.preset && options.accent === undefined)
      delete (merged as Partial<Config>).accent;
    const next = normalize(merged);
    if (
      next.container !== this.config.container ||
      next.placement !== this.config.placement
    )
      throw new TypeError(
        "Create a new machine to change container or placement",
      );
    const rebuild =
      JSON.stringify(next.prizes) !== JSON.stringify(this.config.prizes) ||
      next.prizeCount !== this.config.prizeCount ||
      next.title !== this.config.title;
    this.config = next;
    this.host.style.setProperty("--red", next.accent);
    this.sim.config = next;
    if (rebuild) {
      this.scene?.destroy();
      this.scene = undefined;
      this.ready = false;
      this.sim.reset();
      this.initialize();
      this.renderCollection();
    } else this.scene?.recolor(next);
    if (next.rememberCollection) this.save();
    this.wake();
  }
  getState(): ClawState {
    return {
      phase: this.sim.phase,
      paused: this.manuallyPaused,
      ready: this.ready,
      aim: { ...this.sim.aim },
      claw: { x: this.sim.claw.x, y: this.sim.claw.y, z: this.sim.claw.z },
      heldPrize: this.sim.held?.prize.id ?? null,
      collection: [...this.collection],
      attempts: this.sim.attempts,
      wins: this.sim.wins,
      prizes: this.sim.toys
        .filter((t) => !t.won)
        .map((t) => ({
          id: t.prize.id,
          x: t.body.position.x,
          y: t.body.position.y,
          z: t.body.position.z,
        })),
    };
  }
  on(listener: (event: ClawEvent) => void) {
    if (typeof listener !== "function")
      throw new TypeError("Expected an event listener");
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.resize.disconnect();
    for (const dispose of this.cleanups) dispose();
    this.cleanups = [];
    this.scene?.destroy();
    this.sim.destroy();
    void this.audio?.close();
    this.listeners.clear();
    this.host.remove();
    this.previousFocus = null;
  }
}
