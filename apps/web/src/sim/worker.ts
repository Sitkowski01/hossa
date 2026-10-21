import type { Ticker } from "@hossa/economy";
import { Session } from "@hossa/market";
import { SimClock } from "./clock.js";
import type { FromWorker, ToWorker } from "./protocol.js";
import { Observer } from "./view.js";

/**
 * Web Worker: gielda i gospodarka licza sie tu, poza watkiem rysowania, wiec scena nie
 * przycina sie, gdy boty skladaja zlecenia. Co 100 ms zegar idzie naprzod, sesja nadrabia
 * zalegle kroki, a scena dostaje migawke.
 */
const SNAPSHOT_EVERY_MS = 100;

const port = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker): void;
};

let running: { session: Session; clock: SimClock; observer: Observer } | undefined;
let last = 0;
/** Spolka otwarta w panelu — tylko dla niej worker liczy arkusz, swiece i fundamenty. */
let focus: Ticker | null = null;

function loop(): void {
  if (!running) return;
  const { session, clock, observer } = running;
  const now = performance.now();
  clock.advance(now - last);
  last = now;
  while (session.step < clock.stepsDue) session.tick();
  port.postMessage({ type: "snapshot", snapshot: observer.snapshot(session, clock, focus) });
}

port.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "start" && !running) {
    const session = new Session({ seed: msg.seed });
    running = { session, clock: new SimClock(session.stepsPerDay, msg.speed), observer: new Observer(msg.seed) };
    last = performance.now();
    loop();
    setInterval(loop, SNAPSHOT_EVERY_MS);
  } else if (msg.type === "speed" && running) {
    loop(); // czas do tej chwili liczy sie jeszcze w starym tempie
    running.clock.speed = msg.speed;
    loop(); // scena od razu dostaje nowe tempo, inaczej przez 100 ms ekstrapolowalaby po staremu
  } else if (msg.type === "focus") {
    focus = msg.ticker;
    loop(); // panel nie czeka 100 ms na pierwsze dane
  }
};
