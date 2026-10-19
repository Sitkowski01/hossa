"""Drobnicowiec przy nabrzezu: kadlub z dziobem, ladownie, dzwigi pokladowe i nadbudowka na rufie.

Srodek obiektu lezy na linii wody, dziob patrzy w +x — scena przesuwa i obraca caly statek.
"""

from . import ground, kit

LENGTH, BEAM = 72.0, 12.0


def _hull_outline(inset=0.0):
    half = BEAM / 2 - inset
    stern, bow = -LENGTH / 2 + inset, LENGTH / 2 - inset
    return [(stern, -half), (bow - 12, -half), (bow - 3, -half * 0.55), (bow, 0), (bow - 3, half * 0.55), (bow - 12, half), (stern, half)]


def build(layout, coll):
    x, y = layout["statek"]["nabrzeze"]
    b = kit.Builder((x, y, ground.SEA_LEVEL))
    b.prism(_hull_outline(), -3.2, 3.2, "czerwony", top_mat="czerwony")  # podwodzie
    b.prism(_hull_outline(), 0.0, 0.25, "bialy", top_mat="bialy")  # pas wodnicy
    b.prism(_hull_outline(), 0.25, 4.6, "granat_grs", top_mat="stal_ciemna")
    b.prism(_hull_outline(0.3), 4.85, 0.9, "granat_grs", top_mat="stal_ciemna")  # nadburcie
    for k, hx in enumerate((-10, 4, 18)):  # pokrywy ladowni
        b.box((11, 8.4, 1.2), (hx, 0, 4.85), "zielony_ksz")
        for r in range(5):
            b.box((0.15, 8.5, 1.25), (hx - 4.4 + r * 2.2, 0, 4.85), "stal_ciemna")
    for cx in (-3, 11):  # dzwigi pokladowe miedzy ladowniami
        b.cyl(0.9, 7, (cx, 0, 4.85), "zolty", seg=12)
        b.box((2.2, 2.2, 1.6), (cx, 0, 11.85), "zolty")
        b.beam((cx, 0, 12.6), (cx + 12, 0, 17), 0.6, "zolty")
    sx = -LENGTH / 2 + 6  # nadbudowka na rufie
    for level, (w, h) in enumerate(((11, 3), (10, 2.8), (9, 2.8), (10.5, 2.6))):
        z = 4.85 + sum(hh for _, hh in ((11, 3), (10, 2.8), (9, 2.8), (10.5, 2.6))[:level])
        b.box((8, w, h), (sx, 0, z), "bialy")
        b.windows((sx - 4, -w / 2), (sx + 4, -w / 2), z + 0.8, 1, 4, (1.0, 1.0), "okna", frame="bialy")
        b.windows((sx + 4, -w / 2), (sx + 4, w / 2), z + 0.8, 1, 5, (1.0, 1.0), "okna", frame="bialy")
    bridge_top = 4.85 + 3 + 2.8 + 2.8 + 2.6
    b.box((12.5, 0.4, 0.4), (sx + 2, 0, bridge_top), "bialy", rot=90)
    b.box((3.4, 4.2, 5.0), (sx - 2.5, 0, bridge_top), "bialy")
    b.box((3.5, 4.3, 1.4), (sx - 2.5, 0, bridge_top + 5.0), "czerwony")
    b.box((3.6, 4.4, 0.5), (sx - 2.5, 0, bridge_top + 6.4), "guma")
    b.cyl(0.15, 6, (sx + 1, 0, bridge_top), "bialy", seg=8)
    b.cyl(0.15, 9, (LENGTH / 2 - 6, 0, 5.75), "bialy", seg=8)  # maszt na dziobie
    obj = b.done("statek", coll)
    kit.attach(kit.empty("statek_komin", (x + sx - 2.5, y, ground.SEA_LEVEL + bridge_top + 7), coll), obj)
    return obj
