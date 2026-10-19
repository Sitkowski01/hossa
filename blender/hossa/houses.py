"""Zabudowa mieszkalna: kamienice w centrum i domki na obrzezach, ustawiane wzdluz ulic.

Dzialki szukamy automatycznie: idziemy wzdluz kazdej drogi po obu stronach i stawiamy dom
frontem do ulicy, jesli nie wchodzi na jezdnie, rynek, teren firmy ani na sasiada. Ziarno
losowania jest stale, wiec makieta za kazdym razem wyglada tak samo.
"""

import math
import random

from mathutils import Vector

from . import kit

CENTRE = ((-88, 105), (-50, 100))  # zakresy (x0, x1), (y0, y1): tu kamienice, dalej domki
FACADES = ["tynk_zolty", "tynk_rozowy", "tynk_mietowy", "tynk_niebieski", "tynk_ceglasty", "tynk_bialy", "cegla", "tynk", "tynk_szary", "cegla_ciemna"]
ROOFS = ["dachowka", "dach_szary"]


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


class Lots:
    def __init__(self, layout):
        nodes = {k: Vector(v) for k, v in layout["wezly"].items()}
        self.roads = [(nodes[a], nodes[b], w) for a, b, w in layout["drogi"]]
        self.blocked = []
        for f in layout["firmy"].values():
            w, d = f["obszar"]
            self.blocked.append((f["x"] - w / 2, f["x"] + w / 2, f["y"] - d / 2, f["y"] + d / 2))
        for o in layout.get("przeszkody", []):
            self.blocked.append((o["x"] - o["r"], o["x"] + o["r"], o["y"] - o["r"], o["y"] + o["r"]))
        r = layout["rynek"]
        self.blocked.append((r["x"] - r["szer"] / 2, r["x"] + r["szer"] / 2, r["y"] - r["dl"] / 2, r["y"] + r["dl"] / 2))
        (x0, x1), (y0, y1) = layout["teren"]["x"], layout["teren"]["y"]
        self.bounds = (x0 + 6, x1 - 6, layout["teren"]["brzeg"] + 14, y1 - 6)
        self.taken = []

    def _samples(self, c, rot, w, d, pad=0.0):
        """Siatka 5x5 punktow na prostokacie domu (narozniki, srodki bokow i wnetrze)."""
        a = math.radians(rot)
        ux, uy = Vector((math.cos(a), math.sin(a))), Vector((-math.sin(a), math.cos(a)))
        hw, hd = w / 2 + pad, d / 2 + pad
        return [c + ux * sx * hw + uy * sy * hd for sx in (-1, -0.5, 0, 0.5, 1) for sy in (-1, -0.5, 0, 0.5, 1)]

    def free(self, c, rot, w, d):
        pts = self._samples(c, rot, w, d)
        x0, x1, y0, y1 = self.bounds
        if any(not (x0 < p.x < x1 and y0 < p.y < y1) for p in pts):
            return False
        if any(_seg_dist(p, a, b) < rw / 2 + 2.6 for p in pts for a, b, rw in self.roads):
            return False
        if any(r[0] < p.x < r[1] and r[2] < p.y < r[3] for p in pts for r in self.blocked):
            return False
        reach = math.hypot(w, d) / 2
        return all((c - oc).length > reach + math.hypot(ow, od) / 2 + 1.0 or not _overlap(pts, oc, orot, ow, od) for oc, orot, ow, od in self.taken)

    def take(self, c, rot, w, d):
        self.taken.append((c, rot, w, d))


def _overlap(pts, c, rot, w, d):
    a = math.radians(-rot)
    for p in pts:
        q = p - c
        x = q.x * math.cos(a) - q.y * math.sin(a)
        y = q.x * math.sin(a) + q.y * math.cos(a)
        if abs(x) < w / 2 + 0.8 and abs(y) < d / 2 + 0.8:
            return True
    return False


def in_centre(p):
    (x0, x1), (y0, y1) = CENTRE
    return x0 < p.x < x1 and y0 < p.y < y1


