"""Eksport makiety do GLB (bez kopii podgladowych). Optymalizacja: pnpm model (tools/model/src/optimize.ts)."""

import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, ".cache", "makieta-surowa.glb")


def run(path=RAW):
    bpy.ops.object.select_all(action="DESELECT")
    skip = {o.name for o in bpy.data.collections["podglad"].all_objects}
    layer = bpy.context.view_layer.layer_collection.children["wzorce"]
    layer.hide_viewport = False  # wzorce musza byc widoczne, zeby dalo sie je zaznaczyc
    for obj in bpy.context.view_layer.objects:
        if obj.name not in skip:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_image_format="JPEG",
        export_jpeg_quality=85,
        export_yup=True,
        export_lights=False,
        export_cameras=False,
        export_extras=False,
    )
    layer.hide_viewport = True
    return path, os.path.getsize(path)
