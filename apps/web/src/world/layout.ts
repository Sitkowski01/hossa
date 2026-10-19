import type { Route } from "../sim/protocol.js";
import type { Vec2 } from "./path.js";

/** Fragment blender/layout.json potrzebny scenie (osie Blendera: x na wschod, y na polnoc). */
export interface Layout {
  readonly wezly: Readonly<Record<string, readonly [number, number]>>;
  readonly drogi: readonly (readonly [string, string, number])[];
  readonly trasy: Readonly<Record<Route, readonly string[]>>;
}

/** Punkt z ukladu Blendera w osiach three.js: x bez zmian, polnoc (+y) to -z. */
export const toScene = ([x, y]: readonly [number, number]): Vec2 => [x, -y];

/** Wezly trasy ciezarowki w osiach sceny, od bramy nadawcy do bramy odbiorcy. */
export function routeNodes(layout: Layout, route: Route): Vec2[] {
  return layout.trasy[route].map((name) => {
    const node = layout.wezly[name];
    if (!node) throw new Error(`Trasa ${route}: nie ma wezla ${name} w layout.json`);
    return toScene(node);
  });
}
