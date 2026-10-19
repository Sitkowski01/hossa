"""Buduje makiete i eksportuje surowy GLB. W konsoli Pythona Blendera:

    p = r"<repo>/blender/run.py"; exec(compile(open(p, encoding="utf-8").read(), p, "exec"), {"__file__": p})

Potem w repo: pnpm model (optymalizacja do apps/web/public/makieta.glb).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
for name in [m for m in sys.modules if m == "hossa" or m.startswith("hossa.")]:
    del sys.modules[name]  # po zmianach w skryptach budujemy z nowego kodu, bez restartu Blendera
import hossa.build  # noqa: E402
import hossa.export  # noqa: E402

hossa.build.run()
print(hossa.export.run())
