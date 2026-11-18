import type { ClawOptions, Config, Prize } from "./types.js";
export const collectibles: Prize[] = [
  {
    id: "yeti",
    name: "Mochi the yeti",
    character: "yeti",
    color: "#c5e8ed",
    message: "A little snow. A lot of heart.",
  },
  {
    id: "cat",
    name: "Midnight the cat",
    character: "cat",
    color: "#414456",
    message: "You have been chosen. Probably.",
  },
  {
    id: "ghost",
    name: "Boo the ghost",
    character: "ghost",
    color: "#ede7ff",
    message: "Your new invisible best friend.",
  },
  {
    id: "spider",
    name: "Pip the spider",
    character: "spider",
    color: "#eead73",
    message: "Eight tiny high fives.",
  },
  {
    id: "astronaut",
    name: "Moon the explorer",
    character: "astronaut",
    color: "#f3ecda",
    message: "One small grab. One giant friendship.",
  },
  {
    id: "bandit",
    name: "Maple the bandit",
    character: "bandit",
    color: "#aecc9d",
    message: "Hide your snacks.",
  },
];
const allowed = new Set([
  "container",
  "placement",
  "preset",
  "accent",
  "title",
  "difficulty",
  "prizeCount",
  "prizes",
  "sound",
  "rememberCollection",
  "storageKey",
  "maxDPR",
  "maxFPS",
  "reducedMotion",
  "zIndex",
  "onWin",
]);
export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));
function number(
  v: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new TypeError(`Expected a finite number between ${min} and ${max}`);
  return v;
}
export function safeURL(input: string, image = false): string {
  if (typeof input !== "string" || input.length > (image ? 2_000_000 : 2048))
    throw new TypeError("Invalid URL");
  if (
    image &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input)
  )
    return input;
  const base =
    typeof location === "undefined" ? "https://fluri.xyz/" : location.href;
  const url = new URL(input, base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new TypeError("Use an HTTP(S) URL without credentials");
  if (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new TypeError("Use HTTPS for remote URLs");
  return url.href;
}
export function normalize(input: ClawOptions = {}): Config {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Expected Claw Machine options");
  for (const key of Object.keys(input))
    if (!allowed.has(key))
      throw new TypeError(`Unknown Claw Machine setting: ${key}`);
  const preset = input.preset ?? "cherry";
  if (!["cherry", "midnight", "mint"].includes(preset))
    throw new TypeError("Unknown cabinet preset");
  const accent =
    input.accent ??
    { cherry: "#db3f45", midnight: "#7865d9", mint: "#4a9b82" }[preset];
  if (!/^#[\da-f]{6}$/i.test(accent))
    throw new TypeError("Use a six-digit hex accent colour");
  const placement = input.placement ?? "embedded",
    difficulty = input.difficulty ?? "relaxed",
    reducedMotion = input.reducedMotion ?? "respect";
  if (
    !["embedded", "launcher"].includes(placement) ||
    !["relaxed", "challenging"].includes(difficulty) ||
    !["respect", "ignore"].includes(reducedMotion)
  )
    throw new TypeError("Invalid placement, difficulty or motion setting");
  for (const k of ["sound", "rememberCollection"] as const)
    if (input[k] !== undefined && typeof input[k] !== "boolean")
      throw new TypeError(`Invalid ${k}`);
  if (
    input.title !== undefined &&
    (typeof input.title !== "string" || input.title.length > 32)
  )
    throw new TypeError("Cabinet title must be 32 characters or fewer");
  if (input.onWin !== undefined && typeof input.onWin !== "function")
    throw new TypeError("onWin must be a function");
  if (
    input.container !== undefined &&
    typeof input.container !== "string" &&
    !(
      typeof HTMLElement !== "undefined" &&
      input.container instanceof HTMLElement
    )
  )
    throw new TypeError("container must be an element or selector");
  if (
    input.storageKey !== undefined &&
    (typeof input.storageKey !== "string" ||
      !/^[\w.-]{1,80}$/.test(input.storageKey))
  )
    throw new TypeError("Invalid collection storage key");
  const prizes = input.prizes ?? collectibles;
  if (!Array.isArray(prizes) || prizes.length < 1 || prizes.length > 24)
    throw new TypeError("Supply between 1 and 24 prize designs");
  const ids = new Set<string>();
  const parsed = prizes.map((p): Prize => {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.id !== "string" ||
      !/^[\w-]{1,48}$/.test(p.id) ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      p.name.length > 70
    )
      throw new TypeError("Prizes need unique short IDs and names");
    ids.add(p.id);
    if (p.character && !collectibles.some((c) => c.character === p.character))
      throw new TypeError("Unknown collectible");
    if (p.color && !/^#[\da-f]{6}$/i.test(p.color))
      throw new TypeError("Invalid prize colour");
    if (
      p.message !== undefined &&
      (typeof p.message !== "string" || p.message.length > 240)
    )
      throw new TypeError("Prize messages must be 240 characters or fewer");
    return {
      id: p.id,
      name: p.name,
      ...(p.character ? { character: p.character } : {}),
      ...(p.color ? { color: p.color } : {}),
      ...(p.message ? { message: p.message } : {}),
      ...(p.image ? { image: safeURL(p.image, true) } : {}),
      ...(p.url ? { url: safeURL(p.url) } : {}),
    };
  });
  return {
    ...(input.container === undefined ? {} : { container: input.container }),
    ...(input.onWin ? { onWin: input.onWin } : {}),
    placement,
    preset,
    accent,
    title: input.title ?? "GOOD LUCK",
    difficulty,
    prizeCount: Math.round(number(input.prizeCount, 16, 6, 30)),
    prizes: parsed,
    sound: input.sound ?? false,
    rememberCollection: input.rememberCollection ?? false,
    storageKey: input.storageKey ?? "fluri-claw-collection",
    maxDPR: number(input.maxDPR, 1.5, 1, 2),
    maxFPS: number(input.maxFPS, 40, 20, 60),
    reducedMotion,
    zIndex: Math.round(number(input.zIndex, 1000, 0, 2147483646)),
  };
}
