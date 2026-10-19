"""Huta Stalwar: wielki piec z nagrzewnicami, kominy, plac rudy z suwnica, walcownia i zbiornik gazu.

Front zakladu (lokalne -y) patrzy na droge do miasta. Zwal rudy na placu to osobny obiekt
(skaluje go zapas Stocks.millOre), a punkty na szczytach kominow mowia scenie, skad leci dym.
"""

import math

from . import kit


def _stove(b, x, y):
    """Nagrzewnica Cowpera: wysoki walec z kopula i pierscieniami."""
    b.cyl(3.6, 26, (x, y, 0), "stal", seg=20, caps=False)
    for z in (6, 13, 20):
        b.cyl(3.75, 0.5, (x, y, z), "stal_ciemna", seg=20)
    b.dome(3.6, (x, y, 26), "stal", rings=4, seg=20)


def _chimney(b, x, y, h, r=2.4):
    b.cyl(r + 0.8, 3, (x, y, 0), "beton_sciana", seg=16)
    b.cyl(r, h - 8, (x, y, 3), "cegla", seg=16, r_top=r * 0.68, caps=False)
    top = r * 0.68
    for k, mat in enumerate(("czerwony", "bialy", "czerwony")):  # pasy ostrzegawcze dla samolotow
        b.cyl(top + 0.02, 1.7, (x, y, h - 5 + 1.7 * k), mat, seg=16, caps=k == 2)


def _hall(b, w, d, h, at, wall="blacha", roof="blacha_rdza", monitor=True):
    """Hala z dachem dwuspadowym i swietlikiem wzdluz kalenicy."""
    x, y = at
    b.box((w, d, h), (x, y, 0), wall, skip=("bottom",))
    b.gable((w + 0.6, d + 0.8, d * 0.18), (x, y, h), roof, gable_mat=wall)
    if monitor:
        b.box((w * 0.8, d * 0.16, 1.2), (x, y, h + d * 0.18 - 0.6), "okna_ciemne")
        b.box((w * 0.8 + 0.2, d * 0.22, 0.25), (x, y, h + d * 0.18 + 0.6), roof)
    for k in range(int(w / 8)):
        b.box((4, 0.15, 5), (x - w / 2 + 4 + k * 8, y - d / 2 - 0.07, 0), "stal_ciemna", skip=("back",))


