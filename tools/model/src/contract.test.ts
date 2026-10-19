/**
 * Kontrakt makiety ze scena: GLB z Blendera musi miec obiekty i punkty zaczepienia, po ktorych
 * scena w przegladarce szuka kominow, dzwigow i bram, a trasy ciezarowek z layout.json musza
 * zaczynac sie i konczyc przy bramach zakladow. Model powstaje skryptem, wiec bez tych testow
 * zmiana w Blenderze mogla po cichu zepsuc animacje.
 */
import { type Document, type Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

interface Company { x: number; y: number; obszar: [number, number] }
interface Layout {
  teren: { x: [number, number]; y: [number, number]; brzeg: number };
  firmy: Record<string, Company>;
  wezly: Record<string, [number, number]>;
  drogi: [string, string, number][];
  trasy: Record<string, string[]>;
  statek: { nabrzeze: [number, number] };
}
interface Instances {
  drzewa: Record<string, [number, number, number, number, number][]>;
  latarnie: [number, number, number][];
  auta: [number, number, number, string][];
}

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const layout = JSON.parse(readFileSync(repo("blender/layout.json"), "utf8")) as Layout;
const instances = JSON.parse(readFileSync(repo("apps/web/public/makieta.json"), "utf8")) as Instances;
const GLB = repo("apps/web/public/makieta.glb");

const TICKERS = ["RUD", "STW", "MTK", "BPT", "KSZ", "GRS", "GIELDA"];
const ANIMATED = [
  "RUD_kolo_1", "RUD_kolo_2", "RUD_halda", "STW_ruda", "STW_suwnica", "MTK_wyroby", "BPT_stal", "BPT_maszyny",
  "BPT_dzwig_1_obrot", "BPT_dzwig_2_obrot", "BPT_dzwig_3_obrot", "statek", "GIELDA_led",
];
const ANCHORS = [
  "STW_dym_1", "STW_dym_2", "MTK_dym", "STW_spust", "BPT_latarnia", "statek_komin", "GIELDA_kurs",
  "RUD_zaladunek", "STW_rozladunek", "STW_zaladunek", "MTK_rozladunek", "MTK_zaladunek", "BPT_rozladunek",
];
const PROTOTYPES = [
  "drzewo_lisciaste_1", "drzewo_lisciaste_2", "drzewo_iglaste", "latarnia",
  "ciezarowka_ruda", "ciezarowka_stal", "ciezarowka_maszyny", "pieszy_1", "pieszy_2", "pieszy_3",
  "auto_czerwony", "auto_granat_grs", "auto_bialy", "auto_stal", "auto_zielony_ksz",
];
const LOADS: Record<string, [string, string]> = {
  "RUD-STW": ["RUD_zaladunek", "STW_rozladunek"],
  "STW-MTK": ["STW_zaladunek", "MTK_rozladunek"],
  "STW-BPT": ["STW_zaladunek", "BPT_rozladunek"],
  "MTK-BPT": ["MTK_zaladunek", "BPT_rozladunek"],
};

let doc: Document;
let nodes: Map<string, Node>;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  doc = await io.read(GLB);
  nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
});

/** Polozenie wezla w ukladzie Blendera (glTF ma os y do gory: x, z, -y). */
const at = (name: string) => {
  const node = nodes.get(name);
  if (node === undefined) throw new Error(`brak wezla ${name}`);
  const [x, y, z] = node.getWorldTranslation();
  return { x, y: -z, z: y };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const node = (key: string) => {
  const [x, y] = layout.wezly[key] ?? [Number.NaN, Number.NaN];
  return { x, y };
};
const segment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
};
/** Odleglosc od krawedzi najblizszej jezdni (ujemna = punkt na asfalcie); liczy szerokosc kazdej drogi. */
const fromAsphalt = (p: { x: number; y: number }) =>
  Math.min(...layout.drogi.map(([a, b, w]) => segment(p, node(a), node(b)) - w / 2));

describe("paczka dla przegladarki", () => {
  it("miesci sie w budzecie 15 MB", () => {
    expect(statSync(GLB).size).toBeLessThan(15 * 1024 * 1024);
  });

  it("ma tekstury WebP i siatki skompresowane meshopt", () => {
    const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    expect(used).toEqual(expect.arrayContaining(["EXT_meshopt_compression", "EXT_texture_webp"]));
    for (const texture of doc.getRoot().listTextures()) expect(texture.getMimeType()).toBe("image/webp");
  });

  it("teren zachowuje pelna rozdzielczosc tekstury", () => {
    const terrain = doc.getRoot().listTextures().find((t) => t.getName().startsWith("teren"));
    expect(terrain?.getSize()?.[0]).toBeGreaterThanOrEqual(4096);
  });

  it("pas notowan ma wspolrzedne UV, na ktorych scena narysuje kursy", () => {
    const strip = nodes.get("GIELDA_led")?.getMesh()?.listPrimitives()[0];
    expect(strip?.getAttribute("TEXCOORD_0")).toBeTruthy();
  });
});

