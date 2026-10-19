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


