import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

// WebGL na programowym rendererze (SwiftShader): ten sam obraz lokalnie i w CI, bez karty graficznej.
const webgl = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions: { args: webgl } }, testIgnore: /telefon/ },
    { name: "telefon", use: { ...devices["Pixel 7"], launchOptions: { args: webgl } }, testMatch: /telefon/ },
  ],
  // serwer podglad z katalogu aplikacji (config lezy w e2e/)
  webServer: { command: "pnpm exec vite preview --port 4173 --strictPort", cwd: "..", port: 4173, reuseExistingServer: !process.env.CI },
});