def build(layout, coll):
    at, rot, w, d = kit.site(layout, "STW")
    b = kit.Builder(at, rot)
    b.box((w - 4, d - 4, 0.05), (0, 0, 0), "beton", skip=("bottom",))

    # wielki piec: hala spustowa, gar, szyb i rury gazu gardzielowego
    fx, fy = -2, 4
    b.box((16, 14, 6), (fx, fy, 0), "cegla_ciemna", skip=("bottom",))
    b.box((16.4, 14.4, 0.4), (fx, fy, 6), "stal_ciemna")
    b.cyl(4.6, 6, (fx, fy, 6.4), "rdza", seg=24, caps=False)
    b.cyl(4.6, 4, (fx, fy, 12.4), "rdza", seg=24, r_top=5.6, caps=False)
    b.cyl(5.6, 17, (fx, fy, 16.4), "rdza", seg=24, r_top=3.6, caps=False)
    b.box((10, 10, 0.5), (fx, fy, 33.4), "stal_ciemna")
    b.cyl(3.0, 3, (fx, fy, 33.9), "rdza", seg=16, r_top=1.4)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.beam((fx + sx * 6, fy + sy * 6, 6.4), (fx + sx * 4.5, fy + sy * 4.5, 34), 0.5, "stal_ciemna")
            b.pipe((fx + sx * 1.6, fy + sy * 1.6, 36), (fx + sx * 1.2, fy + sy * 1.2, 42), 0.55, "rdza")
    b.cyl(2.2, 1.6, (fx, fy, 41.5), "rdza", seg=16)
    dx, dy = -16, -6  # odpylnik: rura gazu gardzielowego schodzi z gardzieli na jego dach
    b.pipe((fx, fy, 42.3), (dx, dy, 16), 0.9, "rdza")
    b.cyl(3.2, 10, (dx, dy, 6), "stal", seg=16)
    b.cyl(0.9, 4, (dx, dy, 2), "stal", seg=12, r_top=3.2, caps=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box((0.5, 0.5, 6), (dx + sx * 2.4, dy + sy * 2.4, 0), "stal_ciemna")

    # nagrzewnice i rura goracego dmuchu
    for k, y in enumerate((-6, 2, 10)):
        _stove(b, 16, y)
        b.pipe((16, y, 12), (fx + 5, fy, 12), 0.7, "stal_ciemna")
    b.box((0.8, 0.8, 12), (10, 4, 0), "stal_ciemna")

    # pochylnia skipowa z placu rudy na gardziel
    bottom, top = (fx - 6, -22, 0.5), (fx - 1.5, fy - 3, 37)
    for sx in (-1.1, 1.1):
        b.beam((bottom[0] + sx, bottom[1], bottom[2]), (top[0] + sx, top[1], top[2]), 0.5, "zolty")
    for k in range(1, 6):
        t = k / 6
        p = [bottom[i] + (top[i] - bottom[i]) * t for i in range(3)]
        b.box((0.6, 0.6, p[2]), (p[0], p[1], 0), "stal_ciemna")
        b.beam((p[0] - 1.1, p[1], p[2]), (p[0] + 1.1, p[1], p[2]), 0.3, "zolty")
    b.box((7, 5, 4), (bottom[0], bottom[1] - 1, 0), "rdza")

    # kominy, zbiornik gazu, walcownia z tylu i magazyn wysylkowy przy bramie
    smoke = [(28, 12, 54), (28, -8, 46)]
    for x, y, h in smoke:
        _chimney(b, x, y, h)
    b.cyl(8, 18, (-24, 14, 0), "stal", seg=28)
    b.dome(8, (-24, 14, 18), "stal", rings=3, squash=0.3)
    for k in range(4):
        b.cyl(8.12, 0.4, (-24, 14, 3 + 4 * k), "stal_ciemna", seg=28, caps=False)
    _hall(b, 66, 12, 12, (0, 30))
    _hall(b, 16, 11, 8, (24, -28), wall="cegla", roof="dach_szary", monitor=False)
    b.box((14, 10, 7), (-28, -30, 0), "tynk_szary", skip=("bottom",))
    b.windows((-35, -35), (-21, -35), 1.4, 2, 5, (1.4, 1.6), "okna", frame="bialy")
    b.box((14.4, 10.4, 0.4), (-28, -30, 7), "papa")
    for k in range(5):  # kregi blachy czekajace na odbior
        b.cyl(0.9, 1.4, (14 + 2.1 * k, -36, 0.9), "stal", seg=14, tilt=("X", 90))
    kit.fence(b, w, d, gate=14)
    obj = b.done("STW", coll)

    # suwnica nad placem rudy (osobny obiekt — scena przesuwa ja nad zwalem)
    cb = kit.Builder(b.world((-14, -30, 0)), rot)
    for sx in (-12, 12):
        cb.beam((sx, -3, 0), (sx, 0, 11), 0.5, "zolty")
        cb.beam((sx, 3, 0), (sx, 0, 11), 0.5, "zolty")
    cb.box((26, 1.6, 1.4), (0, 0, 11), "zolty")
    cb.box((2.4, 2.4, 1.6), (3, 0, 9.4), "stal_ciemna")
    cb.done("STW_suwnica", coll)

    ob = kit.Builder(b.world((-14, -30, 0.05)), rot)
    ob.prism([(-9, -3), (9, -3), (7, 3), (-7, 3)], 0, 0.1, "ruda")
    ob.cyl(5.5, 4.5, (-4, 0, 0), "ruda", seg=18, r_top=0.8)
    ob.cyl(5.0, 4.0, (4, 0.5, 0), "ruda", seg=18, r_top=0.8)
    ob.cyl(4.5, 3.4, (-12, 10, 0), "wegiel", seg=18, r_top=0.6)
    ore = ob.done("STW_ruda", coll, smooth=True)

    for i, (x, y, h) in enumerate(smoke):
        kit.empty(f"STW_dym_{i + 1}", b.world((x, y, h + 0.5)), coll)
    kit.empty("STW_spust", b.world((fx, fy - 7.5, 2)), coll)
    kit.empty("STW_kurs", b.world((fx, fy, 50)), coll)
    kit.empty("STW_rozladunek", b.world((-14, -36, 0)), coll)
    kit.empty("STW_zaladunek", b.world((24, -36, 0)), coll)
    kit.empty("STW_brama", b.world((0, -d / 2 + 2, 0)), coll)
    return obj, ore
