import { describe, expect, it } from "vitest";
import layoutJson from "../../../../blender/layout.json";
import type { Route } from "../sim/protocol.js";
import { routeNodes, toScene, type Layout } from "./layout.js";

const layout = layoutJson as unknown as Layout;
const ROUTES: Route[] = ["RUD-STW", "STW-MTK", "STW-BPT", "MTK-BPT"];

describe("layout.json — trasy dla sceny", () => {
  it("polnoc z Blendera to -z w three.js", () => {
    expect(toScene([10, 20])).toEqual([10, -20]);
  });

  it.each(ROUTES)("trasa %s prowadzi po istniejacych drogach", (route) => {
    const nodes = layout.trasy[route];
    const roads = new Set(layout.drogi.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    for (let i = 1; i < nodes.length; i++) expect(roads.has(`${nodes[i - 1] ?? ""}|${nodes[i] ?? ""}`)).toBe(true);
    expect(routeNodes(layout, route)).toHaveLength(nodes.length);
  });

  it("trasa z kopalni do huty zaczyna sie przy bramie kopalni", () => {
    expect(routeNodes(layout, "RUD-STW")[0]).toEqual(toScene(layout.wezly.kopalnia_brama as [number, number]));
  });

  it("nieznany wezel to czytelny blad, a nie ciezarowka w punkcie (0, 0)", () => {
    const broken = { ...layout, trasy: { ...layout.trasy, "RUD-STW": ["kopalnia_brama", "nie_ma"] } } as Layout;
    expect(() => routeNodes(broken, "RUD-STW")).toThrow("nie ma wezla nie_ma");
  });
});
