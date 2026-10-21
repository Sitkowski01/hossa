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

test("na telefonie panel wysuwa sie od dolu, chowa notowania i nie wychodzi poza ekran", async ({ page }) => {
  const errors = collectErrors(page);
  // bez animacji wjazdu: panel od razu stoi na miejscu (i sprawdzamy sciezke prefers-reduced-motion)
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTown(page, "seed=42&godzina=12&tempo=16");
  const quote = page.getByTestId("notowanie-MTK");
  const box = await quote.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await quote.tap();
  const panel = page.getByRole("complementary", { name: /Fabryka Motorek/ });
  await expect(panel).toBeVisible();
  const sheet = await panel.boundingBox();
  const viewport = page.viewportSize();
  if (!sheet || !viewport) throw new Error("brak panelu");
  // panel siega dolnej krawedzi, zajmuje cala szerokosc i zostawia makiete na gorze
  expect(sheet.x).toBe(0);
  expect(sheet.width).toBe(viewport.width);
  expect(sheet.y + sheet.height).toBeCloseTo(viewport.height, 0);
  expect(sheet.y).toBeGreaterThan(viewport.height * 0.3);
  await expect(page.getByRole("navigation", { name: "Notowania spółek" })).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await panel.getByRole("button", { name: "Zamknij panel" }).tap();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Notowania spółek" })).toBeVisible();
  expect(errors).toEqual([]);
});
