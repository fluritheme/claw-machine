import {
  Body,
  Box,
  Sphere,
  Vec3,
  World,
  Material,
  ContactMaterial,
  PointToPointConstraint,
} from "cannon-es";
import { clamp } from "./config.js";
import type { Config, Phase, Prize, ClawEvent } from "./types.js";
export interface Toy {
  key: number;
  prize: Prize;
  body: Body;
  radius: number;
  won: boolean;
}
const durations: Record<Exclude<Phase, "aiming">, number> = {
  lowering: 1.15,
  closing: 0.65,
  lifting: 1.5,
  carrying: 1.3,
  releasing: 0.65,
  returning: 0.85,
};
const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export class Simulation {
  world = new World({ gravity: new Vec3(0, -9.8, 0), allowSleep: true });
  toys: Toy[] = [];
  palm = new Body({ type: Body.KINEMATIC });
  phase: Phase = "aiming";
  time = 0;
  elapsed = 0;
  attempts = 0;
  wins = 0;
  aim = { x: 0, z: 0 };
  claw = { x: 0, y: 4.12, z: 0, open: 1 };
  held: Toy | undefined;
  private joint: PointToPointConstraint | undefined;
  private candidate: Toy | undefined;
  private start = { x: 0, y: 4.12, z: 0 };
  private bottom = 1.65;
  private quality = 0;
  private serial = 0;
  private restock = 0;
  private gate: Body;
  private delivery: Toy | undefined;
  private fingers: Body[] = [];
  constructor(
    public config: Config,
    private emit: (event: ClawEvent) => void,
  ) {
    const surface = new Material("plush");
    this.world.defaultContactMaterial.friction = 0.48;
    this.world.addContactMaterial(
      new ContactMaterial(surface, surface, {
        friction: 0.5,
        restitution: 0.16,
      }),
    );
    this.box(0, 1.1, -0.3, 1.65, 0.12, 0.75);
    this.box(0.4, 1.1, 0.78, 1.25, 0.12, 0.33);
    this.gate = this.box(-1.25, 1.1, 0.78, 0.4, 0.12, 0.33);
    // A guarded delivery well keeps idle toys out of the chute.
    this.box(-0.79, 1.45, 0.8, 0.05, 0.25, 0.34);
    this.box(-1.25, 1.45, 0.4, 0.4, 0.25, 0.05);
    this.box(-1.6, 2.5, 0, 0.08, 1.6, 1.15);
    this.box(1.6, 2.5, 0, 0.08, 1.6, 1.15);
    this.box(0, 2.5, -1.12, 1.65, 1.6, 0.08);
    this.box(0, 2.5, 1.12, 1.65, 1.6, 0.08);
    this.world.addBody(this.palm);
    for (let i = 0; i < 3; i++) {
      const finger = new Body({
        type: Body.KINEMATIC,
        shape: new Sphere(0.075),
      });
      this.world.addBody(finger);
      this.fingers.push(finger);
    }
    this.populate();
    for (let i = 0; i < 150; i++) this.world.step(1 / 60);
  }
  private box(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
  ) {
    const b = new Body({ shape: new Box(new Vec3(hx, hy, hz)) });
    b.position.set(x, y, z);
    this.world.addBody(b);
    return b;
  }
  private populate() {
    for (let i = 0; i < this.config.prizeCount; i++) this.addToy(i);
  }
  private addToy(i: number) {
    const prize = this.config.prizes[i % this.config.prizes.length]!;
    const radius = 0.245 + ((i * 7) % 5) * 0.012;
    const body = new Body({
      mass: 0.32,
      shape: new Sphere(radius),
      linearDamping: 0.35,
      angularDamping: 0.8,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 0.5,
    });
    const col = i % 4,
      row = Math.floor(i / 4) % 3,
      layer = Math.floor(i / 12);
    body.position.set(
      -1.12 + col * 0.73,
      1.65 + layer * 0.6 + (i % 3) * 0.07,
      -0.76 + row * 0.65,
    );
    // The delivery corner starts clear; the rest of the floor contains playable prizes.
    if (body.position.x < -0.85 && body.position.z > 0.4) body.position.z = 0.1;
    body.quaternion.setFromEuler(0, ((i % 5) - 2) * 0.17, ((i % 3) - 1) * 0.16);
    this.world.addBody(body);
    this.toys.push({ key: ++this.serial, prize, body, radius, won: false });
  }
  move(x: number, z: number) {
    if (this.phase !== "aiming") return;
    this.aim.x = clamp(x, -1, 1);
    this.aim.z = clamp(z, -1, 1);
  }
  grab() {
    if (this.phase !== "aiming") return false;
    this.attempts++;
    this.candidate = this.toys
      .filter(
        (t) =>
          !t.won &&
          Math.hypot(
            t.body.position.x - this.claw.x,
            t.body.position.z - this.claw.z,
          ) < 0.46,
      )
      .sort((a, b) => b.body.position.y - a.body.position.y)[0];
    this.bottom = this.candidate
      ? clamp(this.candidate.body.position.y + 0.42, 1.65, 3.5)
      : 1.65;
    this.setPhase("lowering");
    return true;
  }
  private setPhase(phase: Phase) {
    this.phase = phase;
    this.elapsed = 0;
    this.start = { x: this.claw.x, y: this.claw.y, z: this.claw.z };
    this.emit({ type: "phase", phase });
  }
  private detach() {
    if (this.joint) this.world.removeConstraint(this.joint);
    this.joint = undefined;
    this.held = undefined;
  }
  private grip() {
    const candidates = this.toys
      .filter(
        (t) =>
          !t.won && Math.abs(t.body.position.y - (this.claw.y - 0.4)) < 0.42,
      )
      .sort(
        (a, b) =>
          Math.hypot(
            a.body.position.x - this.claw.x,
            a.body.position.z - this.claw.z,
          ) -
          Math.hypot(
            b.body.position.x - this.claw.x,
            b.body.position.z - this.claw.z,
          ),
      );
    const toy = candidates[0];
    if (!toy) return;
    const distance = Math.hypot(
      toy.body.position.x - this.claw.x,
      toy.body.position.z - this.claw.z,
    );
    this.quality = 1 - distance / (toy.radius * 1.5);
    const minimum = this.config.difficulty === "relaxed" ? -0.05 : 0.2;
    if (this.quality < minimum) return;
    this.held = toy;
    toy.body.wakeUp();
    const local = new Vec3(0, toy.radius * 0.65, 0);
    this.joint = new PointToPointConstraint(
      this.palm,
      new Vec3(0, -0.24, 0),
      toy.body,
      local,
      36,
    );
    this.world.addConstraint(this.joint);
    this.emit({ type: "grab", phase: this.phase, prize: toy.prize });
  }
  step(dt: number) {
    dt = clamp(dt, 0, 1 / 20);
    this.time += dt;
    this.elapsed += dt;
    const c = this.claw;
    if (this.phase === "aiming") {
      const t = 1 - Math.exp(-dt * 12);
      c.x += (this.aim.x * 1.25 - c.x) * t;
      c.z += (this.aim.z * 0.78 - c.z) * t;
      c.y = 4.12;
      c.open = 1;
    } else {
      const u = clamp(this.elapsed / durations[this.phase], 0, 1),
        s = smooth(u);
      if (this.phase === "lowering") {
        c.y = this.start.y + (this.bottom - this.start.y) * s;
        c.open = 1;
      }
      if (this.phase === "closing") {
        c.open = 1 - s;
        if (u >= 1) this.grip();
      }
      if (this.phase === "lifting") {
        c.y = this.start.y + (4.12 - this.start.y) * s;
        if (
          this.held &&
          this.quality <
            (this.config.difficulty === "challenging" ? 0.48 : 0.12) &&
          u > 0.42
        ) {
          const prize = this.held.prize;
          this.detach();
          this.emit({ type: "slip", phase: this.phase, prize });
        }
      }
      if (this.phase === "carrying") {
        c.x = this.start.x + (-1.25 - this.start.x) * s;
        c.z = this.start.z + (0.79 - this.start.z) * s;
      }
      if (this.phase === "releasing") {
        c.open = s;
        if (this.held && u > 0.22) {
          this.delivery = this.held;
          this.gate.collisionFilterMask = 0;
          this.held.body.velocity.set(0, -0.3, 0);
          this.detach();
        }
      }
      if (this.phase === "returning") {
        c.x = this.start.x * (1 - s);
        c.z = this.start.z * (1 - s);
        c.open = 1;
      }
      if (u >= 1) {
        const next: Record<Exclude<Phase, "aiming">, Phase> = {
          lowering: "closing",
          closing: "lifting",
          lifting: "carrying",
          carrying: "releasing",
          releasing: "returning",
          returning: "aiming",
        };
        if (this.phase === "lifting" && !this.held) this.setPhase("returning");
        else this.setPhase(next[this.phase]);
      }
    }
    const old = this.palm.position.clone();
    this.palm.position.set(c.x, c.y, c.z);
    this.palm.velocity.set(
      (c.x - old.x) / Math.max(dt, 0.001),
      (c.y - old.y) / Math.max(dt, 0.001),
      (c.z - old.z) / Math.max(dt, 0.001),
    );
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3,
        spread = 0.17 + c.open * 0.3;
      const f = this.fingers[i]!;
      const target = new Vec3(
        c.x + Math.cos(a) * spread,
        c.y - 0.48,
        c.z + Math.sin(a) * spread,
      );
      f.velocity.set(
        (target.x - f.position.x) / Math.max(dt, 0.001),
        (target.y - f.position.y) / Math.max(dt, 0.001),
        (target.z - f.position.z) / Math.max(dt, 0.001),
      );
      f.position.copy(target);
    }
    this.world.step(1 / 60, dt, 3);
    for (const toy of this.toys) {
      if (toy.won) continue;
      if (toy.body.position.y < 0.8) {
        if (toy !== this.delivery) {
          toy.body.position.set(0, 1.7, 0);
          toy.body.velocity.setZero();
          continue;
        }
        toy.won = true;
        this.world.removeBody(toy.body);
        this.wins++;
        this.delivery = undefined;
        this.gate.collisionFilterMask = -1;
        this.emit({ type: "win", phase: this.phase, prize: toy.prize });
        this.restock = this.time + 1.8;
      }
    }
    if (this.restock && this.time > this.restock && this.phase === "aiming") {
      for (const t of this.toys.filter((t) => t.won)) this.addToy(t.key + 3);
      this.toys = this.toys.filter((t) => !t.won);
      this.restock = 0;
    }
  }
  shuffle() {
    if (this.phase !== "aiming") return;
    for (const t of this.toys) {
      t.body.wakeUp();
      t.body.applyImpulse(
        new Vec3(
          (Math.random() - 0.5) * 0.35,
          0.25 + Math.random() * 0.25,
          (Math.random() - 0.5) * 0.25,
        ),
      );
    }
  }
  reset() {
    this.detach();
    this.delivery = undefined;
    this.gate.collisionFilterMask = -1;
    for (const t of this.toys) this.world.removeBody(t.body);
    this.toys = [];
    this.aim = { x: 0, z: 0 };
    this.claw = { x: 0, y: 4.12, z: 0, open: 1 };
    this.attempts = 0;
    this.wins = 0;
    this.restock = 0;
    this.populate();
    for (let i = 0; i < 120; i++) this.world.step(1 / 60);
    this.setPhase("aiming");
    this.emit({ type: "reset", phase: this.phase });
  }
  destroy() {
    this.detach();
    for (const body of [...this.world.bodies]) this.world.removeBody(body);
    this.toys = [];
  }
}
