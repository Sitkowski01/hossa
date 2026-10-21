/** Jeden wiersz listy: teksty komorek i atrybuty data-* (np. kierunek do koloru). */
export interface Row {
  readonly cells: readonly string[];
  readonly data?: Readonly<Record<string, string>>;
  /** Zmienne CSS, np. --udzial dla paska glebokosci arkusza. */
  readonly vars?: Readonly<Record<string, string>>;
  readonly className?: string;
  readonly title?: string;
}

/**
 * Wpisuje wiersze do listy, zostawiajac istniejace wezly i zmieniajac tylko tekst, ktory sie
 * zmienil. Migawki przychodza 10 razy na sekunde — przebudowa od zera gubilaby zaznaczenie
 * tekstu i miejsce czytnika ekranu, a testom e2e podmienialaby elementy pod reka.
 */
export function sync(list: HTMLElement, rows: readonly Row[], item = "li", cells: readonly string[] = ["span"]): void {
  while (list.children.length > rows.length) list.lastElementChild?.remove();
  rows.forEach((row, i) => {
    let node = list.children[i] as HTMLElement | undefined;
    if (node?.childElementCount !== row.cells.length) {
      const fresh = document.createElement(item);
      for (let j = 0; j < row.cells.length; j++) fresh.append(document.createElement(cells[j] ?? cells.at(-1) ?? "span"));
      if (node) node.replaceWith(fresh);
      else list.append(fresh);
      node = fresh;
    }
    const target = node;
    if (target.className !== (row.className ?? "")) target.className = row.className ?? "";
    if (target.title !== (row.title ?? "")) target.title = row.title ?? "";
    row.cells.forEach((text, j) => {
      const cell = target.children[j] as HTMLElement;
      if (cell.textContent !== text) cell.textContent = text;
    });
    for (const [k, v] of Object.entries(row.data ?? {})) if (target.dataset[k] !== v) target.dataset[k] = v;
    for (const [k, v] of Object.entries(row.vars ?? {})) target.style.setProperty(k, v);
  });
}

/** Tekst i atrybut data-* tylko wtedy, gdy sie zmienily — ta sama wartosc nie podmienia wezla. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setData(node: HTMLElement, key: string, value: string): void {
  if (node.dataset[key] !== value) node.dataset[key] = value;
}

export function setPressed(button: HTMLElement, pressed: boolean): void {
  const value = String(pressed);
  if (button.getAttribute("aria-pressed") !== value) button.setAttribute("aria-pressed", value);
}
