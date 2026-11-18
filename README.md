<div align="center">

# Claw Machine · Fluri Arcade

**A little luck. A little friend.**

A playable 3D claw machine for your website. Chrome fingers, an enamel cabinet, real tumbling prizes and six original Fluri collectibles.

[Play the arcade](https://fluri.xyz/claw-machine/) · [Fluri Themes](https://fluri.xyz/) · [Commercial licence](https://fluri.xyz/legal/license/)

![Claw Machine by Fluri — a cherry-red 3D arcade with six little collectible friends](https://fluri.xyz/previews/claw-desktop.png)

![The actual Claw Machine grab sequence](https://fluri.xyz/previews/claw.gif)

![npm version](https://img.shields.io/npm/v/@fluritheme/claw-machine?color=db3f45&label=npm) ![npm downloads](https://img.shields.io/npm/dm/@fluritheme/claw-machine?color=db3f45)

</div>

## One more go

Move the claw, line up a prize and press Grab. The cable unwinds, the three fingers close, and a physical joint lifts the toy through the cabinet. Off-centre grabs can slip. Successful grabs travel to a guarded chute, fall into the delivery well and reveal a collectible ticket. The machine then restocks.

The included original characters are Mochi the yeti, Midnight the cat, Boo the ghost, Pip the spider, Moon the explorer and Maple the bandit. Each has its own mesh details and matching collection portrait. No external models, fonts, textures or character image downloads are needed for the built-in collection.

- Three-dimensional cabinet, metallic claw, glass reflections, soft shadows and prize collisions.
- Mouse aiming, arrow keys / WASD, Space to grab and touch direction buttons.
- Embedded machine or an opt-in launcher dialog with focus return and keyboard containment.
- Cherry, Midnight and Mint cabinet presets, custom colours and marquee text.
- Your own product images, prize messages and optional HTTPS links.
- Muted by default; optional synthesised sound, no audio file requests.
- Optional local collection saving; off by default. No built-in telemetry or activation checks.
- Offscreen/tab pause, capped pixel ratio and frame rate, reduced-motion decoration and a Canvas 2D software fallback using the same physics.
- Shadow DOM isolates the component's styles. The host page keeps its links, styles and ordinary scrolling.

## Install

```sh
npm install @fluritheme/claw-machine
```

```html
<div id="arcade"></div>
```

```ts
import { createClawMachine } from "@fluritheme/claw-machine";

const machine = createClawMachine({
  container: "#arcade",
  preset: "cherry",
  difficulty: "relaxed",
  onWin(prize) {
    console.log("A little friend:", prize.id);
  },
});

// On route/component unmount:
machine.destroy();
```

Give an embedded container at least 320px of width. The machine supplies its own responsive height. It does not change the container's positioning or the document's styles.

### A little launcher instead

```ts
const machine = createClawMachine({
  placement: "launcher",
  title: "GOOD LUCK",
  accent: "#db3f45",
});
```

The launcher opens the machine only when invited. It is anchored to the viewport, while an embedded machine scrolls natively with its container. `open()` and `close()` also control the launcher programmatically.

### Your own prizes

```ts
const machine = createClawMachine({
  container: "#arcade",
  prizes: [
    {
      id: "coffee",
      name: "A little coffee break",
      image: "https://example.com/coffee.webp",
      color: "#bcdbcb",
      message: "Something good found you.",
      url: "https://example.com/coffee",
    },
  ],
  prizeCount: 12,
});
```

Supply 1–24 unique prize designs and 6–30 physical toys. Image hosts must permit cross-origin image loading (CORS) for 3D textures; if loading fails, the cabinet keeps a labelled fallback. Use HTTPS PNG/WebP/JPEG images, preferably square and below 512px. Inline base64 PNG/JPEG/WebP images are also supported, up to the configuration's size limit. SVG/HTML data URLs and executable links are rejected. Prize links only open when the visitor chooses the ticket link.

A custom image replaces the built-in collection when supplied as the only prize. To mix products with Fluri characters, import `collectibles` and include them in your prize array.

## Controls

| Action         | Controls                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| Aim            | Drag on the canvas with a mouse; arrows / WASD; hold the direction buttons on touch |
| Grab           | Space while the canvas is focused, or the Grab button                               |
| Mix the pile   | Mix it up                                                                           |
| Play again     | One more go on the prize ticket                                                     |
| Close launcher | Close button, Escape or the backdrop                                                |

Touch scrolling stays native on the canvas. Touch aiming uses the direction buttons rather than capturing a website swipe. Keys are handled only inside the component.

## Configuration

| Option               | Default                 | Behaviour                                                                     |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `container`          | document body           | Element or CSS selector; normally supply a container for embedded use         |
| `placement`          | `embedded`              | `embedded` or `launcher`                                                      |
| `preset`             | `cherry`                | `cherry`, `midnight`, `mint`                                                  |
| `accent`             | preset colour           | Six-digit hex cabinet colour                                                  |
| `title`              | `GOOD LUCK`             | Marquee text, up to 32 characters                                             |
| `difficulty`         | `relaxed`               | `challenging` requires better centring; no paid attempts                      |
| `prizeCount`         | `16`                    | Physical toy count, 6–30                                                      |
| `prizes`             | six Fluri characters    | 1–24 unique prize definitions                                                 |
| `sound`              | `false`                 | Optional synthesised effects, subject to browser audio permission             |
| `rememberCollection` | `false`                 | Saves collected IDs in localStorage when enabled                              |
| `storageKey`         | `fluri-claw-collection` | Namespace when collection saving is enabled                                   |
| `maxDPR`             | `1.5`                   | Rendering resolution cap, 1–2                                                 |
| `maxFPS`             | `40`                    | Frame-rate cap, 20–60                                                         |
| `reducedMotion`      | `respect`               | Removes idle decorative motion; manually requested gameplay remains available |
| `zIndex`             | `1000`                  | Launcher stacking level                                                       |
| `onWin`              | none                    | Callback after a physical delivery into the chute                             |

`preset` chooses the initial colour. `update({ preset: 'mint' })` changes it; an explicit `accent` overrides the preset. Changing prize designs, toy count or marquee text rebuilds the cabinet and resets the round. Changing the container or placement requires a new instance.

## Runtime API

```ts
machine.move(0.4, -0.3); // Normalised x / depth, each clamped to -1…1.
machine.grab(); // true when a new attempt starts, false while busy.
machine.shuffle(); // Physically stirs the pile while aiming.
machine.reset(); // Restocks and resets the round counters.
machine.pause();
machine.resume();
machine.update({ accent: "#7865d9", difficulty: "challenging" });

const unsubscribe = machine.on((event) => {
  // ready, phase, grab, slip, win, reset, error
  console.log(event.type, event.phase, event.prize);
});

const state = machine.getState();
// phase, paused, ready, aim, claw, heldPrize, collection, attempts, wins, prize positions
unsubscribe();
machine.destroy(); // Idempotent; releases observers, listeners, physics and GPU resources.
```

Phases: `aiming → lowering → closing → lifting → carrying → releasing → returning`. Misses return after lifting; off-centre holds can slip. `reset()` keeps the collectible shelf; `destroy()` removes the component. A win callback is cosmetic client state, not proof of eligibility for a valuable reward.

### React / Next.js

```tsx
"use client";
import { useEffect, useRef } from "react";
import { createClawMachine } from "@fluritheme/claw-machine";

export function Arcade() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const machine = createClawMachine({ container: root.current });
    return () => machine.destroy();
  }, []);
  return <div ref={root} />;
}
```

Module imports are SSR-safe. Calling `createClawMachine()` without a browser returns an inert controller; create the visible instance after mounting. React Strict Mode cleanup is supported. No React dependency is required.

## Fluri hosted installation

The same engine runs at [fluri.xyz/claw-machine/](https://fluri.xyz/claw-machine/) and in My Fluri's editor. A hosted installation uses your project's saved configuration and the existing Fluri installation script. Launcher is the hosted default. Embedded hosted placement requires an element matching the configured selector, for example:

```html
<div data-fluri-claw-container></div>
```

The hosted service's account, delivery and optional aggregate reporting are separate from this standalone npm engine. See the [shared legal centre](https://fluri.xyz/legal/). Custom image hosts receive normal browser image requests. If you enable optional collection saving, disclose that browser storage and manage consent as appropriate for your site.

## Performance and limits

Three.js renders the original geometry; cannon-es advances a bounded rigid-body simulation. Gripping uses a point constraint after a spatial capture check, with deliberate off-centre slipping. It is a stylised game mechanic, not a complete soft-body finger/contact simulation. The software fallback retains the same physics with a simpler 2D visual presentation.

This is an interactive game, heavier than a decorative snow or cursor effect. Load it only where wanted. The launcher delays graphics creation until opened; rendering pauses offscreen and in hidden tabs. Test on actual target devices. Container movement follows native DOM layout; the package does not scan or grab arbitrary page elements. WebGL, texture CORS and the host Content Security Policy can affect appearance.

No payments, valuable-reward issuing, online leaderboard or multiplayer service is included. Real promotions need server-side eligibility, inventory and redemption validation; do not trust a browser `onWin` event for those decisions.

## Licence

Commercial software under the included Fluri Themes Commercial License. Private evaluation and production use are governed by the supplied licence. This package is not MIT; Three.js and cannon-es retain their own MIT notices in `THIRD-PARTY-NOTICES.txt`. Existing historical Fluri releases keep their original grants.

Made by [František Gejdoš](https://fluri.xyz/founder/) for [Fluri Themes](https://fluri.xyz/).