def tenement(b, c, rot, w, d, floors, rng):
    """Kamienica: cokol, okna na pietrach, gzyms, dach spadzisty albo plaski z attyka."""
    m = kit.Builder.place((c.x, c.y, 0), rot)
    loc = lambda x, y, z=0.0: tuple((m @ Vector((x, y, z))))  # noqa: E731
    facade = rng.choice(FACADES)
    h = floors * 3.2 + 0.8
    b.box((w, d, h), loc(0, 0), facade, rot=rot, skip=("bottom",))
    b.box((w + 0.1, d + 0.1, 0.9), loc(0, 0), "beton_sciana", rot=rot, skip=("bottom",))
    cols = max(2, int(w / 3.2))
    glass = "okna" if rng.random() < 0.55 else "okna_ciemne"
    for side in (-1, 1):
        a, e = (-w / 2, side * d / 2), (w / 2, side * d / 2)
        if side == 1:
            a, e = e, a
        b.windows(loc(*a)[:2], loc(*e)[:2], 4.0, floors - 1, cols, (1.3, 1.9), glass, frame="bialy")
    b.box((w + 0.3, d + 0.3, 0.3), loc(0, 0, 3.7), "beton_sciana", rot=rot)  # gzyms nad parterem
    if floors > 3 and rng.random() < 0.45:  # balkony na srodkowej osi
        for f in range(1, floors - 1):
            z = 4.0 + f * 3.2 - 0.25
            b.box((2.6, 1.1, 0.15), loc(0, -d / 2 - 0.55, z), "beton_sciana", rot=rot)
            b.box((2.6, 0.05, 1.0), loc(0, -d / 2 - 1.08, z + 0.15), "stal_ciemna", rot=rot)
    if rng.random() < 0.7:  # parter z witryna sklepu
        b.box((w - 1.6, 0.15, 2.4), loc(0, -d / 2 - 0.07, 0.9), "szklo", rot=rot, skip=("back",))
        b.box((w - 1.2, 1.4, 0.15), loc(0, -d / 2 - 0.7, 3.3), rng.choice(["czerwony", "zielony_ksz", "granat_grs", "drewno"]), rot=rot)
    else:
        b.windows(loc(-w / 2, -d / 2)[:2], loc(w / 2, -d / 2)[:2], 1.3, 1, cols, (1.3, 1.9), glass, frame="bialy")
    b.box((w + 0.5, d + 0.5, 0.45), loc(0, 0, h), "beton_sciana", rot=rot)
    if rng.random() < 0.6:
        roof = rng.choice(ROOFS)
        b.gable((w + 0.6, d + 0.8, rng.uniform(3.0, 4.5)), loc(0, 0, h + 0.45), roof, rot=rot, gable_mat=facade)
        for x in [x for x in (-w / 4, w / 4) if rng.random() < 0.5]:  # lukarny od ulicy
            b.box((1.8, 2.0, 1.7), loc(x, -d / 4 - 0.6, h + 0.45), facade, rot=rot)
            b.box((1.0, 0.1, 0.9), loc(x, -d / 4 - 1.62, h + 0.85), glass, rot=rot, skip=("back",))
            b.gable((2.2, 2.2, 0.8), loc(x, -d / 4 - 0.6, h + 2.15), roof, rot=rot + 90)
    else:
        b.box((w, d, 0.05), loc(0, 0, h + 0.45), "papa", rot=rot)
        b.box((w + 0.3, 0.3, 1.0), loc(0, -d / 2, h + 0.45), facade, rot=rot)
    for k in range(rng.randint(1, 2)):
        b.box((0.7, 0.7, 2.0), loc(rng.uniform(-w / 3, w / 3), rng.uniform(0.5, d / 4), h + 2.0), "cegla", rot=rot)


def cottage(b, c, rot, rng):
    m = kit.Builder.place((c.x, c.y, 0), rot)
    loc = lambda x, y, z=0.0: tuple((m @ Vector((x, y, z))))  # noqa: E731
    facade = rng.choice(["tynk_bialy", "tynk", "tynk_zolty", "tynk_szary"])
    b.box((9, 8, 5.6), loc(0, 0), facade, rot=rot, skip=("bottom",))
    b.box((9.1, 8.1, 0.5), loc(0, 0), "beton_sciana", rot=rot, skip=("bottom",))
    glass = "okna" if rng.random() < 0.5 else "okna_ciemne"
    b.windows(loc(-4.5, -4)[:2], loc(4.5, -4)[:2], 1.0, 2, 3, (1.2, 1.4), glass, frame="bialy", row_h=2.8)
    b.windows(loc(4.5, 4)[:2], loc(-4.5, 4)[:2], 1.0, 2, 3, (1.2, 1.4), glass, frame="bialy", row_h=2.8)
    b.box((1.2, 0.15, 2.2), loc(0, -4.07, 0), "drewno", rot=rot, skip=("back",))
    b.gable((10.2, 9.4, 3.8), loc(0, 0, 5.6), rng.choice(ROOFS), rot=rot, gable_mat=facade)
    b.box((0.7, 0.7, 2.2), loc(2.5, 1.5, 7.2), "cegla", rot=rot)


def build(layout, coll, seed=7):
    rng = random.Random(seed)
    lots = Lots(layout)
    town, suburbs = kit.Builder(), kit.Builder()
    for a, e, w in lots.roads:
        d = e - a
        length = d.length
        along = d.normalized()
        for side in (-1, 1):
            normal = Vector((-along.y, along.x)) * side
            rot = math.degrees(math.atan2(normal.y, normal.x)) - 90  # front (-y domu) do ulicy
            s = w / 2 + 4
            while s < length - w / 2 - 4:
                p = a + along * s
                if in_centre(p):
                    hw, hd = rng.uniform(10, 14), rng.uniform(11, 13)
                    c = p + normal * (w / 2 + 2.8 + hd / 2)
                    if lots.free(c, rot, hw, hd):
                        tenement(town, c, rot, hw, hd, rng.randint(3, 5), rng)
                        lots.take(c, rot, hw, hd)
                        s += hw + 0.2
                        continue
                else:
                    c = p + normal * (w / 2 + 7 + 4)
                    if w < 9 and lots.free(c, rot, 9, 8):
                        cottage(suburbs, c, rot, rng)
                        lots.take(c, rot, 9, 8)
                        s += 9 + rng.uniform(5, 9)
                        continue
                s += 2.0
    return town.done("domy_centrum", coll), suburbs.done("domy_przedmiescie", coll), lots
