"""Klocki do budowania makiety skryptem.

Builder sklada caly budynek w jednej siatce (bmesh) — w przegladarce to jeden obiekt z kilkoma
materialami zamiast setek malych, wiec mniej wywolan rysowania. Wspolrzedne podajemy w ukladzie
budynku (srodek, obrot), a UV liczymy na koncu z polozenia w swiecie i rozmiaru kafla materialu.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import materials


def collection(name, parent=None):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    owner = parent or bpy.context.scene.collection
    if coll.name not in owner.children:
        owner.children.link(coll)
    return coll


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)


def empty(name, at, coll, size=1.0):
    """Punkt zaczepienia dla sceny w przegladarce (komin, tabliczka kursu, miejsce na pikiete)."""
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = size
    obj.location = at
    coll.objects.link(obj)
    return obj


class Builder:
    def __init__(self, origin=(0, 0, 0), rot=0.0):
        self.bm = bmesh.new()
        self.mats = []
        self.base = Matrix.Translation(Vector(origin)) @ Matrix.Rotation(math.radians(rot), 4, "Z")
        self.origin = Vector(origin)

    def world(self, p):
        """Punkt z ukladu budynku w ukladzie swiata (dla punktow zaczepienia)."""
        return tuple(self.base @ Vector(p))

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def _add(self, verts, faces, mat, local):
        m = self.base @ local
        vs = [self.bm.verts.new((m @ Vector(v)) - self.origin) for v in verts]
        idx = self._mat(mat)
        for f in faces:
            try:
                face = self.bm.faces.new([vs[i] for i in f])
            except ValueError:
                continue
            face.material_index = idx
            face.smooth = False

    @staticmethod
    def place(at=(0, 0, 0), rot=0.0, tilt=None):
        m = Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(rot), 4, "Z")
        if tilt:
            axis, deg = tilt
            m = m @ Matrix.Rotation(math.radians(deg), 4, axis)
        return m

    def box(self, size, at, mat, rot=0.0, tilt=None, skip=()):
        """Prostopadloscian; `at` to srodek podstawy. skip=("bottom",) pomija niewidoczne sciany."""
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2]
        v = [(-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
        faces = {
            "bottom": (3, 2, 1, 0),
            "top": (4, 5, 6, 7),
            "front": (0, 1, 5, 4),
            "right": (1, 2, 6, 5),
            "back": (2, 3, 7, 6),
            "left": (3, 0, 4, 7),
        }
        self._add(v, [f for k, f in faces.items() if k not in skip], mat, self.place(at, rot, tilt))

    def cyl(self, r, h, at, mat, seg=16, r_top=None, rot=0.0, tilt=None, caps=True):
        """Walec albo stozek scietego (r_top); os pionowa, `at` to srodek podstawy."""
        rt = r if r_top is None else r_top
        v = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append((r * math.cos(a), r * math.sin(a), 0))
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append((rt * math.cos(a), rt * math.sin(a), h))
        faces = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        if caps:
            faces.append(tuple(reversed(range(seg))))
            if rt > 0:
                faces.append(tuple(range(seg, 2 * seg)))
        self._add(v, faces, mat, self.place(at, rot, tilt))

    def gable(self, size, at, mat, rot=0.0, gable_mat=None):
        """Dach dwuspadowy: kalenica wzdluz x, `at` to srodek okapu."""
        sx, sy, h = size[0] / 2, size[1] / 2, size[2]
        v = [(-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0), (-sx, 0, h), (sx, 0, h)]
        m = self.place(at, rot)
        self._add(v, [(0, 1, 5, 4), (2, 3, 4, 5)], mat, m)
        self._add(v, [(1, 2, 5), (3, 0, 4)], gable_mat or mat, m)

    def prism(self, points, z0, h, mat, top_mat=None):
        """Bryla z wielokata w ukladzie budynku (punkty przeciwnie do wskazowek zegara)."""
        n = len(points)
        v = [(x, y, z0) for x, y in points] + [(x, y, z0 + h) for x, y in points]
        sides = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        m = self.place()
        self._add(v, sides + [tuple(reversed(range(n)))], mat, m)
        self._add(v, [tuple(range(n, 2 * n))], top_mat or mat, m)

    def beam(self, p1, p2, t, mat):
        """Belka od punktu do punktu (kratownice wiez, tasmociagi, dzwigi)."""
        a, b = Vector(p1), Vector(p2)
        d = b - a
        m = Matrix.Translation(a) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        h, n = t / 2, d.length
        v = [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0), (-h, -h, n), (h, -h, n), (h, h, n), (-h, h, n)]
        faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        self._add(v, faces, mat, m)

    def pipe(self, p1, p2, r, mat, seg=10):
        a, b = Vector(p1), Vector(p2)
        d = b - a
        q = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        v = [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z) for z in (0, d.length) for i in range(seg)]
        faces = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        self._add(v, faces, mat, Matrix.Translation(a) @ q)

    def dome(self, r, at, mat, rings=7, seg=28, squash=1.0):
        """Kopula z pierscieni (polsfera, splaszczona przez squash)."""
        for k in range(rings):
            a0, a1 = math.pi / 2 * k / rings, math.pi / 2 * (k + 1) / rings
            z0, z1 = r * math.sin(a0) * squash, r * math.sin(a1) * squash
            self.cyl(r * math.cos(a0), z1 - z0, (at[0], at[1], at[2] + z0), mat, seg=seg, r_top=r * math.cos(a1), caps=k == rings - 1)

    def text(self, content, size, at, mat, rot=0.0, depth=0.15, align="CENTER"):
        """Napis z wbudowanej czcionki Blendera, stojacy pionowo i patrzacy w -y budynku."""
        curve = bpy.data.curves.new("napis", "FONT")
        curve.body = content
        curve.size = size
        curve.extrude = depth / 2
        curve.align_x = align
        tmp = bpy.data.objects.new("napis", curve)
        bpy.context.scene.collection.objects.link(tmp)
        mesh = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        verts = [tuple(v.co) for v in mesh.vertices]
        faces = [tuple(p.vertices) for p in mesh.polygons]
        tmp.to_mesh_clear()
        bpy.data.objects.remove(tmp)
        bpy.data.curves.remove(curve)
        upright = Matrix.Rotation(math.radians(90), 4, "X")
        self._add(verts, faces, mat, self.place(at, rot) @ upright)

    def windows(self, face_from, face_to, z0, rows, cols, size, mat, depth=0.12, frame=None, row_h=3.2):
        """Rzad okien na scianie od punktu face_from do face_to (w ukladzie budynku)."""
        a, b = Vector((*face_from, 0)), Vector((*face_to, 0))
        along = b - a
        length = along.length
        direction = along.normalized()
        out = Vector((direction.y, -direction.x, 0))  # sciana patrzy w prawo od kierunku a->b
        angle = math.degrees(math.atan2(direction.y, direction.x))
        w, h = size
        step = length / cols
        for r in range(rows):
            for c in range(cols):
                base = a + direction * (step * (c + 0.5))
                z = z0 + r * row_h
                if not frame:
                    centre = base + out * (depth / 2)
                    self.box((w, depth, h), (centre.x, centre.y, z), mat, rot=angle, skip=("bottom", "back"))
                    continue
                # szyba lekko cofnieta w ramie: rama z czterech listew, slupek i parapet
                glass, bar = base + out * 0.02, base + out * 0.05
                self.box((w, 0.04, h), (glass.x, glass.y, z), mat, rot=angle, skip=("bottom", "back"))
                for side in (-1, 1):
                    p = bar + direction * side * (w / 2 + 0.06)
                    self.box((0.12, 0.1, h + 0.12), (p.x, p.y, z - 0.06), frame, rot=angle, skip=("bottom", "back"))
                self.box((w + 0.24, 0.1, 0.12), (bar.x, bar.y, z + h), frame, rot=angle, skip=("back",))
                self.box((0.06, 0.07, h), (bar.x, bar.y, z), frame, rot=angle, skip=("bottom", "back"))
                sill = base + out * 0.1
                self.box((w + 0.4, 0.2, 0.1), (sill.x, sill.y, z - 0.12), "beton_sciana", rot=angle, skip=("back",))

    def done(self, name, coll, smooth=False):
        mesh = bpy.data.meshes.new(name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=0.0005)
        self.bm.normal_update()
        uv = self.bm.loops.layers.uv.new("UVMap")
        for face in self.bm.faces:
            n = face.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            t = materials.tile(self.mats[face.material_index])
            for loop in face.loops:
                p = loop.vert.co + self.origin
                if ax == 2:
                    u, v = p.x, p.y
                elif ax == 0:
                    u, v = p.y * (1 if n.x > 0 else -1), p.z
                else:
                    u, v = p.x * (-1 if n.y > 0 else 1), p.z
                loop[uv].uv = (u / t, v / t)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(materials.get(m))
        if smooth:
            for p in mesh.polygons:
                p.use_smooth = True
        obj = bpy.data.objects.new(name, mesh)
        obj.location = self.origin
        coll.objects.link(obj)
        return obj


def attach(child, parent):
    """Podpina obiekt pod rodzica bez przesuwania go (matrix_world nie jest jeszcze przeliczona)."""
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_basis.inverted()


def fence(b, w, d, gate=12):
    """Ogrodzenie z siatki na slupkach dookola terenu zakladu, z brama na srodku frontu (-y)."""
    hx, hy = w / 2 - 1, d / 2 - 1
    ring = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy), (-hx, -hy)]
    for (ax, ay), (bx, by) in zip(ring, ring[1:]):
        front = ay == by == -hy
        n = int(math.hypot(bx - ax, by - ay) / 3)
        for k in range(n + 1):
            x, y = ax + (bx - ax) * k / n, ay + (by - ay) * k / n
            if not (front and abs(x) < gate / 2):
                b.box((0.12, 0.12, 2), (x, y, 0), "stal_ciemna")
        spans = [((-hx, ay), (-gate / 2, ay)), ((gate / 2, ay), (hx, ay))] if front else [((ax, ay), (bx, by))]
        for (sx, sy), (ex, ey) in spans:
            for z in (0.9, 1.8):
                b.beam((sx, sy, z), (ex, ey, z), 0.08, "stal")


def site(layout, key):
    """Polozenie, obrot i wymiary terenu firmy w ukladzie budynku (przy obrocie o 90 stopni
    szerokosc i glebokosc zamieniaja sie miejscami, bo obszar w layout.json jest w osiach swiata)."""
    f = layout["firmy"][key]
    w, d = f["obszar"]
    if abs(f["obrot"]) == 90:
        w, d = d, w
    return (f["x"], f["y"], 0), f["obrot"], w, d
