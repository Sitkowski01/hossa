"""Kopalnia Rudawa: wieza szybowa z kolami linowymi, nadszybie, maszynownia, tasmociag i zwaly rudy.

Kola linowe i zwal rudy to osobne obiekty — scena kreci kolami, gdy kopalnia wydobywa,
i podnosi zwal razem z zapasem rudy (Stocks.mineOre).
"""

import math

from . import kit


def _lattice(b, base, top, z0, z1, legs_mat, levels=8):
    """Kratownica o przekroju kwadratu: cztery nogi, poziome pierscienie i krzyzulce."""
    def corner(i, z):
        t = (z - z0) / (z1 - z0)
        half = base / 2 + (top / 2 - base / 2) * t
        sx, sy = ((-1, -1), (1, -1), (1, 1), (-1, 1))[i]
        return (sx * half, sy * half, z)

    for i in range(4):
        b.beam(corner(i, z0), corner(i, z1), 0.45, legs_mat)
    for k in range(levels + 1):
        z = z0 + (z1 - z0) * k / levels
        for i in range(4):
            b.beam(corner(i, z), corner((i + 1) % 4, z), 0.25, legs_mat)
        if k < levels:
            zn = z0 + (z1 - z0) * (k + 1) / levels
            for i in range(4):
                b.beam(corner(i, z), corner((i + 1) % 4, zn), 0.18, legs_mat)


def _wheel(b, r, at, mat):
    """Kolo linowe stojace w plaszczyznie x-z: obrecz z belek i szprychy."""
    seg = 20
    pts = [(at[0] + r * math.cos(2 * math.pi * i / seg), at[1], at[2] + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    for i in range(seg):
        b.beam(pts[i], pts[(i + 1) % seg], 0.3, mat)
    for i in range(0, seg, 4):
        b.beam(at, pts[i], 0.14, mat)


def build(layout, coll):
    at, rot, w, d = kit.site(layout, "RUD")
    b = kit.Builder(at, rot)
    b.box((w - 4, d - 4, 0.05), (0, 0, 0), "zwir", skip=("bottom",))

    # nadszybie i wieza nad szybem
    tower = (-10, 6)
    b.box((12, 12, 9), (tower[0], tower[1], 0), "cegla", skip=("bottom",))
    b.gable((12.6, 12.6, 3), (tower[0], tower[1], 9), "blacha_rdza", gable_mat="cegla")
    b.windows((tower[0] - 6, tower[1] - 6), (tower[0] + 6, tower[1] - 6), 2.5, 2, 3, (1.4, 2.2), "okna_ciemne", frame="bialy")
    tb = kit.Builder(b.world((tower[0], tower[1], 0)), rot)
    _lattice(tb, 7, 4, 9, 32, "czerwony")
    tb.box((5.5, 5.5, 0.4), (0, 0, 32), "stal_ciemna")
    for side in (-1, 1):  # zastrzaly wiezy w strone maszynowni
        tb.beam((9, side * 3, 0), (2, side * 2, 30), 0.5, "czerwony")
    tower_obj = tb.done("RUD_wieza", coll)
    for i, y in enumerate((-1.2, 1.2)):  # kola w plaszczyznie lin, ktore biegna do maszynowni (+x)
        wb = kit.Builder(b.world((tower[0], tower[1] + y, 34.6)), rot)
        _wheel(wb, 2.6, (0, 0, 0), "stal_ciemna")
        wheel = wb.done(f"RUD_kolo_{i + 1}", coll)
        kit.attach(wheel, tower_obj)

    # maszynownia z liniami do kol
    hoist = (14, 6)
    b.box((14, 10, 9), (hoist[0], hoist[1], 0), "cegla", skip=("bottom",))
    b.gable((14.6, 10.8, 3.2), (hoist[0], hoist[1], 9), "dach_szary", gable_mat="cegla")
    b.windows((hoist[0] - 7, hoist[1] - 5), (hoist[0] + 7, hoist[1] - 5), 3, 1, 4, (1.6, 3.4), "okna", frame="bialy")
    b.box((0.8, 0.8, 3), (hoist[0] + 4, hoist[1] + 2, 12), "cegla")
    for y in (-1.2, 1.2):
        b.beam((tower[0] + 2.5, tower[1] + y, 35.2), (hoist[0] - 7, hoist[1] + y, 7.5), 0.08, "stal_ciemna")

    # bunkier zaladowczy nad droga i tasmociag z nadszybia
    bunker = (-10, -16)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.6, 0.6, 7), (bunker[0] + sx * 3.4, bunker[1] + sy * 2.4, 0), "stal_ciemna")
    b.box((8, 6, 4), (bunker[0], bunker[1], 7), "rdza")
    b.cyl(3.4, 2, (bunker[0], bunker[1], 5), "rdza", seg=4, r_top=4.6, rot=45, caps=False)
    belt_from, belt_to = (tower[0], tower[1] - 6, 7), (bunker[0], bunker[1] + 3, 10.5)
    b.beam(belt_from, belt_to, 1.6, "blacha")
    for k in range(1, 4):
        t = k / 4
        x = belt_from[0] + (belt_to[0] - belt_from[0]) * t
        y = belt_from[1] + (belt_to[1] - belt_from[1]) * t
        z = belt_from[2] + (belt_to[2] - belt_from[2]) * t
        b.box((0.5, 0.5, z), (x, y, 0), "stal_ciemna")

    # biuro, ogrodzenie z brama od drogi
    b.box((10, 7, 6.4), (24, -16, 0), "tynk_szary", skip=("bottom",))
    b.windows((19, -19.5), (29, -19.5), 1.2, 2, 4, (1.3, 1.5), "okna", frame="bialy")
    b.box((10.4, 7.4, 0.4), (24, -16, 6.4), "papa")
    kit.fence(b, w, d)
    obj = b.done("RUD", coll)

    hb = kit.Builder(b.world((-26, -4, 0.05)), rot)
    hb.cyl(10, 7.5, (0, 0, 0), "ruda", seg=24, r_top=1.5)
    heap = hb.done("RUD_halda", coll, smooth=True)
    spoil = layout["przeszkody"][0]  # stara halda skaly plonnej, poza ogrodzeniem
    sb = kit.Builder((spoil["x"], spoil["y"], 0))
    sb.cyl(spoil["r"], 11, (0, 0, -1), "kamien", seg=28, r_top=3)
    sb.done("RUD_halda_plonna", coll, smooth=True)

    kit.empty("RUD_kurs", b.world((tower[0], tower[1], 42)), coll)
    kit.empty("RUD_zaladunek", b.world((bunker[0], bunker[1], 0)), coll)
    kit.empty("RUD_brama", b.world((0, -d / 2 + 2, 0)), coll)
    return obj, heap

