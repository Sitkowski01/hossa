"""Teren, morze, drogi i rynek.

Miasteczko stoi na plaskim (z=0); wzgorza rosna dopiero z dala od drog i zakladow, a na poludniu
teren schodzi plaza do morza. Dzieki temu drogi i budynki nie musza sledzic wysokosci terenu.
"""

import math

import bmesh
import bpy
from mathutils import Vector, noise

from . import kit, materials

SEA_LEVEL = -1.2
HILLS = [((-175, 140), 22, 45), ((-95, 150), 12, 32), ((175, 135), 14, 40), ((185, 20), 8, 30)]


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


class Terrain:
    def __init__(self, layout):
        self.layout = layout
        nodes = {k: Vector(v) for k, v in layout["wezly"].items()}
        self.roads = [(nodes[a], nodes[b], w) for a, b, w in layout["drogi"]]
        self.pads = [(Vector((f["x"], f["y"])), 34) for f in layout["firmy"].values()]

    def flat_mask(self, x, y):
        """1 tam, gdzie teren musi byc plaski (drogi, zaklady), 0 daleko od nich."""
        p = Vector((x, y))
        d = min(_seg_dist(p, a, b) - w / 2 for a, b, w in self.roads)
        d = min([d] + [(p - c).length - r for c, r in self.pads])
        return 1.0 - _smooth((d - 6) / 30)

    def height(self, x, y):
        shore = self.layout["teren"]["brzeg"]
        h = sum(amp * math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)) for (cx, cy), amp, s in HILLS)
        h += 0.8 * noise.noise(Vector((x / 40, y / 40, 0.5)))
        h *= 1.0 - self.flat_mask(x, y)
        if y < shore:
            h = min(h, 0) + self.layout["teren"]["dno"] * _smooth((shore - y) / 22)
        return h

    def build(self, coll, step=2.5):
        (x0, x1), (y0, y1) = self.layout["teren"]["x"], self.layout["teren"]["y"]
        nx, ny = int((x1 - x0) / step), int((y1 - y0) / step)
        bm = bmesh.new()
        grid = [[bm.verts.new((x0 + i * step, y0 + j * step, self.height(x0 + i * step, y0 + j * step))) for i in range(nx + 1)] for j in range(ny + 1)]
        for j in range(ny):
            for i in range(nx):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                f.smooth = True
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            for loop in f.loops:
                loop[uv].uv = ((loop.vert.co.x - x0) / (x1 - x0), (loop.vert.co.y - y0) / (y1 - y0))
        mesh = bpy.data.meshes.new("teren")
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new("teren", mesh)
        coll.objects.link(obj)
        return obj


def sea(layout, coll):
    """Tafla morza tylko w obrebie makiety — dalej jest juz brzeg stolu."""
    (x0, x1), y0 = layout["teren"]["x"], layout["teren"]["y"][0]
    top = layout["teren"]["brzeg"] + 4
    b = kit.Builder()
    b.box((x1 - x0, top - y0, 0.01), ((x0 + x1) / 2, (y0 + top) / 2, SEA_LEVEL), "woda", skip=("bottom",))
    return b.done("morze", coll)


BOTTOM = -12.0


