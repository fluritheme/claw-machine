import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
assert.equal(pkg.name, "@fluritheme/claw-machine");
assert.equal(pkg.license, "SEE LICENSE IN LICENSE");
assert.equal(pkg.homepage, "https://fluri.xyz/");
const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
assert.match(license, /Commercial License/i);
for (const file of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/types.d.ts",
  "README.md",
  "LICENSE",
  "LICENSE-MIT-LEGACY",
  "LICENSING.md",
  "licensing.json",
])
  assert.ok(
    (await readFile(new URL("../" + file, import.meta.url))).length > 10,
    file,
  );
const notices = [];
for (const name of ["three", "cannon-es"]) {
  const main = require.resolve(name);
  let dir = main.slice(0, main.lastIndexOf("/"));
  let text;
  for (let i = 0; i < 4 && !text; i++) {
    for (const f of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
      try {
        text = await readFile(dir + "/" + f, "utf8");
        break;
      } catch {}
    }
    dir = dir.slice(0, dir.lastIndexOf("/"));
  }
  assert.ok(text, "Missing dependency notice: " + name);
  notices.push("--- " + name + " ---\n" + text);
}
await writeFile(
  new URL("../THIRD-PARTY-NOTICES.txt", import.meta.url),
  notices.join("\n\n"),
);
const { createClawMachine } = await import("../dist/index.js");
const machine = createClawMachine();
assert.equal(machine.getState().ready, false);
machine.destroy();
machine.destroy();
console.log(
  pkg.name +
    "@" +
    pkg.version +
    ": commercial archive, third-party notices and SSR import verified.",
);
