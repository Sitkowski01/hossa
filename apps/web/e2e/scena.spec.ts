import { expect, test } from "@playwright/test";
import { collectErrors, day, openTown } from "./helpers.js";

test("makieta laduje sie bez bledow i pokazuje kursy szesciu spolek", async ({ page }) => {
  const errors = collectErrors(page);
  await openTown(page, "seed=42&godzina=12");
  await expect(page.locator("#scena")).toBeVisible();
  await expect(page.locator("#ladowanie")).toHaveClass(/gotowe/);
  await expect(page.getByTestId("indeks")).toContainText(/Indeks \d+,\d/);
  expect(errors).toEqual([]);
});

test("tempo 16x przyspiesza czas, a pauza go zatrzymuje", async ({ page }) => {
  await openTown(page, "seed=42");
  await page.getByRole("button", { name: "16×" }).click();
  await expect(page.getByRole("button", { name: "16×" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => day(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);

  await page.getByRole("button", { name: "Pauza" }).click();
  await expect(page.getByRole("button", { name: "Pauza" })).toHaveAttribute("aria-pressed", "true");
  const paused = await page.getByTestId("czas").textContent();
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("czas")).toHaveText(paused ?? "");
});

test("to samo ziarno daje te sama sesje, inne ziarno inna", async ({ page }) => {
  // w pauzie wykonuje sie tylko pierwszy krok gieldy, wiec indeks zalezy wylacznie od ziarna
  const indexFor = async (seed: number) => {
    await openTown(page, `seed=${String(seed)}&tempo=0`);
    return page.getByTestId("indeks").textContent();
  };
  const first = await indexFor(42);
  expect(await indexFor(42)).toBe(first);
  expect(await indexFor(7)).not.toBe(first);
});
