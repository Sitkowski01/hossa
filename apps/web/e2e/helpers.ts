import { expect, type Page } from "@playwright/test";

/** Bledy z konsoli i nieprzechwycone wyjatki strony (ostrzezenia sterownika WebGL pomijamy). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Otwiera makiete i czeka, az wczyta sie model i przyjdzie pierwsza migawka z workera. */
export async function openTown(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await expect(page.locator("body")).toHaveAttribute("data-gotowe", "1");
  await expect(page.getByTestId("czas")).toContainText("Dzień");
}

/** Dzien z paska u gory. */
export async function day(page: Page): Promise<number> {
  const text = (await page.getByTestId("czas").textContent()) ?? "";
  return Number(/Dzień (\d+)/.exec(text)?.[1] ?? Number.NaN);
}
