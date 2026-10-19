import type { FromWorker, Snapshot, ToWorker } from "./sim/protocol.js";
import { dayFraction, extrapolate } from "./sim/clock.js";
import { loadModel } from "./scene/model.js";
import { createPickets } from "./scene/pickets.js";
import { createProps } from "./scene/props.js";
import { createRain } from "./scene/rain.js";
import { createSky } from "./scene/sky.js";
import { createSmoke } from "./scene/smoke.js";
import { createStage } from "./scene/stage.js";
import { createTickers } from "./scene/tickers.js";
import { createTrucks } from "./scene/trucks.js";
import { createHud } from "./ui/hud.js";
import { daylight, hourOf } from "./world/daylight.js";
import { readParams } from "./world/params.js";

const { seed, speed, hour: fixedHour, camera: view } = readParams(location.search);

const canvas = document.getElementById("scena") as HTMLCanvasElement;
const stage = createStage(canvas);
const sky = createSky(stage.renderer, stage.scene);
if (view) {
  const [x, y, z, tx, ty, tz] = view;
  stage.camera.position.set(x, y, z);
  stage.controls.target.set(tx, ty, tz);
}

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
const hud = createHud((s) => {
  send({ type: "speed", speed: s });
});

const model = await loadModel(import.meta.env.BASE_URL);
stage.scene.add(model.root);
const trucks = createTrucks(model, stage.scene);
const props = createProps(model, stage.scene);
const tickers = createTickers(model, stage.scene);
const pickets = createPickets(model, stage.scene);
const rain = createRain(stage.scene);
const chimneys = [
  { smoke: createSmoke(stage.scene, model.anchor("STW_dym_1")), rate: (s: Snapshot) => s.companies.STW.output },
  { smoke: createSmoke(stage.scene, model.anchor("STW_dym_2")), rate: (s: Snapshot) => s.companies.STW.output },
  { smoke: createSmoke(stage.scene, model.anchor("MTK_dym")), rate: (s: Snapshot) => s.companies.MTK.output },
];
send({ type: "start", seed, speed });

let previous = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  const snap = latest;
  if (snap) {
    const time = extrapolate(snap.time, snap.ticksPerMs, now - receivedAt, snap.stepsPerDay);
    const fraction = dayFraction(time, snap.stepsPerDay);
    const hour = fixedHour ?? hourOf(fraction);
    const light = daylight(hour);
    const storm = snap.incidents.some((i) => i.kind === "SZTORM");
    // animacje zakladow ida w tempie symulacji: w pauzie dym stoi, przy 16× kleby leca szybciej
    const simDt = dt * snap.speed;
    sky.update(light, storm);
    trucks.update(snap, fraction);
    props.update(snap, fraction, light, simDt, now);
    tickers.update(snap, dt, stage.camera, { width: canvas.clientWidth, height: canvas.clientHeight });
    pickets.update(snap, now);
    rain.update(storm, dt);
    for (const c of chimneys) c.smoke.update(c.rate(snap), simDt, light.day);
    hud.update(snap, hour);
  }
  stage.render();
}
requestAnimationFrame(frame);

document.getElementById("ladowanie")?.classList.add("gotowe");
document.body.dataset.gotowe = "1";
