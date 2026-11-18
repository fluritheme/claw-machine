import { test, expect } from "@playwright/test";
import type { ClawController } from "../src/types.js";
declare global {
  interface Window {
    claw: ClawController;
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => window.claw?.getState().ready))
    .toBe(true);
});
test("renders a real canvas and a six-prize collection, with muted sound and working keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator("[data-fluri-claw] canvas")).toBeVisible();
  await expect(page.locator(".slot")).toHaveCount(6);
  await expect(page.locator(".sound")).toHaveAttribute("aria-pressed", "false");
  await page.locator("canvas").focus();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.up("ArrowRight");
  expect(
    (await page.evaluate(() => window.claw.getState())).aim.x,
  ).toBeGreaterThan(0.05);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.claw.getState().phase))
    .not.toBe("aiming");
  expect(errors).toEqual([]);
});
test("a physically centred grab reaches the prize chute, opens a ticket and adds the collectible", async ({
  page,
}) => {
  await page.evaluate(() => {
    const p = window.claw
      .getState()
      .prizes.find((p) => p.x > 0.3 && p.z > -0.5)!;
    window.claw.move(p.x / 1.25, p.z / 0.78);
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.claw.getState();
        return Math.hypot(s.claw.x - s.aim.x * 1.25, s.claw.z - s.aim.z * 0.78);
      }),
    )
    .toBeLessThan(0.015);
  await page.locator(".grab").first().click();
  await expect(page.locator(".win")).toBeVisible({ timeout: 22000 });
  await expect(page.locator(".slot.found")).toHaveCount(1);
  expect((await page.evaluate(() => window.claw.getState())).wins).toBe(1);
  await page.getByRole("button", { name: "ONE MORE GO" }).click();
  await expect(page.locator(".win")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.claw.getState().phase), {
      timeout: 8000,
    })
    .toBe("aiming");
});
test("touch controls move the actual target while ordinary page scrolling stays native", async ({
  page,
}) => {
  const right = page.getByRole("button", { name: "Move right", exact: true });
  await right.scrollIntoViewIfNeeded();
  const bounds = await right.boundingBox();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.up();
  expect(
    (await page.evaluate(() => window.claw.getState())).aim.x,
  ).toBeGreaterThan(0.05);
  await page.evaluate(() => scrollTo(0, 0));
  const before = await page.locator("[data-fluri-claw]").boundingBox();
  await page.evaluate(() => scrollBy(0, 150));
  const after = await page.locator("[data-fluri-claw]").boundingBox();
  expect(Math.abs(before!.y - after!.y - 150)).toBeLessThan(1);
});
test("reset and destruction clean the machine without touching host content or page styles", async ({
  page,
}) => {
  const style = await page.locator("body").getAttribute("style");
  await page.evaluate(() => {
    window.claw.shuffle();
    window.claw.reset();
    window.claw.pause();
  });
  expect((await page.evaluate(() => window.claw.getState())).paused).toBe(true);
  await page.evaluate(() => window.claw.resume());
  await page.evaluate(() => {
    window.claw.destroy();
    window.claw.destroy();
  });
  await expect(page.locator("[data-fluri-claw]")).toHaveCount(0);
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.locator("body").getAttribute("style")).toBe(style);
});
test("launcher opens on request and returns focus on close", async ({
  page,
}) => {
  await page.evaluate(async () => {
    window.claw.destroy();
    const { createClawMachine } = await import(
      /* @vite-ignore */ String("/src/index.ts")
    );
    window.claw = createClawMachine({ placement: "launcher" });
  });
  await expect(page.locator("canvas")).toBeHidden();
  await page.getByRole("button", { name: "A little luck" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Close claw machine" }).click();
  await expect(page.locator("canvas")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "A little luck" }),
  ).toBeFocused();
});
test("configuration changes preserve host CSS and reject executable prize URLs", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    try {
      window.claw.update({
        prizes: [{ id: "x", name: "unsafe", url: "javascript:alert(1)" }],
      });
      return false;
    } catch {
      return true;
    }
  });
  expect(result).toBe(true);
  await page.evaluate(() => window.claw.update({ preset: "mint" }));
  await expect(page.locator("[data-fluri-claw]")).toHaveCSS("--red", "#4a9b82");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
