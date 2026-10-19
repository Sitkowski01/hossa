"""Buduje cala makiete od zera: python w Blenderze -> hossa.build.run()."""

import json
import os

import bpy

from . import factory, ground, houses, kit, mine, paint, port, preview, props, ship, steel, town

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def layout():
    with open(os.path.join(ROOT, "layout.json"), encoding="utf-8") as f:
        return json.load(f)


def run():
    plan = layout()
    kit.clear_scene()
    world = kit.collection("makieta")
    land = kit.collection("teren", world)
    terrain = ground.Terrain(plan)
    ground_obj = terrain.build(land)
    ground_obj.data.materials.append(paint.material(paint.paint(terrain, plan)))
    ground.sea(plan, land)
    ground.base(terrain, plan, land)
    ground.roads(plan, land)
    ground.square(plan, land)
    centre = kit.collection("centrum", world)
    town.exchange(plan, centre)
    town.bank(plan, centre)
    town.shop(plan, centre)
    *_, lots = houses.build(plan, kit.collection("domy", world))
    mine.build(plan, kit.collection("RUD", world))
    steel.build(plan, kit.collection("STW", world))
    factory.build(plan, kit.collection("MTK", world))
    port.build(plan, kit.collection("BPT", world))
    ship.build(plan, kit.collection("statek", world))
    patterns = kit.collection("wzorce")
    made = props.prototypes(patterns)
    placed = props.scatter(plan, terrain, lots)
    look = kit.collection("podglad")
    props.preview(kit.collection("kopie", look), made, placed)
    preview.setup(look)
    bpy.context.view_layer.layer_collection.children["wzorce"].hide_viewport = True
    public = os.path.join(os.path.dirname(ROOT), "apps", "web", "public")
    os.makedirs(public, exist_ok=True)
    with open(os.path.join(public, "makieta.json"), "w", encoding="utf-8") as f:
        json.dump(placed, f, separators=(",", ":"))
    return placed
