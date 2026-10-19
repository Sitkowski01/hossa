"""Drzewa, latarnie i auta: kilka wzorcow + lista pozycji.

Wzorce ida do GLB raz, a pozycje do makieta.json — przegladarka rysuje je jako InstancedMesh
(jedno wywolanie rysowania na wzorzec zamiast setek obiektow). W Blenderze stawiamy kopie
powiazane tylko do podgladu; eksport ich nie bierze.
"""

import math
import random

import bpy
from mathutils import Vector

from . import houses, kit

TREES = ("drzewo_lisciaste_1", "drzewo_lisciaste_2", "drzewo_iglaste")
CAR_COLOURS = ("czerwony", "granat_grs", "bialy", "stal", "zielony_ksz")


def _blob(b, at, r, mat, seg=10):
    """Kepa lisci: splaszczona kula z pieciu pierscieni."""
    rings = 5
    for k in range(rings):
        a0, a1 = math.pi * (k / rings - 0.5), math.pi * ((k + 1) / rings - 0.5)
        z0, z1 = r * math.sin(a0) * 0.85, r * math.sin(a1) * 0.85
        b.cyl(max(0.05, r * math.cos(a0)), z1 - z0, (at[0], at[1], at[2] + z0), mat, seg=seg, r_top=max(0.05, r * math.cos(a1)), caps=k in (0, rings - 1))


def prototypes(coll):
    made = {}
    for name, leaf in (("drzewo_lisciaste_1", "lisc"), ("drzewo_lisciaste_2", "lisc_jasny")):
        b = kit.Builder()
        b.cyl(0.28, 3.4, (0, 0, 0), "kora", seg=8, r_top=0.18)
        for dx, dy, dz, r in ((0, 0, 5.4, 2.6), (1.3, 0.4, 4.4, 1.8), (-1.1, 0.8, 4.6, 1.9), (0.2, -1.2, 4.3, 1.7), (0.1, 0.2, 6.6, 1.6)):
            _blob(b, (dx, dy, dz), r, leaf)
        made[name] = b.done(name, coll, smooth=True)
    b = kit.Builder()
    b.cyl(0.22, 2.0, (0, 0, 0), "kora", seg=8)
    for k, (z, r) in enumerate(((1.6, 2.4), (3.6, 1.9), (5.4, 1.4), (7.0, 0.9))):
        b.cyl(r, 2.6, (0, 0, z), "iglak", seg=10, r_top=0.15)
    made["drzewo_iglaste"] = b.done("drzewo_iglaste", coll, smooth=True)

    b = kit.Builder()
    b.cyl(0.12, 6.0, (0, 0, 0), "stal_ciemna", seg=8, r_top=0.08)
    b.beam((0, 0, 5.9), (1.2, 0, 6.1), 0.1, "stal_ciemna")
    b.box((0.6, 0.3, 0.18), (1.3, 0, 5.95), "lampa")
    made["latarnia"] = b.done("latarnia", coll)

    for colour in CAR_COLOURS:
        b = kit.Builder()
        b.box((4.3, 1.8, 0.75), (0, 0, 0.3), colour)
        b.box((2.3, 1.65, 0.6), (-0.3, 0, 1.05), "szklo")
        b.box((2.2, 1.66, 0.08), (-0.3, 0, 1.65), colour)
        for sx in (-1.35, 1.35):
            for sy in (-0.85, 0.85):
                b.cyl(0.33, 0.25, (sx, sy + 0.125, 0.33), "guma", seg=10, tilt=("X", 90))  # walec rosnie w -y
        made[f"auto_{colour}"] = b.done(f"auto_{colour}", coll)

    for good, cab, body in (("ruda", "zolty", "rdza"), ("stal", "granat_grs", "stal"), ("maszyny", "czerwony", "bialy")):
        made[f"ciezarowka_{good}"] = _truck(coll, good, cab, body)
    for k, jacket in enumerate(("granat_grs", "czerwony", "zielony_ksz")):
        b = kit.Builder()
        for sy in (-0.12, 0.12):
            b.box((0.18, 0.16, 0.85), (0, sy, 0), "stal_ciemna")
        b.box((0.3, 0.5, 0.65), (0, 0, 0.85), jacket)
        b.cyl(0.13, 0.25, (0, 0, 1.5), "skora", seg=8, r_top=0.11)
        if k == 2:  # strajkujacy z transparentem
            b.box((0.05, 0.05, 1.2), (0.25, 0.2, 0.9), "drewno")
            b.box((0.04, 1.1, 0.6), (0.27, 0.2, 2.0), "bialy")
        made[f"pieszy_{k + 1}"] = b.done(f"pieszy_{k + 1}", coll)
    return made