describe("obiekty, po ktorych scena szuka elementow makiety", () => {
  it("kazda spolka ma swoj budynek i miejsce na tabliczke kursu", () => {
    for (const t of TICKERS) {
      expect(nodes.get(t)?.getMesh(), t).toBeTruthy();
      expect(nodes.has(`${t}_kurs`), `${t}_kurs`).toBe(true);
    }
  });

  it("ruchome czesci i wzorce do instancji sa osobnymi siatkami w skali 1", () => {
    for (const name of [...ANIMATED, ...PROTOTYPES]) {
      expect(nodes.get(name)?.getMesh(), name).toBeTruthy();
      expect(nodes.get(name)?.getScale(), name).toEqual([1, 1, 1]);
    }
  });

  it("wzorce leza w poczatku ukladu, a wysiegnik zurawia obraca sie nad portalem", () => {
    for (const name of PROTOTYPES) expect(nodes.get(name)?.getTranslation(), name).toEqual([0, 0, 0]);
    for (const n of ["1", "2", "3"]) {
      const local = nodes.get(`BPT_dzwig_${n}_obrot`)?.getTranslation() ?? [];
      expect(local.map((v) => Math.round(v * 100) / 100)).toEqual([0, 10, 0]);
    }
  });

  it("punkty zaczepienia sa pustymi wezlami (bez siatki)", () => {
    for (const name of ANCHORS) {
      expect(nodes.has(name), name).toBe(true);
      expect(nodes.get(name)?.getMesh(), name).toBeNull();
    }
  });

  it("dym wylatuje wysoko nad zakladami, a statek stoi przy nabrzezu", () => {
    for (const name of ["STW_dym_1", "STW_dym_2", "MTK_dym"]) expect(at(name).z).toBeGreaterThan(20);
    const [x, y] = layout.statek.nabrzeze;
    expect(dist(at("statek"), { x, y })).toBeLessThan(0.01);
  });
});

describe("trasy ciezarowek i drogi", () => {
  const roads = new Set(layout.drogi.flatMap(([a, b]) => [`${a}>${b}`, `${b}>${a}`]));

  it.each(Object.entries(layout.trasy))("%s jedzie tylko po istniejacych drogach", (_, path) => {
    for (let i = 1; i < path.length; i++) expect(roads.has(`${path[i - 1] ?? ""}>${path[i] ?? ""}`)).toBe(true);
  });

  it.each(Object.entries(layout.trasy))("%s zaczyna sie przy bramie nadawcy i konczy przy bramie odbiorcy", (route, path) => {
    const [from, to] = route.split("-") as [string, string];
    expect(dist(node(path[0] ?? ""), at(`${from}_brama`))).toBeLessThan(12);
    expect(dist(node(path.at(-1) ?? ""), at(`${to}_brama`))).toBeLessThan(12);
  });

  it.each(Object.entries(LOADS))("%s laduje i rozladowuje na terenie zakladow", (route, [load, unload]) => {
    const [from, to] = route.split("-") as [string, string];
    for (const [anchor, company] of [[load, from], [unload, to]] as const) {
      const c = layout.firmy[company] as Company;
      const p = at(anchor);
      expect(Math.abs(p.x - c.x), anchor).toBeLessThan(c.obszar[0] / 2);
      expect(Math.abs(p.y - c.y), anchor).toBeLessThan(c.obszar[1] / 2);
    }
  });

  it.each(Object.entries(layout.firmy))("jezdnia nie wjezdza na teren %s glebiej niz do bramy", (key, c) => {
    const inside = (x: number, y: number) => Math.abs(x - c.x) < c.obszar[0] / 2 - 3 && Math.abs(y - c.y) < c.obszar[1] / 2 - 3;
    for (const [a, b, w] of layout.drogi) {
      const pa = node(a);
      const pb = node(b);
      const len = dist(pa, pb);
      const nx = -(pb.y - pa.y) / len;
      const ny = (pb.x - pa.x) / len;
      for (let s = 0; s <= len; s += 1) {
        for (const side of [-w / 2, 0, w / 2]) {
          const x = pa.x + ((pb.x - pa.x) * s) / len + nx * side;
          const y = pa.y + ((pb.y - pa.y) * s) / len + ny * side;
          expect(inside(x, y), `${a}-${b} na terenie ${key}`).toBe(false);
        }
      }
    }
  });
});

describe("instancje z makieta.json", () => {
  const trees = Object.values(instances.drzewa).flat();

  it("drzew jest dosc na las, a kazde rosnie na makiecie i poza jezdnia", () => {
    expect(trees.length).toBeGreaterThan(500);
    const [x0, x1] = layout.teren.x;
    const [, y1] = layout.teren.y;
    for (const [x, y] of trees) {
      expect(x).toBeGreaterThan(x0);
      expect(x).toBeLessThan(x1);
      expect(y).toBeGreaterThan(layout.teren.brzeg);
      expect(y).toBeLessThan(y1);
      expect(fromAsphalt({ x, y }), `drzewo ${String(x)},${String(y)}`).toBeGreaterThan(0);
    }
  });

  it("drzewa nie rosna jedno w drugim", () => {
    const sorted = [...trees].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length; i++) {
      const [xi = 0, yi = 0] = sorted[i] ?? [];
      for (let j = i + 1; j < sorted.length && (sorted[j]?.[0] ?? Infinity) - xi < 2; j++) {
        const [xj = 0, yj = 0] = sorted[j] ?? [];
        expect(Math.hypot(xi - xj, yi - yj)).toBeGreaterThan(2);
      }
    }
  });

  it("latarnie stoja na poboczu, a zaparkowane auta na jezdni", () => {
    for (const [x, y] of instances.latarnie) {
      expect(fromAsphalt({ x, y })).toBeGreaterThan(-0.01);
      expect(fromAsphalt({ x, y })).toBeLessThan(2);
    }
    for (const [x, y] of instances.auta) expect(fromAsphalt({ x, y })).toBeLessThan(0);
  });

  it("drzewa i latarnie nie stoja na terenie firm", () => {
    for (const [x, y] of [...trees, ...instances.latarnie]) {
      for (const [key, c] of Object.entries(layout.firmy)) {
        const inside = Math.abs(x - c.x) < c.obszar[0] / 2 && Math.abs(y - c.y) < c.obszar[1] / 2;
        expect(inside, `${String(x)},${String(y)} na terenie ${key}`).toBe(false);
      }
    }
  });
});
