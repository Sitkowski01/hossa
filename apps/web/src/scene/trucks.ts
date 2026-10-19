import type { Good } from "@hossa/economy";
import * as THREE from "three";
import layoutJson from "../../../../blender/layout.json";
import type { Route, Snapshot } from "../sim/protocol.js";
import { routeNodes, type Layout } from "../world/layout.js";
import { densify, keepRight, polyline, roundCorners, sampleAt, type Polyline, type Vec3 } from "../world/path.js";
import { MAX_TRUCKS, convoy } from "../world/traffic.js";
import type { Model } from "./model.js";

const layout = layoutJson as unknown as Layout;
const ROUTES: readonly Route[] = ["RUD-STW", "STW-MTK", "STW-BPT", "MTK-BPT"];
const CORNER = 7; // promien zakretu w metrach
const LANE = 2.2; // od osi drogi do srodka prawego pasa
const GROUND = ["teren", "drogi", "rynek", "BPT"]; // po czym jezdza ciezarowki
const MAX_GROUND = 3; // wyzej to juz dach albo dzwig, nie jezdnia

export interface Trucks {
  update(snapshot: Snapshot, dayFraction: number): void;
}

/**
 * Ciezarowki jezdza trasami z layout.json: od punktu zaladunku nadawcy, przez wezly drog,
 * do punktu rozladunku odbiorcy. Wysokosc trasy pochodzi z terenu (promien z gory co 3 m),
 * wiec ciezarowka wjezdza pod gorke do kopalni i na nabrzeze portu.
 */
export function createTrucks(model: Model, scene: THREE.Scene): Trucks {
  const ground = GROUND.map((n) => model.node(n));
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const heightAt = (x: number, z: number): number => {
    ray.set(new THREE.Vector3(x, 200, z), down);
    const hit = ray.intersectObjects(ground, true).find((h) => h.point.y < MAX_GROUND);
    return hit?.point.y ?? 0;
  };

  const lines = new Map<Route, Polyline>();
  for (const route of ROUTES) {
    const [from, to] = route.split("-") as [string, string];
    const start = model.anchor(`${from}_zaladunek`);
    const end = model.anchor(`${to}_rozladunek`);
    const flat = keepRight(densify(roundCorners([[start.x, start.z], ...routeNodes(layout, route), [end.x, end.z]], CORNER), 3), LANE);
    lines.set(route, polyline(flat.map(([x, z]): Vec3 => [x, heightAt(x, z), z])));
  }

  // pula ciezarowek na kazda trase: najwyzej MAX_TRUCKS naraz, kazda z ladunkiem swojego towaru
  const pools = new Map<string, THREE.Object3D[]>();
  const pool = (route: Route, good: Good): THREE.Object3D[] => {
    const key = `${route}:${good}`;
    let trucks = pools.get(key);
    if (!trucks) {
      const proto = model.node(`ciezarowka_${good}`);
      trucks = Array.from({ length: MAX_TRUCKS }, () => {
        const t = proto.clone();
        t.visible = false;
        scene.add(t);
        return t;
      });
      pools.set(key, trucks);
    }
    return trucks;
  };

  return {
    update(snapshot, dayFraction) {
      for (const trucks of pools.values()) for (const t of trucks) t.visible = false;
      for (const d of snapshot.dispatches) {
        const line = lines.get(d.route);
        if (!line) continue;
        const trucks = pool(d.route, d.good);
        convoy(d.good, d.quantity, dayFraction).forEach((progress, i) => {
          const t = trucks[i] as THREE.Object3D;
          const { position, direction } = sampleAt(line, progress * line.length);
          t.position.set(...position);
          // wzorzec ciezarowki patrzy w +x; obrot wokol y ustawia go w kierunku jazdy
          t.rotation.y = Math.atan2(-direction[1], direction[0]);
          t.visible = true;
        });
      }
    },
  };
}