def _truck(coll, good, cab, body):
    """Ciezarowka 8 m, przod w +x: szoferka, rama, kola i zabudowa zalezna od ladunku."""
    b = kit.Builder()
    b.box((7.6, 2.2, 0.4), (0, 0, 0.7), "stal_ciemna")
    b.box((2.2, 2.4, 2.1), (2.9, 0, 1.0), cab)
    b.box((0.08, 2.0, 0.9), (4.0, 0, 2.0), "szklo")
    b.box((0.9, 2.1, 0.08), (2.0, 0, 3.1), cab)
    for x in (2.9, -1.4, -2.7):
        for y in (-1.05, 1.05):
            b.cyl(0.5, 0.35, (x, y + 0.175, 0.5), "guma", seg=12, tilt=("X", 90))
    if good == "ruda":
        b.box((4.8, 2.4, 1.3), (-1.1, 0, 1.1), body)
        b.box((4.4, 2.0, 0.6), (-1.1, 0, 2.0), "ruda")
    elif good == "stal":
        b.box((5.2, 2.4, 0.2), (-1.0, 0, 1.1), body)
        for x in (-2.6, -1.0, 0.6):
            b.cyl(0.65, 1.6, (x, 0.8, 1.95), "stal", seg=14, tilt=("X", 90))
    else:
        b.box((5.4, 2.5, 2.6), (-1.0, 0, 1.1), body)
        b.box((5.42, 2.52, 0.5), (-1.0, 0, 1.4), "czerwony")
    return b.done(f"ciezarowka_{good}", coll)


def _near_road(p, roads, margin):
    for a, b, w in roads:
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        if (p - (a + ab * t)).length < w / 2 + margin:
            return True
    return False


def scatter(layout, terrain, lots, seed=11):
    """Pozycje: lasy na wzgorzach, szpaler wokol rynku, latarnie i auta wzdluz ulic w miescie."""
    rng = random.Random(seed)
    roads = lots.roads
    trees = {k: [] for k in TREES}
    (x0, x1), (y0, y1) = layout["teren"]["x"], layout["teren"]["y"]
    shore = layout["teren"]["brzeg"]
    grid = {}  # siatka 3 m: sasiednie komorki tez sprawdzamy, wiec pnie stoja co najmniej 3 m od siebie
    for _ in range(16000):
        x, y = rng.uniform(x0 + 4, x1 - 4), rng.uniform(shore + 12, y1 - 4)
        p = Vector((x, y))
        cell = (int(x // 3), int(y // 3))
        if any((cell[0] + i, cell[1] + j) in grid for i in (-1, 0, 1) for j in (-1, 0, 1)):
            continue
        wild = 1 - terrain.flat_mask(x, y)
        town = 0.35 if houses.in_centre(p) else 1.0  # w centrum park, nie las
        if rng.random() > (0.08 + 0.9 * wild) * town or _near_road(p, roads, 3) or not lots.free(p, 0, 3, 3):
            continue
        grid[cell] = True
        kind = "drzewo_iglaste" if terrain.height(x, y) > 6 or rng.random() < 0.3 else rng.choice(TREES[:2])
        trees[kind].append([round(x, 2), round(y, 2), round(terrain.height(x, y), 2), round(rng.uniform(0, 360)), round(rng.uniform(0.75, 1.3), 2)])
    r = layout["rynek"]
    for k in range(6):  # szpaler lip wzdluz dluzszych bokow rynku
        for side in (-1, 1):
            x = r["x"] + side * (r["szer"] / 2 - 2.5)
            y = r["y"] - r["dl"] / 2 + 4 + k * (r["dl"] - 8) / 5
            trees["drzewo_lisciaste_1"].append([x, round(y, 2), 0.12, rng.randint(0, 359), 0.7])

    lamps, cars = [], []
    for a, b, w in roads:
        d = b - a
        along, normal = d.normalized(), Vector((-d.y, d.x)).normalized()
        for k in range(1, int(d.length / 22) + 1):
            p = a + along * (k * 22 - 11)
            side = 1 if k % 2 else -1
            spot = p + normal * side * (w / 2 + 0.6)
            angle = math.degrees(math.atan2(-normal.y * side, -normal.x * side))
            lamps.append([round(spot.x, 2), round(spot.y, 2), round(angle)])
            if w < 9 and rng.random() < 0.45:
                c = p + along * 6 + normal * -side * (w / 2 - 1.2)
                cars.append([round(c.x, 2), round(c.y, 2), round(math.degrees(math.atan2(d.y, d.x))), rng.choice(CAR_COLOURS)])
    return {"drzewa": trees, "latarnie": lamps, "auta": cars}


def preview(coll, made, placed):
    """Kopie powiazane w Blenderze — tylko po to, zeby zobaczyc makiete na zrzutach."""
    def put(name, x, y, z, rot, s=1.0):
        obj = bpy.data.objects.new(f"{name}.kopia", made[name].data)
        obj.location = (x, y, z)
        obj.rotation_euler = (0, 0, math.radians(rot))
        obj.scale = (s, s, s)
        coll.objects.link(obj)

    for kind, items in placed["drzewa"].items():
        for x, y, z, rot, s in items:
            put(kind, x, y, z, rot, s)
    for x, y, rot in placed["latarnie"]:
        put("latarnia", x, y, 0.06, rot)
    for x, y, rot, colour in placed["auta"]:
        put(f"auto_{colour}", x, y, 0.06, rot)
