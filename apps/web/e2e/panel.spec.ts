import { expect, test, type Page } from "@playwright/test";
import { collectErrors, openTown } from "./helpers.js";

test("notowanie otwiera panel spolki z kursem, arkuszem, transakcjami i fundamentami", async ({ page }) => {
  const errors = collectErrors(page);
  await openTown(page, "seed=42&godzina=12&tempo=16");
  const quote = page.getByTestId("notowanie-STW");
  await quote.click();
  const panel = page.getByRole("complementary", { name: /Huta Stalwar/ });
  await expect(panel).toBeVisible();
  await expect(quote).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("panel-cena")).toHaveText(/^\d+,\d{2} zł$/);
  await expect(panel.getByRole("list", { name: "Oferty kupna" }).getByRole("listitem").first()).toBeVisible();
  await expect(panel.getByRole("list", { name: "Oferty sprzedaży" }).getByRole("listitem").first()).toBeVisible();
  await expect(panel.getByText(/^spread \d+,\d{2} zł$/)).toBeVisible();
  // przy 16× transakcje przychodza w kazdym kroku
  await expect(page.getByTestId("tasma").locator("li[data-strona]").first()).toBeVisible();
  await expect(panel.getByText("Kapitalizacja", { exact: true })).toBeVisible();
  await expect(panel.getByText("Wartość godziwa", { exact: true })).toBeVisible();

  // Escape zamyka panel, a fokus wraca na notowanie, z ktorego go otwarto
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(quote).toBeFocused();
  await expect(quote).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

/** Klik w srodek sceny przy kamerze ustawionej z adresu. */
async function clickCentre(page: Page): Promise<void> {
  const box = await page.locator("#scena").boundingBox();
  if (!box) throw new Error("brak sceny");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test("klik w budynek na makiecie otwiera panel jego spolki", async ({ page }) => {
  // kamera prosto nad huta: jej budynek jest na srodku ekranu
  await openTown(page, "seed=42&godzina=12&kamera=-140,160,40,-140,0,-8");
  await clickCentre(page);
  await expect(page.getByRole("complementary", { name: /Huta Stalwar/ })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-panel", "STW");
});

test("klik w morze nie otwiera zadnego panelu", async ({ page }) => {
  await openTown(page, "seed=42&godzina=12&kamera=80,160,210,80,0,160");
  await clickCentre(page);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("panel")).toBeHidden();
  await expect(page.locator("body")).not.toHaveAttribute("data-panel");
});

test("adres ze spolka otwiera jej panel od razu, a przycisk zamyka", async ({ page }) => {
  const errors = collectErrors(page);
  // tempo 4×: strajk trwa od 2. do 16. dnia, czyli ok. 2,5 minuty — zapas na wolne wczytywanie w CI
  await openTown(page, "seed=79&godzina=12&tempo=4&spolka=rud");
  const panel = page.getByRole("complementary", { name: /Kopalnia Rudawa/ });
  await expect(panel).toBeVisible();
  // ziarno 79: strajk w kopalni drugiego dnia — panel pokazuje to w naglowku i w wiadomosciach
  await expect(panel.getByText("kopalnia stoi")).toBeVisible();
  await expect(panel.getByText(/Strajk w kopalni Rudawa/)).toBeVisible();
  await panel.getByRole("button", { name: "Zamknij panel" }).click();
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test("pasek wiadomosci otwiera spolke, ktorej dotyczy wiadomosc", async ({ page }) => {
  await openTown(page, "seed=79&godzina=12&tempo=16");
  const news = page.getByTestId("wiadomosc");
  await expect(news).toContainText("Strajk w kopalni Rudawa");
  await news.click();
  await expect(page.locator("body")).toHaveAttribute("data-panel", "RUD");
});
