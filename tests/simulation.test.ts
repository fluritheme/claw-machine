import { describe, it, expect } from "vitest";
import { normalize, safeURL } from "../src/config.js";
import { Simulation } from "../src/simulation.js";
import type { ClawEvent } from "../src/types.js";
function run(sim: Simulation, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60);
}
describe("real claw physics", () => {
  it("starts with a bounded pile and finite bodies", () => {
    const sim = new Simulation(normalize(), () => {});
    run(sim, 1);
    expect(sim.toys).toHaveLength(16);
    expect(sim.wins).toBe(0);
    for (const t of sim.toys) {
      expect(Number.isFinite(t.body.position.y)).toBe(true);
      expect(t.body.position.y).toBeGreaterThan(1);
    }
    sim.destroy();
    expect(sim.world.bodies).toHaveLength(0);
  });
  it("a centred grab carries a real body into the chute and emits exactly one win", () => {
    const events: ClawEvent[] = [];
    const sim = new Simulation(normalize(), (e) => events.push(e));
    const toy = sim.toys.find(
      (t) => t.body.position.x > 0.3 && t.body.position.z > -0.5,
    )!;
    sim.move(toy.body.position.x / 1.25, toy.body.position.z / 0.78);
    run(sim, 0.8);
    expect(sim.grab()).toBe(true);
    expect(sim.grab()).toBe(false);
    run(sim, 9);
    expect(events.some((e) => e.type === "grab")).toBe(true);
    expect(events.filter((e) => e.type === "win")).toHaveLength(1);
    expect(sim.wins).toBe(1);
    expect(sim.toys).toHaveLength(16);
    sim.destroy();
  });
  it("a miss completes without manufacturing a prize", () => {
    const events: ClawEvent[] = [];
    const sim = new Simulation(normalize({ prizeCount: 6 }), (e) =>
      events.push(e),
    );
    sim.move(-1, 1);
    run(sim, 1);
    sim.grab();
    run(sim, 9);
    expect(sim.phase).toBe("aiming");
    expect(events.filter((e) => e.type === "win")).toHaveLength(0);
    sim.destroy();
  });
  it("reset releases constraints, restores stock and permits a new attempt", () => {
    const sim = new Simulation(normalize(), () => {});
    sim.grab();
    run(sim, 2);
    sim.reset();
    expect(sim.phase).toBe("aiming");
    expect(sim.attempts).toBe(0);
    expect(sim.world.constraints).toHaveLength(0);
    expect(sim.toys).toHaveLength(16);
    sim.destroy();
  });
});
describe("public configuration boundaries", () => {
  it("rejects executable URLs and malformed settings", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,evil",
      "https://user:pass@example.com/x",
    ])
      expect(() => safeURL(url, true)).toThrow();
    expect(() => normalize({ maxFPS: Infinity })).toThrow();
    expect(() =>
      normalize({
        prizes: [
          { id: "a", name: "one" },
          { id: "a", name: "two" },
        ],
      }),
    ).toThrow();
    expect(() =>
      normalize(JSON.parse('{"__proto__":{"admin":true}}')),
    ).toThrow();
  });
  it("allows HTTPS product images and safe calls to action", () => {
    expect(
      normalize({
        prizes: [
          {
            id: "product",
            name: "Your product",
            image: "https://example.com/toy.webp",
            url: "https://example.com/shop",
          },
        ],
      }).prizes[0]?.url,
    ).toBe("https://example.com/shop");
  });
});
