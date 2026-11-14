"""
Veículo remoto (robô de exploração, controlado da base) -> apps/web/public/assets/models/rover_remoto.glb

  blender -b assets-src/blender/MarsOutpost_Bases.blend --python assets-src/blender/rover_remoto.py

6 rodas independentes + cabeça de câmera no mastro. A frente aponta para -Y no Blender (+Z no jogo).
Clipes (NLA, mesmo nome em todos os objetos): "Drive" (rodas e balanço) e "Scan" (câmera varre).
O .blend não é salvo. Escala em metros (o jogo aplica 0,75 como nas bases).
"""
import math
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "models", "rover_remoto.glb")
FPS = 24

g = globals()
exec(open(os.path.join(HERE, "lib_kit.py"), encoding="utf8").read(), g)  # Piece, mat, collection

col = bpy.data.collections.new("ROVER_REMOTO_EXPORT")
bpy.context.scene.collection.children.link(col)
root = bpy.data.objects.new("rover_remoto_root", None)
col.objects.link(root)


def adopt(ob, loc=None):
    ob.parent = root
    if loc is not None:
        ob.location = loc
    return ob


# ---------------------------------------------------------------- corpo
body = Piece()
body.boxz((1.5, 2.3, 0.18), 0, 0, 0.5, mat("M_Dark_Metal"))  # chassi
body.boxz((1.3, 1.9, 0.34), 0, 0.05, 0.66, mat("M_Hull_White"))  # caixa dos instrumentos
body.boxz((1.34, 0.35, 0.1), 0, 0.05, 1.0, mat("M_NASA_Azul"))  # faixa azul no topo
body.boxz((1.4, 1.2, 0.04), 0, 0.35, 1.1, mat("M_Telhado"))  # painel solar (traseira)
body.boxz((1.4, 0.04, 0.5), 0, 0.98, 1.0, mat("M_Dark_Metal"))  # suporte do painel
body.cyl(0.03, 0.55, 0.0, 0.95, 1.12, mat("M_Aco"), seg=6)  # haste da antena
body.cyl(0.28, 0.07, 0.0, 0.95, 1.6, mat("M_Hull_White"), seg=12, r2=0.05)  # prato
body.boxz((0.18, 0.04, 0.08), -0.5, -1.17, 0.7, mat("M_Glow_Orange"))  # faróis
body.boxz((0.18, 0.04, 0.08), 0.5, -1.17, 0.7, mat("M_Glow_Orange"))
body.boxz((0.1, 0.04, 0.06), 0.0, -1.0, 0.98, mat("M_Glow_Cyan"))  # luz de status
for sx in (-0.78, 0.78):  # suspensão (balancins)
    body.boxz((0.08, 2.0, 0.07), sx, 0, 0.42, mat("M_Aco"))
body_ob = adopt(body.build("rover_remoto_body", col))

# ---------------------------------------------------------------- mastro e cabeça de câmera
mast = Piece()
mast.cyl(0.035, 0.7, 0.0, 0.0, 0.0, mat("M_Aco"), seg=6)
mast_ob = adopt(mast.build("mastro", col), (0.0, -0.78, 1.0))
head = Piece()
head.boxz((0.34, 0.18, 0.18), 0, 0, 0, mat("M_Hull_White"))
head.boxz((0.2, 0.04, 0.1), 0, -0.1, 0.04, mat("M_Tela"))
head.cyl(0.05, 0.06, -0.09, -0.1, 0.07, mat("M_Glow_Cyan"), seg=8, axis="Y")
head_ob = adopt(head.build("cabeca_camera", col), (0.0, -0.78, 1.7))

# ---------------------------------------------------------------- rodas (origem no eixo)
wheels = []
for i, (x, y) in enumerate([(-0.95, -0.85), (0.95, -0.85), (-0.95, 0.0), (0.95, 0.0), (-0.95, 0.85), (0.95, 0.85)]):
    w = Piece()
    w.cyl(0.33, 0.28, 0, 0, 0, mat("M_Borracha"), seg=10, axis="X")
    w.cyl(0.17, 0.3, 0, 0, 0, mat("M_Aco"), seg=8, axis="X")
    ob = adopt(w.build(f"Roda_{i}", col), (x, y, 0.33))
    wheels.append(ob)


# ---------------------------------------------------------------- animações
def keys(ob, name, frames, fn, paths=("rotation_euler",)):
    ad = ob.animation_data_create()
    act = bpy.data.actions.new(f"{name}_{ob.name}")
    ad.action = act
    for f in range(frames + 1):
        fn(f / frames)
        for path in paths:
            ob.keyframe_insert(path, frame=f + 1)
    fcs = act.fcurves if hasattr(act, "fcurves") else [fc for lay in act.layers for st in lay.strips for cb in st.channelbags for fc in cb.fcurves]
    if name == "Drive":
        for fc in fcs:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    tr = ad.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 1, act)
    ad.action = None


for ob in wheels:
    keys(ob, "Drive", FPS, lambda t, ob=ob: setattr(ob, "rotation_euler", (2 * math.pi * t, 0, 0)))  # 1 volta/s


def bob(t):
    body_ob.location = (0, 0, 0.02 * math.sin(4 * math.pi * t))
    body_ob.rotation_euler = (math.radians(0.8) * math.sin(2 * math.pi * t), math.radians(0.7) * math.sin(4 * math.pi * t + 1), 0)


keys(body_ob, "Drive", FPS, bob, ("location", "rotation_euler"))


def scan(t):  # a câmera olha de um lado ao outro em 6 s
    head_ob.rotation_euler = (0, 0, math.radians(70) * math.sin(2 * math.pi * t))


keys(head_ob, "Scan", FPS * 6, scan)

# ---------------------------------------------------------------- exporta
bpy.ops.object.select_all(action="DESELECT")
for o in [root, body_ob, mast_ob, head_ob, *wheels]:
    o.select_set(True)
bpy.context.view_layer.objects.active = root
props = bpy.ops.export_scene.gltf.get_rna_type().properties
kw = dict(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_force_sampling=True,
    export_optimize_animation_size=False,
)
bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})
print("EXPORTADO", OUT, "tris:", sum(len(o.data.polygons) for o in [body_ob, mast_ob, head_ob, *wheels]))
