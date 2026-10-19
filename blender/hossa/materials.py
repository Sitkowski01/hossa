"""Materialy makiety: tekstury PBR z Poly Haven (CC0) i kilka gladkich kolorow.

Tekstury sciaga sie raz do blender/.cache (poza gitem). Skala kafla jest w metrach, bo UV
liczymy z polozenia w swiecie (kit.Builder) — cegla na hucie i na domu ma ten sam rozmiar.
"""

import json
import os
import urllib.request

import bpy

CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "textures")

# nazwa -> (id na Poly Haven, rozmiar kafla w metrach[, mnoznik jasnosci])
TEXTURED = {
    "asfalt": ("asphalt_02", 4.0, 0.7),
    "beton": ("concrete_floor_02", 4.0, 0.75),
    "beton_sciana": ("concrete_wall_006", 3.0),
    "cegla": ("red_brick_03", 2.5),
    "cegla_ciemna": ("brick_wall_001", 2.5),
    "tynk": ("beige_wall_001", 3.0),
    "tynk_szary": ("grey_plaster_02", 3.0),
    "blacha": ("corrugated_iron_02", 2.0),
    "blacha_rdza": ("rusty_corrugated_iron", 2.0, 0.75),
    "rdza": ("rusty_metal_02", 2.0, 0.4),
    "dachowka": ("clay_roof_tiles", 3.0),
    "dach_szary": ("grey_roof_tiles", 3.0),
    "bruk": ("cobblestone_square", 3.5, 0.65),
    "chodnik": ("rectangular_paving", 2.0, 0.7),
    "zwir": ("gravel_floor", 3.0, 0.55),
    "kamien": ("aerial_rocks_02", 6.0),
    "piasek": ("coast_sand_01", 5.0),
    # kolorowe tynki kamienic (jedna tekstura, rozny kolor mnozony — jak pierzeje w Gdansku)
    "tynk_zolty": ("painted_plaster_wall", 3.0, (0.98, 0.87, 0.67)),
    "tynk_rozowy": ("painted_plaster_wall", 3.0, (0.94, 0.78, 0.74)),
    "tynk_mietowy": ("painted_plaster_wall", 3.0, (0.78, 0.89, 0.83)),
    "tynk_niebieski": ("painted_plaster_wall", 3.0, (0.76, 0.83, 0.91)),
    "tynk_ceglasty": ("painted_plaster_wall", 3.0, (0.91, 0.72, 0.61)),
    "tynk_bialy": ("painted_plaster_wall", 3.0, (0.91, 0.91, 0.89)),
}

# nazwa -> (kolor sRGB 0-1, chropowatosc, metalicznosc); jasnosc najwyzej ~0,8, zeby nie przepalac
PLAIN = {
    "stal": ((0.42, 0.44, 0.46), 0.45, 0.8),
    "stal_ciemna": ((0.18, 0.19, 0.2), 0.5, 0.7),
    "zolty": ((0.78, 0.6, 0.08), 0.5, 0.2),
    "czerwony": ((0.55, 0.09, 0.07), 0.5, 0.1),
    "bialy": ((0.78, 0.78, 0.76), 0.6, 0.0),
    "zielony_ksz": ((0.1, 0.42, 0.2), 0.5, 0.0),
    "granat_grs": ((0.08, 0.14, 0.3), 0.4, 0.2),
    "szklo": ((0.08, 0.11, 0.14), 0.08, 0.6),
    "okna": ((0.12, 0.15, 0.18), 0.12, 0.3),
    "okna_ciemne": ((0.1, 0.12, 0.14), 0.12, 0.3),
    "papa": ((0.2, 0.2, 0.21), 0.9, 0.0),
    "drewno": ((0.3, 0.19, 0.11), 0.55, 0.0),
    "guma": ((0.05, 0.05, 0.05), 0.8, 0.0),
    "ruda": ((0.28, 0.16, 0.12), 0.9, 0.1),
    "wegiel": ((0.06, 0.06, 0.06), 0.85, 0.0),
    "led": ((0.02, 0.02, 0.03), 0.3, 0.0),
    "woda": ((0.05, 0.16, 0.2), 0.05, 0.0),
    "woda_bok": ((0.04, 0.12, 0.16), 0.1, 0.0),
    "ziemia_bok": ((0.22, 0.15, 0.1), 0.95, 0.0),
    "lisc": ((0.13, 0.25, 0.08), 0.8, 0.0),
    "lisc_jasny": ((0.24, 0.36, 0.1), 0.8, 0.0),
    "iglak": ((0.07, 0.18, 0.09), 0.85, 0.0),
    "lampa": ((0.75, 0.7, 0.55), 0.4, 0.0),
    "skora": ((0.72, 0.53, 0.4), 0.6, 0.0),
    "miedz": ((0.32, 0.52, 0.44), 0.5, 0.3),
    "kora": ((0.22, 0.15, 0.1), 0.9, 0.0),
}


def tile(name):
    return TEXTURED[name][1] if name in TEXTURED else 1.0


def _download(asset):
    folder = os.path.join(CACHE, asset)
    os.makedirs(folder, exist_ok=True)
    wanted = {"Diffuse": "diff", "nor_gl": "nor", "Rough": "rough"}
    paths = {key: os.path.join(folder, f"{short}.jpg") for key, short in wanted.items()}
    if all(os.path.exists(p) for p in paths.values()):
        return paths
    req = urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers={"User-Agent": "hossa-build"})
    files = json.load(urllib.request.urlopen(req, timeout=30))
    for key, path in paths.items():
        url = files[key]["1k"]["jpg"]["url"]
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "hossa-build"}), timeout=60) as r:
            with open(path, "wb") as f:
                f.write(r.read())
    return paths


def _principled(mat):
    mat.use_nodes = True
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _image(mat, path, color):
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(path, check_existing=True)
    node.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return node


def get(name):
    """Materialy tworzone raz i ponownie uzywane — eksport glTF robi z nich wspolne materialy."""
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_backface_culling = True  # zamkniete bryly: eksport bez doubleSided, mniej pracy dla GPU
    bsdf = _principled(mat)
    links = mat.node_tree.links
    if name in TEXTURED:
        paths = _download(TEXTURED[name][0])
        color = _image(mat, paths["Diffuse"], True).outputs["Color"]
        if len(TEXTURED[name]) > 2:  # przyciemnienie jako mnozenie — eksport glTF zamienia je na baseColorFactor
            mix = mat.node_tree.nodes.new("ShaderNodeMix")
            mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            links.new(color, mix.inputs[6])
            v = TEXTURED[name][2]
            # odcien podany jak kolor (sRGB), jasnosc jako zwykly mnoznik
            r, g, bl = tuple(c**2.2 for c in v) if isinstance(v, tuple) else (v, v, v)
            mix.inputs[7].default_value = (r, g, bl, 1.0)
            color = mix.outputs[2]
        links.new(color, bsdf.inputs["Base Color"])
        links.new(_image(mat, paths["Rough"], False).outputs["Color"], bsdf.inputs["Roughness"])
        normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
        links.new(_image(mat, paths["nor_gl"], False).outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        color, rough, metal = PLAIN[name]
        bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in color], 1.0)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    return mat
