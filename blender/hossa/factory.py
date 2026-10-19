"""Fabryka Motorek: hala z dachem szedowym, biurowiec z neonem, wieza cisnien i plac gotowych maszyn.

Skrzynie z maszynami na placu to osobny obiekt — scena pokazuje ich tyle, ile czeka na wysylke.
"""

from . import kit


def _sawtooth(b, x0, x1, y0, y1, h, teeth):
    """Dach szedowy: pochyle polacie z blachy i pionowe przeszklenia, zeby swiatlo wpadalo z boku."""
    step = (y1 - y0) / teeth
    rise = step * 0.55
    for k in range(teeth):
        a, c = y0 + k * step, y0 + (k + 1) * step
        v = [(x0, a, h), (x1, a, h), (x1, c, h + rise), (x0, c, h + rise), (x0, c, h), (x1, c, h)]
        local = b.place()
        b._add(v, [(0, 1, 2, 3)], "blacha", local)
        b._add(v, [(5, 4, 3, 2)], "szklo", local)
        b._add(v, [(0, 3, 4), (1, 5, 2)], "cegla", local)


def build(layout, coll):
    at, rot, w, d = kit.site(layout, "MTK")
    b = kit.Builder(at, rot)
    b.box((w - 4, d - 4, 0.05), (0, 0, 0), "beton", skip=("bottom",))

    # hala produkcyjna
    hx0, hx1, hy0, hy1, hh = -27, 27, -12, 28, 9
    b.box((hx1 - hx0, hy1 - hy0, hh), ((hx0 + hx1) / 2, (hy0 + hy1) / 2, 0), "cegla", skip=("bottom",))
    _sawtooth(b, hx0, hx1, hy0, hy1, hh, 8)
    for side in (hx0, hx1):
        n = 1 if side == hx1 else -1
        b.windows((side, hy0 if n > 0 else hy1), (side, hy1 if n > 0 else hy0), 3.0, 1, 7, (2.6, 3.6), "okna", frame="bialy")
    for k in range(4):  # rampy zaladunkowe od frontu
        x = 6 + k * 5.5
        b.box((3.6, 0.2, 4.2), (x, hy0 - 0.1, 0), "stal_ciemna", skip=("back",))
        b.box((4.4, 2.2, 1.1), (x, hy0 - 1.1, 0), "beton_sciana", skip=("bottom",))
    b.box((24, 3.4, 0.3), (14.2, hy0 - 1.7, 5.0), "stal_ciemna")

    # biurowiec z napisem na dachu
    ox, oy = -15, -22
    b.box((20, 9, 13.2), (ox, oy, 0), "tynk_szary", skip=("bottom",))
    b.box((20.3, 9.3, 0.8), (ox, oy, 0), "beton_sciana", skip=("bottom",))
    b.windows((ox - 10, oy - 4.5), (ox + 10, oy - 4.5), 1.2, 4, 7, (2.0, 1.8), "okna", frame="stal_ciemna")
    b.windows((ox + 10, oy + 4.5), (ox - 10, oy + 4.5), 1.2, 4, 7, (2.0, 1.8), "okna_ciemne", frame="stal_ciemna")
    b.box((20.4, 9.4, 0.5), (ox, oy, 13.2), "papa")
    for x in (-8, 8):
        b.box((0.25, 0.25, 3.0), (ox + x, oy, 13.7), "stal_ciemna")
    b.box((17, 0.25, 0.25), (ox, oy, 15.4), "stal_ciemna")
    b.text("MOTOREK", 2.2, (ox, oy - 0.2, 13.9), "czerwony", depth=0.3)

    # wieza cisnien, komin i ogrodzenie
    tx, ty = 22, -22
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.beam((tx + sx * 3.2, ty + sy * 3.2, 0), (tx + sx * 2.2, ty + sy * 2.2, 18), 0.4, "stal_ciemna")
    for z in (6, 12):
        for sx, sy, ex, ey in ((-1, -1, 1, -1), (1, -1, 1, 1), (1, 1, -1, 1), (-1, 1, -1, -1)):
            s = 3.2 - z / 18
            b.beam((tx + sx * s, ty + sy * s, z), (tx + ex * s, ty + ey * s, z), 0.25, "stal_ciemna")
    b.cyl(4.0, 5.5, (tx, ty, 18), "stal", seg=24)
    b.cyl(4.2, 2.2, (tx, ty, 23.5), "stal_ciemna", seg=24, r_top=0.3)
    b.cyl(1.6, 26, (-24, 27, 0), "cegla", seg=14, r_top=1.0)
    kit.fence(b, w, d, gate=14)
    obj = b.done("MTK", coll)

    cb = kit.Builder(b.world((4, -22, 0.05)), rot)
    for r in range(3):
        for c in range(5):
            cb.box((2.2, 1.6, 1.5), (c * 2.6 - 5.2, r * 2.2 - 2.2, 0), "drewno")
            cb.box((2.25, 0.2, 0.2), (c * 2.6 - 5.2, r * 2.2 - 2.2, 1.3), "stal_ciemna")
    crates = cb.done("MTK_wyroby", coll)

    kit.empty("MTK_dym", b.world((-24, 27, 26.5)), coll)
    kit.empty("MTK_kurs", b.world((0, 8, 22)), coll)
    kit.empty("MTK_rozladunek", b.world((11.5, hy0 - 4, 0)), coll)
    kit.empty("MTK_zaladunek", b.world((22.5, hy0 - 4, 0)), coll)
    kit.empty("MTK_brama", b.world((0, -d / 2 + 2, 0)), coll)
    return obj, crates
