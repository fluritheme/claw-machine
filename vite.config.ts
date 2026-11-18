import { defineConfig } from "vite";
export default defineConfig({
  server: { host: "127.0.0.1", port: 5320, hmr: false },
  optimizeDeps: { include: ["three", "cannon-es"] },
});
