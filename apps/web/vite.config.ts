import { defineConfig } from "vite";

export default defineConfig({
  // Wzgledne sciezki: paczka dziala z dowolnego katalogu na serwerze (np. sitekmikolaj.pl/hossa/).
  base: "./",
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
