"""Swiatlo i kamery do kontroli zrzutami w Blenderze (nie trafiaja do eksportu)."""

import json
import math
import os
import urllib.request

import bpy
from mathutils import Vector

from . import materials

HDRI = "kloofendal_48d_partly_cloudy_puresky"


def _hdri():
    path = os.path.join(materials.CACHE, "..", f"{HDRI}_2k.hdr")
    if not os.path.exists(path):
        req = urllib.request.Request(f"https://api.polyhaven.com/files/{HDRI}", headers={"User-Agent": "hossa-build"})
        url = json.load(urllib.request.urlopen(req, timeout=30))["hdri"]["2k"]["hdr"]["url"]
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "hossa-build"}), timeout=120) as r:
            with open(path, "wb") as f:
                f.write(r.read())
    return path


def setup(coll):
    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    background = next(n for n in nodes if n.type == "BACKGROUND")
    env = next((n for n in nodes if n.type == "TEX_ENVIRONMENT"), None) or nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(_hdri(), check_existing=True)
    links.new(env.outputs["Color"], background.inputs["Color"])
    background.inputs["Strength"].default_value = 0.6

    sun_data = bpy.data.lights.new("slonce", "SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(1.5)
    sun = bpy.data.objects.new("slonce", sun_data)
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    coll.objects.link(sun)

    cam_data = bpy.data.cameras.new("kamera")
    cam_data.lens = 35
    cam_data.clip_end = 3000
    cam = bpy.data.objects.new("kamera", cam_data)
    coll.objects.link(cam)
    aim(cam, (150, -260, 170), (-10, 10, 0))
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass


def aim(cam, eye, target):
    cam.location = eye
    cam.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
