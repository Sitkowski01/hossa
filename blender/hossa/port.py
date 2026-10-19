"""Baltport: nabrzeze z zurawiami portalowymi, magazyny, kontenery, falochron z latarnia i statek.

Zurawie i statek to osobne obiekty: scena obraca wysiegniki przy zaladunku i wyprowadza
statek w morze, gdy odplywa z towarem (Logistics.ship).
"""

import math

from . import ground, kit

QUAY_TOP = 0.3


def _crane(coll, at, n, rot):
    """Zuraw portalowy na szynach: portal, obrotnica z maszynownia i wysiegnik w strone morza."""
    base = kit.Builder(at, rot)
    for sx in (-3.5, 3.5):
        for sy in (-4, 4):
            base.beam((sx, sy, 0), (sx * 0.5, sy * 0.4, 9), 0.6, "zolty")
    base.box((5, 5, 1.0), (0, 0, 9), "zolty")
    portal = base.done(f"BPT_dzwig_{n}", coll)
    top = kit.Builder((at[0], at[1], at[2] + 10), rot)
    top.cyl(2.2, 0.6, (0, 0, 0), "stal_ciemna", seg=16)
    top.box((4.4, 6, 4), (0, 1.8, 0.6), "zolty")
    top.box((4.6, 6.2, 0.3), (0, 1.8, 4.6), "czerwony")
    top.box((1.8, 0.1, 1.2), (1.0, -1.25, 2.6), "okna", skip=("back",))
    top.beam((-1.2, 3, 4.6), (0, 0.5, 11), 0.45, "zolty")
    top.beam((1.2, 3, 4.6), (0, 0.5, 11), 0.45, "zolty")
    tip = (0, -26, 15)
    for sx in (-0.8, 0.8):
        top.beam((sx, -0.5, 3), (0, tip[1], tip[2]), 0.5, "zolty")
    top.beam((0, 0.5, 11), (0, tip[1], tip[2] + 0.4), 0.12, "stal_ciemna")
    top.beam((0, tip[1], tip[2]), (0, tip[1], 4), 0.06, "stal_ciemna")  # lina z hakiem
    top.box((0.8, 0.8, 0.6), (0, tip[1], 3.4), "stal_ciemna")
    turning = top.done(f"BPT_dzwig_{n}_obrot", coll)
    kit.attach(turning, portal)
    return portal


def _warehouse(b, x, y, w, d):
    b.box((w, d, 8), (x, y, 0), "cegla", skip=("bottom",))
    b.gable((w + 0.6, d + 0.8, 3.6), (x, y, 8), "dach_szary", gable_mat="cegla")
    b.windows((x - w / 2, y + d / 2), (x + w / 2, y + d / 2), 4.5, 1, int(w / 4), (1.2, 1.6), "okna_ciemne", frame="bialy")
    for k in range(int(w / 9)):
        b.box((4, 0.2, 4.5), (x - w / 2 + 5 + k * 9, y - d / 2 - 0.1, 0), "drewno", skip=("back",))


def build(layout, coll):
    at, rot, _, _ = kit.site(layout, "BPT")
    b = kit.Builder((at[0], at[1], QUAY_TOP), rot)  # z lokalne liczone od pokladu nabrzeza
    sea = ground.SEA_LEVEL - QUAY_TOP
    b.box((140, 34, 8), (0, 3, -8), "beton_sciana", skip=("bottom",))
    b.box((140, 33.6, 0.02), (0, 3.2, 0), "beton", skip=("bottom",))
    b.box((140, 0.4, 0.04), (0, -13.6, 0), "zolty")
    for k in range(18):  # polery i odbijacze co 8 m
        x = -68 + k * 8
        b.cyl(0.35, 0.6, (x, -12.8, 0), "stal_ciemna", seg=10, r_top=0.45)
        b.box((1.2, 0.5, 2.2), (x + 4, -14.2, sea - 0.6), "guma")
    for y in (-11, -3):
        b.box((140, 0.25, 0.12), (0, y, 0), "stal")

    _warehouse(b, -40, 12, 36, 12)
    _warehouse(b, 6, 12, 30, 12)
    palette = ["czerwony", "granat_grs", "zielony_ksz", "zolty", "stal", "czerwony"]
    for r in range(3):  # kontenery w stosach
        for c in range(4):
            for z in range(1 + (r + c) % 3):
                b.box((6.06, 2.44, 2.59), (30 + c * 6.4, 8 + r * 2.7, z * 2.6), palette[(r * 4 + c + z) % 6])

    # kapitanat z wiezyczka
    b.box((9, 8, 7), (58, 12, 0), "tynk", skip=("bottom",))
    b.windows((53.5, 8), (62.5, 8), 1.4, 2, 3, (1.4, 1.6), "okna", frame="bialy")
    b.box((4, 4, 4), (60, 13, 7), "tynk")
    b.box((4.4, 4.4, 1.6), (60, 13, 11), "szklo")
    b.box((5, 5, 0.3), (60, 13, 12.6), "czerwony")
    obj = b.done("BPT", coll)

    # falochron z latarnia na koncu
    fb = kit.Builder(b.world((74, -12, -QUAY_TOP)), rot)
    end = (22, -30)
    angle = math.degrees(math.atan2(end[1], end[0]))
    length = math.hypot(*end)
    crest = ground.SEA_LEVEL + 2.6
    fb.box((length + 4, 7, crest + 6), (end[0] / 2, end[1] / 2, -6), "kamien", rot=angle)
    fb.cyl(4.2, 1.0, (end[0], end[1], crest), "beton_sciana", seg=20)
    lx, ly, lz = end[0], end[1], crest + 1.0
    for k in range(5):
        fb.cyl(1.8 - 0.1 * k, 2.6, (lx, ly, lz + 2.6 * k), "czerwony" if k % 2 == 0 else "bialy", seg=16, r_top=1.7 - 0.1 * k)
    fb.cyl(1.6, 1.8, (lx, ly, lz + 13), "szklo", seg=12)
    fb.cyl(1.9, 1.0, (lx, ly, lz + 14.8), "czerwony", seg=12, r_top=0.2)
    fb.done("BPT_falochron", coll)
    kit.empty("BPT_latarnia", b.world((74 + lx, -12 + ly, lz + 13.9 - QUAY_TOP)), coll)

    cranes = [_crane(coll, b.world((x, -7, 0)), i + 1, rot) for i, x in enumerate((-30, -2, 26))]

    sb = kit.Builder(b.world((-52, 2, 0)), rot)
    for r in range(3):
        for c in range(4):
            sb.box((3.2, 1.6, 0.9), (c * 3.6, r * 2.0, 0), "stal")
            sb.box((3.2, 1.6, 0.9), (c * 3.6, r * 2.0, 0.9), "stal_ciemna")
    steel = sb.done("BPT_stal", coll)
    mb = kit.Builder(b.world((-52, -6, 0)), rot)
    for r in range(2):
        for c in range(4):
            mb.box((2.2, 1.6, 1.5), (c * 2.6, r * 2.2, 0), "drewno")
    machines = mb.done("BPT_maszyny", coll)

    kit.empty("BPT_kurs", b.world((0, 12, 24)), coll)
    kit.empty("BPT_rozladunek", b.world((-40, 4, 0)), coll)
    kit.empty("BPT_brama", b.world((-20, 20, -QUAY_TOP)), coll)
    return obj, cranes, steel, machines
