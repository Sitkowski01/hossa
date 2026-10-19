import { SPEEDS, type Snapshot, type Speed } from "../sim/protocol.js";
import { change } from "../world/format.js";

export interface Hud {
  update(snapshot: Snapshot, hour: number): void;
}

const LABELS: Record<Speed, string> = { 0: "❚❚", 1: "1×", 4: "4×", 16: "16×" };

/** Pasek u gory: dzien i godzina w miasteczku, indeks i tempo czasu. */
export function createHud(onSpeed: (speed: Speed) => void): Hud {
  const bar = document.createElement("header");
  bar.className = "hud";
  bar.innerHTML = `
    <strong class="hud-nazwa">Hossa</strong>
    <span class="hud-czas" data-testid="czas"></span>
    <span class="hud-indeks" data-testid="indeks"></span>
    <nav class="hud-tempo" aria-label="Tempo czasu"></nav>`;
  const time = bar.querySelector(".hud-czas") as HTMLElement;
  const index = bar.querySelector(".hud-indeks") as HTMLElement;
  const nav = bar.querySelector(".hud-tempo") as HTMLElement;
  const buttons = SPEEDS.map((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = LABELS[s];
    b.title = s === 0 ? "Pauza" : `Tempo ${String(s)}×`;
    b.addEventListener("click", () => {
      onSpeed(s);
    });
    nav.append(b);
    return { speed: s, button: b };
  });
  document.body.append(bar);

  return {
    update(snapshot, hour) {
      const h = Math.floor(hour);
      const m = Math.floor((hour - h) * 60);
      time.textContent = `Dzień ${String(snapshot.day)} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const pct = snapshot.index / snapshot.indexOpen - 1;
      index.textContent = `Indeks ${snapshot.index.toFixed(1).replace(".", ",")} (${change(pct)})`;
      index.dataset.kierunek = pct > 0 ? "wzrost" : pct < 0 ? "spadek" : "";
      for (const { speed, button } of buttons) button.setAttribute("aria-pressed", String(speed === snapshot.speed));
    },
  };
}
