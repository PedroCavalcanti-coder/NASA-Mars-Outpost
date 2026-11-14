"""
Reexporta as 8 bases (GLB + JSON) a partir do MarsOutpost_Bases.blend, sem salvar o .blend.
  blender -b assets-src/blender/MarsOutpost_Bases.blend --python assets-src/blender/exportar_bases.py
Depois: node scripts/build-bases.mjs (dedup, poda, meshopt e bases.generated.ts).
"""
import os

import bpy

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
g = globals()
g["BLENDER_DIR"] = BLENDER_DIR
g["__file__"] = os.path.join(BLENDER_DIR, "build_all.py")
exec(open(os.path.join(BLENDER_DIR, "build_all.py"), encoding="utf8").read(), g)

# logos e piso viram textura (em memória; o .blend não é salvo)
exec(open(os.path.join(BLENDER_DIR, "texturas.py"), encoding="utf8").read(), g)
print("TEXTURAS logos/juntas:", apply_all())  # noqa: F821
print("POEIRA painel:", add_solar_dust(bpy.data.objects["KIT_Painel_Solar"]))  # noqa: F821

for i, L in enumerate(LAYOUTS):  # noqa: F821
    root, ext = build_base(L, i)  # noqa: F821
    export_base(root, L, OUT, ext)  # noqa: F821
    print("BASE", L.key, "ok", L.errors)
