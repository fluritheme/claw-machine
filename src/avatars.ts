import type { Prize } from "./types.js";
/** Original Fluri collectible portraits, shared by the shelf and prize ticket. */
export function portrait(prize: Prize): HTMLElement | SVGElement {
  if (prize.image) {
    const image = document.createElement("img");
    image.src = prize.image;
    image.alt = prize.name;
    image.style.cssText = "width:100%;height:100%;object-fit:contain";
    image.referrerPolicy = "no-referrer";
    return image;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 80 80");
  svg.setAttribute("aria-hidden", "true");
  const kind = prize.character,
    color = prize.color ?? "#f1c979";
  const extras =
    kind === "cat"
      ? `<path d="m18 28-2-20 19 12m12 0 18-12-2 24" fill="${color}" stroke="#34313d" stroke-width="2"/>`
      : kind === "yeti"
        ? '<path d="m20 24-5-13 13 7m25 5 11-12-3 18" fill="#fff3dd" stroke="#9fb9c0" stroke-width="2"/>'
        : kind === "bandit"
          ? `<circle cx="20" cy="22" r="12" fill="${color}"/><circle cx="60" cy="22" r="12" fill="${color}"/>`
          : kind === "spider"
            ? '<path d="m20 35-15-9m15 19L3 43m18 9L7 62m53-27 15-9M60 45l17-2M59 52l14 10" stroke="#b67a50" stroke-width="5" stroke-linecap="round"/>'
            : "";
  const body =
    kind === "ghost"
      ? `<path d="M15 44V32a25 25 0 0 1 50 0v31l-10-5-10 6-10-6-10 6-10-6Z" fill="${color}" stroke="#c6bed8" stroke-width="2"/>`
      : `<ellipse cx="40" cy="43" rx="25" ry="27" fill="${color}" stroke="#34313d" stroke-opacity=".2" stroke-width="2"/>`;
  const face =
    kind === "astronaut"
      ? '<ellipse cx="40" cy="34" rx="21" ry="20" fill="#3d505b"/><path d="M26 27q5-12 17-10" stroke="#d5eff2" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="31" y="58" width="18" height="9" rx="3" fill="#e7865f"/>'
      : `${kind === "bandit" ? '<path d="M17 34q23-14 46 0v13q-23 10-46 0Z" fill="#3b5448"/>' : kind === "yeti" ? '<ellipse cx="40" cy="42" rx="21" ry="23" fill="#fff4df"/>' : ""}<ellipse cx="30" cy="37" rx="4" ry="6" fill="${kind === "cat" ? "#f2cf6c" : "#34313d"}"/><ellipse cx="50" cy="37" rx="4" ry="6" fill="${kind === "cat" ? "#f2cf6c" : "#34313d"}"/><circle cx="31" cy="35" r="1.3" fill="white"/><circle cx="51" cy="35" r="1.3" fill="white"/><path d="M36 48q4 6 8 0" stroke="#51404b" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  svg.innerHTML =
    extras +
    body +
    face +
    (kind === "yeti"
      ? '<path d="m20 60q20 10 40 0" stroke="#db735d" stroke-width="7" fill="none"/>'
      : "");
  return svg;
}
