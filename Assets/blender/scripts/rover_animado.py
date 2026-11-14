"""
Rover do jogo (apps/web/public/assets/models/rover.glb) com rodas independentes e animação "Drive".

  blender -b assets-src/blender/MarsOutpost_Bases.blend --python assets-src/blender/rover_animado.py

Parte do EXTRA_Rover_Pressurizado do kit (mesmo visual das bases/garagens): separa as 6 rodas
(ilhas de M_Rocket_Black), põe a origem de cada uma no eixo e gira o conjunto para que a frente
aponte para -Y no Blender (= +Z no jogo). O .blend não é salvo.
Escala: metros; o jogo aplica 0,75 (como nas bases).
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "models", "rover.glb")
FPS = 24

src = bpy.data.objects["EXTRA_Rover_Pressurizado"]
# logo da NASA em geometria (240 tris) -> textura
exec(open(os.path.join(HERE, "texturas.py"), encoding="utf8").read(), globals())
print("DECALS no rover:", decalize_logos(src))
mats = list(src.data.materials)
bm = bmesh.new()
bm.from_mesh(src.data)
bm.faces.ensure_lookup_table()


def islands(b):
    seen, out = set(), []
    for f in b.faces:
        if f.index in seen:
            continue
        stack, ids = [f], []
        while stack:
            x = stack.pop()
            if x.index in seen:
                continue
            seen.add(x.index)
            ids.append(x)
            for e in x.edges:
                for lf in e.link_faces:
                    if lf.index not in seen:
                        stack.append(lf)
        out.append(ids)
    return out


def bbox(faces):
    vs = {v for f in faces for v in f.verts}
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


isl = islands(bm)
wheels = []
for faces in isl:
    names = {mats[f.material_index].name for f in faces}
    b = bbox(faces)
    # pneu: preto, ~1 m de diâmetro, largura ~0,4 m no eixo Y, perto do chão
    if names == {"M_Rocket_Black"} and 0.8 < b[5] - b[4] < 1.1 and 0.3 < b[3] - b[2] < 0.5 and b[4] < 0.2:
        wheels.append((faces, b))
print("RODAS encontradas:", len(wheels))

# frente do veículo: lado do para-brisa (M_Vidro_Escuro) ao longo de X
gx = [sum(v.co.x for v in f.verts) / len(f.verts) for f in bm.faces if mats[f.material_index].name == "M_Vidro_Escuro"]
front_x = (sum(gx) / len(gx)) if gx else 1.0
sign = 1.0 if front_x > 0 else -1.0
print("frente em X", round(front_x, 2), "->", "+X" if sign > 0 else "-X")

# ---------------------------------------------------------------- cena nova só com o rover
bpy.ops.object.select_all(action="DESELECT")
col = bpy.data.collections.new("ROVER_EXPORT")
bpy.context.scene.collection.children.link(col)
root = bpy.data.objects.new("rover_root", None)
col.objects.link(root)
root.rotation_euler = (0, 0, math.radians(-90 if sign > 0 else 90))  # frente -> -Y

wheel_objs = []
for i, (faces, b) in enumerate(wheels):
    cx, cy, cz = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2
    wb = bmesh.new()
    vmap = {}
    for f in faces:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = wb.verts.new(v.co - Vector((cx, cy, cz)))
            vs.append(vmap[v])
        nf = wb.faces.new(vs)
        nf.material_index = 0
        nf.smooth = False
    me = bpy.data.meshes.new(f"Roda_{i}")
    wb.to_mesh(me)
    wb.free()
    me.materials.append(mats[[m.name for m in mats].index("M_Rocket_Black")])
    ob = bpy.data.objects.new(f"Roda_{i}", me)
    ob.location = (cx, cy, cz)
    ob.parent = root
    col.objects.link(ob)
    wheel_objs.append(ob)
bmesh.ops.delete(bm, geom=[f for faces, _ in wheels for f in faces], context="FACES")
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
body_me = bpy.data.meshes.new("rover_body")
bm.to_mesh(body_me)
bm.free()
for m in mats:
    body_me.materials.append(m)
body = bpy.data.objects.new("rover_body", body_me)
body.parent = root
col.objects.link(body)

# ---------------------------------------------------------------- animação
def keys(ob, name, frames, fn, paths=("rotation_euler",)):
    ad = ob.animation_data_create()
    act = bpy.data.actions.new(f"{name}_{ob.name}")
    ad.action = act
    for f in range(frames + 1):
        fn(f / frames)
        for path in paths:
            ob.keyframe_insert(path, frame=f + 1)
    for fc in (act.fcurves if hasattr(act, "fcurves") else [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    tr = ad.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 1, act)
    ad.action = None


for ob in wheel_objs:
    def roll(t, ob=ob):
        ob.rotation_euler = (0, sign * 2 * math.pi * t, 0)  # uma volta por segundo
    keys(ob, "Drive", FPS, roll)


def bob(t):
    body.location = (0, 0, 0.018 * math.sin(4 * math.pi * t))
    body.rotation_euler = (math.radians(0.6) * math.sin(2 * math.pi * t), math.radians(0.5) * math.sin(4 * math.pi * t + 1), 0)


keys(body, "Drive", FPS, bob, ("location", "rotation_euler"))

# ---------------------------------------------------------------- exporta só o rover
bpy.ops.object.select_all(action="DESELECT")
for o in [root, body, *wheel_objs]:
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
print("EXPORTADO", OUT, "rodas:", len(wheel_objs), "tris corpo:", sum(len(p.vertices) - 2 for p in body_me.polygons))
