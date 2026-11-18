import { createClawMachine } from "../src/index.js";
const claw = createClawMachine({ container: "#machine" });
Object.assign(window, { claw });
document.querySelector("#reset")?.addEventListener("click", () => claw.reset());
document
  .querySelector("#midnight")
  ?.addEventListener("click", () =>
    claw.update({ preset: "midnight", accent: "#7865d9" }),
  );
document
  .querySelector("#mint")
  ?.addEventListener("click", () =>
    claw.update({ preset: "mint", accent: "#4a9b82" }),
  );
