import { expect, test } from "@playwright/test";
import { collectErrors, openTown } from "./helpers.js";

test("na telefonie pasek miesci sie na ekranie, a przyciski da sie trafic palcem", async ({ page }) => {
  const errors = collectErrors(page);
  await openTown(page, "seed=42&godzina=12");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const button of await page.getByRole("navigation", { name: "Tempo czasu" }).getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "4×" }).tap();
  await expect(page.getByRole("button", { name: "4×" })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
