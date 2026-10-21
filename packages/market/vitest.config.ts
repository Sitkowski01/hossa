import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  // Pakiety z monorepo prosto ze zrodel: testy rynku zawsze widza aktualny silnik i gospodarke,
  // nawet bez przebudowania dist (inaczej latwo przetestowac stara wersje).
  resolve: { alias: { "@hossa/engine": src("engine"), "@hossa/economy": src("economy") } },
  test: {
    include: ["src/**/*.test.ts"],
    // testy sesji symuluja setki dni; pod instrumentacja Strykera trwaja kilka razy dluzej
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/index.ts"],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
