import type { Config } from "./types.js";
import type { Simulation } from "./simulation.js";
/** Software renderer: the same physics and controls work when WebGL is unavailable. */
export class FlatScene {
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  constructor(
    public canvas: HTMLCanvasElement,
    public config: Config,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas is unavailable");
    this.ctx = ctx;
  }
  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    const d = Math.min(devicePixelRatio || 1, this.config.maxDPR);
    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  render(sim: Simulation) {
    const c = this.ctx,
      w = this.w,
      h = this.h,
      scale = Math.min(w / 5.6, h / 5.9),
      cx = w / 2 + 20,
      base = h - 20;
    const p = (x: number, y: number, z = 0) => ({
      x: cx + x * scale + z * scale * 0.25,
      y: base - y * scale - z * scale * 0.12,
    });
    c.clearRect(0, 0, w, h);
    c.save();
    c.lineJoin = "round";
    const box = (
      x: number,
      y: number,
      ww: number,
      hh: number,
      color: string,
    ) => {
      const q = p(x, y);
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(
        q.x - (ww * scale) / 2,
        q.y - (hh * scale) / 2,
        ww * scale,
        hh * scale,
        12,
      );
      c.fill();
    };
    box(0, 2.75, 3.5, 3.6, "#fff2dc");
    box(0, 0.65, 3.65, 1.3, this.config.accent);
    box(0, 4.65, 3.7, 0.65, this.config.accent);
    c.textAlign = "center";
    c.fillStyle = "#fff4df";
    c.font = `900 ${scale * 0.25}px Arial`;
    c.fillText(this.config.title, p(0, 4.6).x, p(0, 4.6).y);
    for (const x of [-1.72, 1.72]) box(x, 2.85, 0.12, 3.2, this.config.accent);
    box(-1.12, 0.65, 0.9, 0.43, "#29252d");
    for (const toy of [...sim.toys].sort(
      (a, b) => a.body.position.z - b.body.position.z,
    )) {
      if (toy.won) continue;
      const q = p(
          toy.body.position.x,
          toy.body.position.y,
          toy.body.position.z,
        ),
        r = toy.radius * scale;
      c.fillStyle = toy.prize.color ?? "#deb172";
      c.beginPath();
      c.arc(q.x, q.y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#29252d";
      for (const sign of [-1, 1]) {
        c.beginPath();
        c.ellipse(
          q.x + sign * r * 0.3,
          q.y - r * 0.05,
          r * 0.09,
          r * 0.15,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    const a = p(sim.claw.x, 4.25, sim.claw.z),
      b = p(sim.claw.x, sim.claw.y, sim.claw.z);
    c.strokeStyle = "#514d4c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.strokeStyle = "#a2a5ac";
    c.lineWidth = 7;
    for (const sign of [-1, 1]) {
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.lineTo(
        b.x + sign * (0.14 + sim.claw.open * 0.2) * scale,
        b.y + 0.28 * scale,
      );
      c.lineTo(
        b.x + sign * (0.08 + sim.claw.open * 0.23) * scale,
        b.y + 0.48 * scale,
      );
      c.stroke();
    }
    c.restore();
  }
  aimAt(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (x - r.left - r.width / 2) / (r.width * 0.3),
      z: (y - r.top - r.height * 0.65) / (r.height * 0.2),
    };
  }
  recolor(config: Config) {
    this.config = config;
  }
  destroy() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }
}
