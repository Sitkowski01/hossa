import { SPEEDS, type FromWorker, type Snapshot, type Speed, type ToWorker } from "./sim/protocol.js";
import { dayFraction, extrapolate } from "./sim/clock.js";
import { loadModel } from "./scene/model.js";
import { createWeather } from "./scene/sky.js";
import { createStage } from "./scene/stage.js";
import { daylight, hourOf } from "./world/daylight.js";

/**
 * Parametry z adresu: ?seed=42 (ta sama sesja za kazdym razem), ?tempo=4,
 * ?godzina=12 (zatrzymana pora dnia — do zrzutow ekranu).
 */
const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? Math.floor(Math.random() * 1e6));
const speedParam = Number(params.get("tempo") ?? 1);
const speed: Speed = SPEEDS.find((s) => s === speedParam) ?? 1;
const fixedHour = params.has("godzina") ? Number(params.get("godzina")) : undefined;

const canvas = document.getElementById("scena") as HTMLCanvasElement;
const stage = createStage(canvas);
const weather = createWeather(stage.renderer, stage.scene);

let latest: Snapshot | undefined;
let receivedAt = 0;

const worker = new Worker(new URL("./sim/worker.ts", import.meta.url), { type: "module" });
const send = (msg: ToWorker) => {
  worker.postMessage(msg);
};
worker.onmessage = (e: MessageEvent<FromWorker>) => {
  latest = e.data.snapshot;
  receivedAt = performance.now();
  document.body.dataset.dzien = String(latest.day);
};

const model = await loadModel(import.meta.env.BASE_URL);
stage.scene.add(model.root);
send({ type: "start", seed, speed });

function frame(now: number): void {
  requestAnimationFrame(frame);
  const snap = latest;
  const time = snap ? extrapolate(snap.time, snap.ticksPerMs, now - receivedAt, snap.stepsPerDay) : 0;
  const fraction = snap ? dayFraction(time, snap.stepsPerDay) : 0.3;
  const light = daylight(fixedHour ?? hourOf(fraction));
  const storm = snap?.incidents.some((i) => i.kind === "SZTORM") ?? false;
  weather.update(light, storm);
  stage.render();
}
requestAnimationFrame(frame);

document.getElementById("ladowanie")?.classList.add("gotowe");
document.body.dataset.gotowe = "1";
