"""
Astronauta animado: importa o GLB bruto (assets-src/models-raw/astronaut.glb), monta o esqueleto,
pesa os vértices por região e cria as animações Idle, Walk, Work e Wave.
Uso (sem abrir o Blender):
  blender -b --python assets-src/blender/astronauta_animado.py
Saída: apps/web/public/assets/models/astronaut.glb (+ assets-src/blender/Astronauta_Animado.blend)
Eixos: Blender (x, y, z) -> three (x, z, -y). O personagem olha para -Y no Blender (+Z no jogo).
"""
import math
import os

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(REPO, "assets-src", "models-raw", "astronaut.glb")
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "models", "astronaut.glb")
BLEND = os.path.join(HERE, "Astronauta_Animado.blend")
FPS = 24

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=RAW)
O = bpy.data.objects
root = O["astronaut_root"]

# ---------------------------------------------------------------- corpo: transformações assadas na malha
BODY = [n for n in O.keys() if n.endswith("_mesh") and (n.startswith("color_") or n == "static_body_mesh")]
for name in BODY:
    ob = O[name]
    ob.data.transform(ob.matrix_world.copy())
    ob.parent = None
    ob.matrix_basis = Matrix.Identity(4)
for name in ("static_body", "color_helmet", "color_vest", "color_suit", "color_gloves", "color_boots", "color_backpack"):
    O[name].matrix_basis = Matrix.Identity(4)
for name in BODY:
    O[name].parent = O[name[:-5]]
    O[name].matrix_parent_inverse = Matrix.Identity(4)

# ---------------------------------------------------------------- esqueleto
adata = bpy.data.armatures.new("astronaut_rig")
rig = bpy.data.objects.new("astronaut_rig", adata)
bpy.context.scene.collection.objects.link(rig)
rig.parent = root
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = adata.edit_bones
BONES = {
    "root": ((0, 0, 0), (0, 0, 0.15), None),
    "leg_R": ((0.15, 0, 0.55), (0.15, 0, 0.1), "root"),
    "leg_L": ((-0.15, 0, 0.55), (-0.15, 0, 0.1), "root"),
    "torso": ((0, 0, 0.55), (0, 0, 1.1), "root"),
    "head": ((0, 0, 1.1), (0, 0, 1.7), "torso"),
    "arm_R": ((0.45, 0, 1.05), (0.45, 0, 0.5), "torso"),
    "arm_L": ((-0.45, 0, 1.05), (-0.45, 0, 0.5), "torso"),
}
for n, (h, t, p) in BONES.items():
    b = eb.new(n)
    b.head, b.tail = h, t
    if p:
        b.parent = eb[p]
bpy.ops.object.mode_set(mode="OBJECT")


def region(x, z):
    """Osso dono do vértice (coordenadas do mundo, Blender)."""
    if abs(x) > 0.33 and 0.45 < z < 1.15:
        return "arm_R" if x > 0 else "arm_L"
    if z < 0.55:
        return "leg_R" if x >= 0 else "leg_L"
    if z > 1.12:
        return "head"
    return "torso"


for name in BODY:
    ob = O[name]
    groups = {b: ob.vertex_groups.new(name=b) for b in BONES}
    for v in ob.data.vertices:
        groups[region(v.co.x, v.co.z)].add([v.index], 1.0, "REPLACE")
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = rig


def bone_parent(ob, bone):
    """Prende o objeto a um osso mantendo a posição de repouso."""
    world = ob.matrix_world.copy()
    ob.parent = None
    ob.matrix_basis = world
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    ob.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    eff = ob.matrix_world @ world.inverted()  # matriz que o osso aplica com inverso identidade
    ob.matrix_parent_inverse = eff.inverted()
    bpy.context.view_layer.update()


