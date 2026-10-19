"""Malowanie terenu do jednej tekstury (numpy zamiast wypalania w Cycles — szybko i powtarzalnie).

glTF nie przeniesie mieszania tekstur w wezlach Blendera, wiec trawe, ziemie przy zakladach,
plaze i skaly na wzgorzach skladamy tu w jeden obraz rozpiety na calym terenie.
"""

import math
import os

import bpy
import numpy as np
from mathutils import Vector, noise

from . import materials

# warstwa -> (id na Poly Haven, rozmiar kafla w metrach)
LAYERS = {
    "trawa": ("rocky_terrain_02", 90.0),
    "trawa2": ("aerial_grass_rock", 15.0),
    "ziemia": ("aerial_ground_rock", 36.0),
    "piasek": ("aerial_beach_02", 20.0),
    "skala": ("rocky_terrain", 90.0),
}
INDUSTRY = ("RUD", "STW", "BPT")


def _texture(asset, tile, texel):
    """Tekstura zmniejszona tak, by jeden piksel odpowiadal pikselowi terenu (inaczej migocze)."""
    path = materials._download(asset)["Diffuse"]
    img = bpy.data.images.load(path, check_existing=False)
    size = max(8, int(round(tile / texel)))
    img.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[:, :, :3]


def _sample(tex, tile, X, Y):
    n = tex.shape[0]
    i = (np.floor(Y / tile * n).astype(np.int64)) % n
    j = (np.floor(X / tile * n).astype(np.int64)) % n
    return tex[i, j]


def _upsample(grid, w, h):
    """Dwuliniowe powiekszenie maski z siatki terenu do rozdzielczosci obrazu."""
    gh, gw = grid.shape
    ys = np.linspace(0, gh - 1, h)
    xs = np.linspace(0, gw - 1, w)
    y0 = np.floor(ys).astype(int).clip(0, gh - 2)
    x0 = np.floor(xs).astype(int).clip(0, gw - 2)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    a = grid[y0][:, x0]
    b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]
    d = grid[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def _masks(terrain, layout, step):
    (x0, x1), (y0, y1) = layout["teren"]["x"], layout["teren"]["y"]
    xs = np.arange(x0, x1 + step, step)
    ys = np.arange(y0, y1 + step, step)
    shore = layout["teren"]["brzeg"]
    sites = [Vector((f["x"], f["y"])) for k, f in layout["firmy"].items() if k in INDUSTRY]
    dirt, sand, rock, tint, wet = (np.zeros((len(ys), len(xs)), dtype=np.float32) for _ in range(5))
    for r, y in enumerate(ys):
        for c, x in enumerate(xs):
            p = Vector((x, y))
            h = terrain.height(x, y)
            near = min((p - s).length for s in sites)
            n = noise.noise(Vector((x / 18, y / 18, 3.1)))
            dirt[r, c] = 1 - min(1, max(0, (near - 38 + 12 * n) / 18))
            sand[r, c] = 1 - min(1, max(0, (y - shore - 5 + 3 * n) / 6))
            wet[r, c] = min(1, max(0, (shore - y) / 10))
            rock[r, c] = min(1, max(0, (h - 9 + 4 * n) / 5))
            tint[r, c] = noise.noise(Vector((x / 70, y / 70, 7.7)))
    return dirt, sand, rock, tint, wet


def paint(terrain, layout, width=4096, step=2.5):
    (x0, x1), (y0, y1) = layout["teren"]["x"], layout["teren"]["y"]
    height = int(width * (y1 - y0) / (x1 - x0))
    texel = (x1 - x0) / width
    X, Y = np.meshgrid(np.linspace(x0, x1, width, dtype=np.float32), np.linspace(y0, y1, height, dtype=np.float32))
    tex = {k: _texture(a, t, texel) for k, (a, t) in LAYERS.items()}
    layer = {k: _sample(tex[k], LAYERS[k][1], X, Y) for k in tex}
    dirt, sand, rock, tint, wet = (_upsample(m, width, height)[:, :, None] for m in _masks(terrain, layout, step))

    grass_mix = (0.35 * tint).clip(0, 0.35)
    img = layer["trawa"] * (1 - grass_mix) + layer["trawa2"] * grass_mix
    img = img * (0.85 + 0.25 * tint)  # wielkie plamy jasniejszej i ciemniejszej trawy — bez widocznych kafli
    img = img * (1 - dirt) + layer["ziemia"] * 0.72 * dirt
    img = img * (1 - rock) + layer["skala"] * rock
    img = img * (1 - sand) + layer["piasek"] * sand
    img = img * (1 - 0.55 * wet)  # mokry piasek pod woda

    out = bpy.data.images.get("teren_kolor") or bpy.data.images.new("teren_kolor", width, height, alpha=False)
    if out.size[0] != width or out.size[1] != height:
        out.scale(width, height)
    rgba = np.concatenate([img.clip(0, 1), np.ones((height, width, 1), dtype=np.float32)], axis=2)
    out.pixels.foreach_set(rgba.astype(np.float32).ravel())
    folder = os.path.join(materials.CACHE, "..")
    out.filepath_raw = os.path.join(folder, "teren_kolor.jpg")
    out.file_format = "JPEG"
    out.save()
    return out


def material(image):
    mat = bpy.data.materials.get("teren") or bpy.data.materials.new("teren")
    mat.use_backface_culling = True
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    tex = next((n for n in nodes if n.type == "TEX_IMAGE"), None) or nodes.new("ShaderNodeTexImage")
    tex.image = image
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    return mat
