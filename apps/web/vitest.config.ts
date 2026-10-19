import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  // Jak w pakietach: symulacja testowana na zrodlach silnika, gospodarki i rynku, nie na starym dist.
  resolve: { alias: { "@hossa/engine": src("engine"), "@hossa/economy": src("economy"), "@hossa/market": src("market") } },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Testy jednostkowe obejmuja czysta logike; scene (three.js, WebGL) sprawdza Playwright.
      include: ["src/sim/**/*.ts", "src/world/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/sim/worker.ts"],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