def tool(name, boxes):
    """Ferramenta na mão: empty `tool_<nome>` + malha de caixas (cx, cy, cz, sx, sy, sz, rgb)."""
    import bmesh

    holder = bpy.data.objects.new(f"tool_{name}", None)
    bpy.context.scene.collection.objects.link(holder)
    holder.parent = O["task_tool"]
    bm = bmesh.new()
    mats = []
    for cx, cy, cz, sx, sy, sz, rgb in boxes:
        if rgb not in mats:
            mats.append(rgb)
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((sx, sy, sz, 1)), verts=r["verts"])
        for f in {f for v in r["verts"] for f in v.link_faces}:
            f.material_index = mats.index(rgb)
    me = bpy.data.meshes.new(f"tool_{name}_mesh")
    bm.to_mesh(me)
    bm.free()
    for i, rgb in enumerate(mats):
        m = bpy.data.materials.new(f"M_tool_{name}_{i}")
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (*rgb, 1)
        b.inputs["Roughness"].default_value = 0.6
        me.materials.append(m)
    ob = bpy.data.objects.new(f"tool_{name}_mesh", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = holder
    holder.hide_set(False)
    return holder


GRAY, DARK, ORANGE, BROWN, RED = (0.7, 0.72, 0.75), (0.08, 0.08, 0.1), (0.9, 0.45, 0.1), (0.5, 0.35, 0.2), (0.8, 0.1, 0.08)
# rodo de limpeza: cabo comprido, cabeça larga e borracha escura
tool("cleaning", [(0, 0, 0.12, 0.035, 0.035, 0.6, GRAY), (0, 0, 0.44, 0.34, 0.05, 0.06, ORANGE), (0, 0.0, 0.48, 0.32, 0.03, 0.03, DARK)])
# cesto de colheita com frutos
tool("harvest", [(0, 0.0, 0.0, 0.26, 0.18, 0.1, BROWN), (0, 0.0, 0.1, 0.22, 0.14, 0.04, DARK), (-0.06, 0, 0.14, 0.07, 0.07, 0.07, RED), (0.06, 0.02, 0.14, 0.07, 0.07, 0.07, RED)])
bone_parent(O["task_tool"], "arm_R")
bone_parent(O["crew_marker"], "torso")

# ---------------------------------------------------------------- rosto (visor-tela com 8 expressões)
import numpy as np  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

FACES = ["feliz", "empolgado", "neutro", "cansado", "preocupado", "dormindo", "surpreso", "piscada"]
CW, CH, COLS, ROWS = 256, 128, 4, 2
INK = np.array([0.72, 0.97, 1.0], dtype=np.float32)


def _grid():
    return np.meshgrid(np.arange(CW, dtype=np.float32) + 0.5, np.arange(CH, dtype=np.float32) + 0.5)


def _cov(d):
    return np.clip(0.5 - d, 0, 1)  # cobertura antisserrilhada a partir da distância em pixels


def disc(x, y, cx, cy, r):
    return _cov(np.hypot(x - cx, y - cy) - r)


def seg(x, y, x0, y0, x1, y1, t):
    px, py, dx, dy = x - x0, y - y0, x1 - x0, y1 - y0
    h = np.clip((px * dx + py * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
    return _cov(np.hypot(px - dx * h, py - dy * h) - t / 2)


def arc(x, y, cx, cy, r, a0, a1, t):
    """Arco entre os ângulos a0..a1 (graus, y para baixo: 0=direita, 90=embaixo)."""
    ang = np.degrees(np.arctan2(y - cy, x - cx)) % 360
    a0, a1 = a0 % 360, a1 % 360
    inside = (ang >= a0) & (ang <= a1) if a0 <= a1 else (ang >= a0) | (ang <= a1)
    d = np.where(inside, np.abs(np.hypot(x - cx, y - cy) - r) - t / 2, 1e3)
    for a in (a0, a1):
        ex, ey = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        d = np.minimum(d, np.hypot(x - ex, y - ey) - t / 2)
    return _cov(d)


def draw_face(name):
    x, y = _grid()
    ex1, ex2, ey, my = 86, 170, 48, 92
    m = np.zeros_like(x)
    add = lambda v: np.maximum(m, v)  # noqa: E731
    if name == "feliz":
        for ex in (ex1, ex2):
            m = add(arc(x, y, ex, ey + 12, 16, 200, 340, 7))  # olhos ^ ^
        m = add(arc(x, y, 128, my - 22, 34, 25, 155, 7))  # sorriso
    elif name == "empolgado":
        for ex in (ex1, ex2):
            m = add(disc(x, y, ex, ey, 17))
            m = np.where(disc(x, y, ex - 5, ey - 6, 5) > 0.3, 0, m)  # brilho no olho
        m = add(disc(x, y, 128, my - 8, 26) * (y > my - 10))  # boca aberta (meia lua)
        m = np.where((disc(x, y, 128, my + 8, 11) > 0.3), 0, m)  # língua (vazado)
    elif name == "neutro":
        for ex in (ex1, ex2):
            m = add(disc(x, y, ex, ey, 10))
        m = add(seg(x, y, 104, my, 152, my, 7))
    elif name == "cansado":
        for ex in (ex1, ex2):
            m = add(disc(x, y, ex, ey + 6, 15) * (y > ey + 4))  # pálpebra caída
            m = add(seg(x, y, ex - 17, ey + 4, ex + 17, ey + 4, 6))
        m = add(disc(x, y, 128, my, 9))  # bocejo
        m = np.where(disc(x, y, 128, my, 4) > 0.5, 0, m)
    elif name == "preocupado":
        for ex, s_ in ((ex1, 1), (ex2, -1)):
            m = add(disc(x, y, ex, ey + 6, 10))
            m = add(seg(x, y, ex - 18 * s_, ey - 16 + 6 * s_ * 0, ex + 16 * s_, ey - 26, 6))  # sobrancelha inclinada
        m = add(arc(x, y, 128, my + 22, 26, 215, 325, 7))  # boca para baixo
    elif name == "dormindo":
        for ex in (ex1, ex2):
            m = add(arc(x, y, ex, ey - 6, 16, 20, 160, 7))  # olhos fechados ‿
        m = add(disc(x, y, 128, my, 6))
        m = add(seg(x, y, 196, 24, 214, 24, 5))  # "z"
        m = add(seg(x, y, 214, 24, 196, 40, 5))
        m = add(seg(x, y, 196, 40, 214, 40, 5))
    elif name == "surpreso":
        for ex in (ex1, ex2):
            m = add(disc(x, y, ex, ey, 15))
            m = np.where(disc(x, y, ex, ey, 8) > 0.5, 0, m)
        m = add(disc(x, y, 128, my + 4, 15))
        m = np.where(disc(x, y, 128, my + 4, 8) > 0.5, 0, m)
    else:  # piscada
        m = add(arc(x, y, ex1, ey + 12, 16, 200, 340, 7))
        m = add(disc(x, y, ex2, ey, 15))
        m = add(arc(x, y, 128, my - 22, 34, 25, 155, 7))
    return m


atlas = np.zeros((CH * ROWS, CW * COLS), dtype=np.float32)
for i, n in enumerate(FACES):
    r, c = divmod(i, COLS)
    atlas[r * CH : (r + 1) * CH, c * CW : (c + 1) * CW] = draw_face(n)
rgba = np.dstack([np.broadcast_to(INK, atlas.shape + (3,)), atlas]).astype(np.float32)
fimg = bpy.data.images.new("Rostos", CW * COLS, CH * ROWS, alpha=True)
fimg.colorspace_settings.name = "sRGB"
fimg.alpha_mode = "STRAIGHT"
fimg.pixels.foreach_set(np.flipud(rgba).ravel())
fimg.pack()
fmat = bpy.data.materials.new("M_Rosto")
fmat.use_nodes = True
nt = fmat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = fimg
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
bsdf.inputs["Emission Strength"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.4
if hasattr(fmat, "surface_render_method"):
    fmat.surface_render_method = "BLENDED"

# viseira = vértices azul-escuros da cabeça; o rosto é uma grade que se cola na curva dela
body_ob = O["static_body_mesh"]
bme = body_ob.data
attr = bme.color_attributes.active_color or bme.color_attributes[0]
vc = {}
if attr.domain == "POINT":
    for i, d in enumerate(attr.data):
        vc[i] = d.color
else:
    for lp in bme.loops:
        vc[lp.vertex_index] = attr.data[lp.index].color
vis = [v.co for v in bme.vertices if v.co.z > 1.2 and vc[v.index][2] > 1.35 * vc[v.index][0] and vc[v.index][2] >= vc[v.index][1]]
print("VISEIRA vértices:", len(vis))
xs, ys, zs = [p.x for p in vis], [p.y for p in vis], [p.z for p in vis]
cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
hw, hh = (max(xs) - min(xs)) * 0.36, (max(zs) - min(zs)) * 0.30
ymin = min(ys)
print("VISEIRA centro", round(cx, 3), round(cz, 3), "meia-largura", round(hw, 3), "meia-altura", round(hh, 3), "frente y", round(ymin, 3))
bvh = BVHTree.FromObject(body_ob, bpy.context.evaluated_depsgraph_get())
NX, NY = 16, 8
verts, uvs = [], []
for j in range(NY + 1):
    for i in range(NX + 1):
        x = cx - hw + 2 * hw * i / NX
        z = cz + hh - 2 * hh * j / NY
        hit = bvh.ray_cast(Vector((x, ymin - 1.0, z)), Vector((0, 1, 0)))
        # 6 mm para a frente (-Y, de onde o raio veio): a normal da viseira pode apontar para dentro
        p = (hit[0] + Vector((0, -0.006, 0))) if hit[0] is not None else Vector((x, ymin - 0.006, z))
        verts.append(p)
        uvs.append((i / NX, 1 - j / NY))  # v=1 no topo (a imagem foi invertida ao carregar)
faces = [(j * (NX + 1) + i, j * (NX + 1) + i + 1, (j + 1) * (NX + 1) + i + 1, (j + 1) * (NX + 1) + i) for j in range(NY) for i in range(NX)]
fme = bpy.data.meshes.new("rosto")
fme.from_pydata([tuple(v) for v in verts], [], faces)
fme.update()
if sum(p.normal.y for p in fme.polygons) > 0:  # normais devem apontar para a frente (-Y)
    fme.flip_normals()
uvl = fme.uv_layers.new(name="UVMap")
for p in fme.polygons:
    for li in p.loop_indices:
        uvl.data[li].uv = uvs[fme.loops[li].vertex_index]
fme.materials.append(fmat)
for p in fme.polygons:
    p.use_smooth = True
face_ob = bpy.data.objects.new("face", fme)
bpy.context.scene.collection.objects.link(face_ob)
face_ob.parent = root
bone_parent(face_ob, "head")

# ---------------------------------------------------------------- animações
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
P = rig.pose.bones
for pb in P:
    pb.rotation_mode = "XYZ"
rad = math.radians
ad = rig.animation_data_create()


def clip(name, frames, fn):
    """fn(t, pose) com t em 0..2π; primeiro e último quadro iguais (laço perfeito)."""
    act = bpy.data.actions.new(name)
    ad.action = act
    for f in range(frames + 1):
        for pb in P:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
        fn(2 * math.pi * (f % frames) / frames)
        for pb in P:
            pb.keyframe_insert("rotation_euler", frame=f + 1)
            pb.keyframe_insert("location", frame=f + 1)
    track = ad.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, act)
    ad.action = None


def rx(pb, deg):
    pb.rotation_euler[0] = rad(deg)


def idle(t):
    P["torso"].location[1] = 0.012 * math.sin(t)
    rx(P["head"], 2 * math.sin(t + 1.0))
    rx(P["arm_R"], 3 * math.sin(t + 0.6))
    rx(P["arm_L"], -3 * math.sin(t + 0.6))
    P["arm_R"].rotation_euler[2] = rad(-3)
    P["arm_L"].rotation_euler[2] = rad(3)


def walk(t):
    s = math.sin(t)
    rx(P["leg_R"], -32 * s)
    rx(P["leg_L"], 32 * s)
    rx(P["arm_R"], 28 * s)
    rx(P["arm_L"], -28 * s)
    P["torso"].location[1] = -0.03 * abs(s)
    P["torso"].rotation_euler[1] = rad(5 * s)
    P["head"].rotation_euler[1] = rad(-4 * s)
    rx(P["torso"], 4)  # leve inclinação para a frente


def work(t):
    s = math.sin(t)
    rx(P["arm_R"], -(70 + 30 * s))
    rx(P["arm_L"], -(35 + 12 * math.sin(t + math.pi)))
    rx(P["torso"], 9 + 2 * s)
    rx(P["head"], 6)
    P["torso"].location[1] = -0.012 * abs(s)


def wave(t):
    rx(P["arm_R"], -150)
    P["arm_R"].rotation_euler[2] = rad(28 * math.sin(2 * t))
    rx(P["arm_L"], 4 * math.sin(t))
    P["torso"].location[1] = 0.01 * math.sin(t)
    P["head"].rotation_euler[1] = rad(6 * math.sin(t))


def clean(t):  # limpa um painel: braços para a frente, rodo vai e volta
    s = math.sin(t)
    rx(P["arm_R"], -(80 + 8 * s))
    rx(P["arm_L"], -(70 - 8 * s))
    P["arm_R"].rotation_euler[2] = rad(28 * math.sin(2 * t))
    P["arm_L"].rotation_euler[2] = rad(-20 * math.sin(2 * t + 0.6))
    rx(P["torso"], 9)
    P["torso"].rotation_euler[1] = rad(6 * math.sin(2 * t))
    rx(P["head"], -8)  # olha para cima, para o painel
    P["torso"].location[1] = -0.01 * abs(math.sin(2 * t))


def plant(t):  # planta: agacha e enterra a muda duas vezes por ciclo
    s = math.sin(2 * t)
    rx(P["torso"], 32 + 4 * s)
    rx(P["head"], 12)
    rx(P["arm_R"], -(105 - 35 * max(0, s)))
    rx(P["arm_L"], -(55 + 5 * s))
    P["torso"].location[1] = -0.07
    rx(P["leg_R"], -18)
    rx(P["leg_L"], 12)


def harvest(t):  # colhe: estica o braço para cima, colhe e põe no cesto
    s = math.sin(t)
    up = 0.5 + 0.5 * s
    rx(P["arm_R"], -(60 + 95 * up))
    rx(P["arm_L"], -50)  # segura o cesto
    rx(P["torso"], 4 + 6 * up)
    rx(P["head"], -6 * up)
    P["torso"].location[1] = 0.01 * up


clip("Idle", 72, idle)
clip("Walk", 24, walk)
clip("Work", 24, work)
clip("Wave", 48, wave)
clip("Clean", 48, clean)
clip("Plant", 48, plant)
clip("Harvest", 48, harvest)
bpy.ops.object.mode_set(mode="OBJECT")

# confere os eixos: perna +X rotacionada para a frente (-Y) deve subir o pé na frente
chk = P["leg_R"]
chk.rotation_euler[0] = rad(-30)
bpy.context.view_layer.update()
tail = rig.matrix_world @ chk.tail
print("CHK leg_R -30deg tail y,z =", round(tail.y, 3), round(tail.z, 3), "(y<0 = para a frente)")
chk.rotation_euler[0] = 0

# ---------------------------------------------------------------- exporta
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
kw = dict(
    filepath=OUT,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_skins=True,
    export_apply=False,
    export_yup=True,
    export_extras=True,
    export_force_sampling=True,
    export_optimize_animation_size=False,
)
props = bpy.ops.export_scene.gltf.get_rna_type().properties
if "export_vertex_color" in props:
    kw["export_vertex_color"] = "ACTIVE"
kw = {k: v for k, v in kw.items() if k in props}
bpy.ops.export_scene.gltf(**kw)
print("EXPORTADO", OUT)