def base(terrain, layout, coll, step=2.5):
    """Boki makiety jak na prawdziwym modelu: przekroj ziemi, slup wody przy morzu i drewniany cokol."""
    (x0, x1), (y0, y1) = layout["teren"]["x"], layout["teren"]["y"]
    ring = [(x, y0) for x in _span(x0, x1, step)] + [(x1, y) for y in _span(y0, y1, step)][1:]
    ring += [(x, y1) for x in reversed(_span(x0, x1, step))][1:] + [(x0, y) for y in reversed(_span(y0, y1, step))][1:]
    b = kit.Builder()
    for (ax, ay), (bx, by) in zip(ring, ring[1:]):
        ha, hb = terrain.height(ax, ay), terrain.height(bx, by)
        quad = [(0, 1, 2, 3)]
        b._add([(ax, ay, BOTTOM), (bx, by, BOTTOM), (bx, by, hb), (ax, ay, ha)], quad, "ziemia_bok", b.place())
        if min(ha, hb) < SEA_LEVEL:
            wa, wb = max(ha, BOTTOM), max(hb, BOTTOM)
            b._add([(ax, ay, wa), (bx, by, wb), (bx, by, SEA_LEVEL), (ax, ay, SEA_LEVEL)], quad, "woda_bok", b.place())
    w, d = x1 - x0, y1 - y0
    b.box((w + 3, d + 3, 2.5), ((x0 + x1) / 2, (y0 + y1) / 2, BOTTOM - 2.5), "drewno")
    b.box((w + 4, d + 4, 0.6), ((x0 + x1) / 2, (y0 + y1) / 2, BOTTOM - 3.1), "drewno")
    return b.done("cokol", coll)


def _span(a, b, step):
    n = int(round((b - a) / step))
    return [a + i * step for i in range(n + 1)]


def roads(layout, coll):
    """Pasy asfaltu miedzy wezlami, przerywana linia na drogach przemyslowych, chodniki w miescie."""
    nodes = {k: Vector((*v, 0)) for k, v in layout["wezly"].items()}
    b = kit.Builder()
    for a_name, b_name, w in layout["drogi"]:
        a, c = nodes[a_name], nodes[b_name]
        d = c - a
        length = d.length
        mid = (a + c) / 2
        angle = math.degrees(math.atan2(d.y, d.x))
        b.box((length + w, w, 0.06), (mid.x, mid.y, 0), "asfalt", rot=angle, skip=("bottom",))
        if w >= 9:
            dashes = int((length - w) / 6)
            for k in range(dashes):
                t = (w / 2 + 3 + k * 6) / length
                if t > 1 - (w / 2 + 1) / length:
                    break
                p = a + d * t
                b.box((3, 0.18, 0.01), (p.x, p.y, 0.06), "bialy", rot=angle, skip=("bottom",))
        else:
            out = Vector((-d.y, d.x, 0)).normalized()
            free = length - w - 3
            if free > 2:
                for side in (-1, 1):
                    p = mid + out * side * (w / 2 + 1.25)
                    b.box((free, 2.5, 0.16), (p.x, p.y, 0), "chodnik", rot=angle, skip=("bottom",))
    return b.done("drogi", coll)


def square(layout, coll):
    r = layout["rynek"]
    b = kit.Builder((r["x"], r["y"], 0))
    b.box((r["szer"], r["dl"], 0.12), (0, 0, 0), "bruk", skip=("bottom",))
    # fontanna: niecka z woda, kolumna i dwie czasze
    b.cyl(5.6, 0.7, (0, 0, 0.12), "beton_sciana", seg=32)
    b.cyl(5.1, 0.02, (0, 0, 0.7), "woda", seg=32)
    b.cyl(0.8, 2.2, (0, 0, 0.72), "beton_sciana", seg=12, r_top=0.5)
    b.cyl(0.6, 0.5, (0, 0, 2.2), "beton_sciana", seg=16, r_top=2.0)
    b.cyl(1.85, 0.02, (0, 0, 2.66), "woda", seg=16)
    b.cyl(0.3, 1.2, (0, 0, 2.7), "beton_sciana", seg=10, r_top=0.15)
    for side in (-1, 1):  # lawki pod szpalerem drzew
        for k in range(5):
            y = -r["dl"] / 2 + 6 + k * (r["dl"] - 12) / 4
            x = side * (r["szer"] / 2 - 5)
            b.box((0.6, 2.0, 0.45), (x, y, 0.12), "drewno")
            b.box((0.12, 2.0, 0.5), (x + side * 0.3, y, 0.57), "drewno")
    return b.done("rynek", coll)
