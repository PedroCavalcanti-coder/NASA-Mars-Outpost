"""
Terreno de Marte do jogo (apps/web/public/assets/bases/terreno.glb).

  blender -b --python assets-src/blender/terreno_marte.py

- Centro plano (R <= 76 m) para a base e o rover.
- Anel de montanhas (ruído de cumes), dunas suaves, crateras com borda elevada.
- Normais suaves + cor por vértice (areia, poeira clara, rocha escura nas encostas).
- Rochas espalhadas com as malhas do terreno antigo (GAME_Rocha_Grande_NN).
O jogo procura o chão pelo nome (GAME_Terreno) ou por ter > 5000 vértices.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "bases", "terreno.glb")
OLD = os.path.join(REPO, "apps", "web", "public", "assets", "bases", "terreno.glb")
SIZE = 340.0  # metros (o jogo escala 0,75)
CELLS = 170  # 2 m por célula
FLAT_R = 76.0
SEED = 7


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def fbm(x, y, oct=4, seed=0.0):
    v, amp, f, tot = 0.0, 1.0, 1.0, 0.0
    for i in range(oct):
        v += amp * noise.noise(Vector((x * f + seed, y * f - seed, i * 3.1)))
        tot += amp
        amp *= 0.5
        f *= 2.03
    return v / tot


def ridged(x, y, seed=0.0):
    """Cumes afiados: 0 (vale) a ~1 (crista)."""
    v = noise.ridged_multi_fractal(Vector((x + seed, y - seed, 4.2)), 1.0, 2.1, 5, 0.9, 2.0)
    return max(0.0, min(1.0, v / 1.4))


rnd = random.Random(SEED)
BIG = [(112, -62, 19, 5.5), (-122, 70, 27, 8.0), (62, 132, 15, 3.5), (-72, -130, 21, 5.0), (140, 98, 12, 3.0)]
SMALL = []
while len(SMALL) < 26:
    a, r = rnd.uniform(0, math.tau), rnd.uniform(88, 150)
    c = (math.cos(a) * r, math.sin(a) * r, rnd.uniform(3, 7.5), rnd.uniform(0.5, 1.3))
    if all(math.hypot(c[0] - b[0], c[1] - b[1]) > b[2] + c[2] + 4 for b in BIG):
        SMALL.append(c)
CRATERS = BIG + SMALL


def crater(x, y):
    h = 0.0
    for cx, cy, R, D in CRATERS:
        d = math.hypot(x - cx, y - cy)
        if d > R * 1.6:
            continue
        u = d / R
        if u < 1.0:
            h -= D * (1 - u * u) ** 1.4  # bacia
        h += 0.28 * D * math.exp(-(((u - 1.0) / 0.16) ** 2))  # borda elevada
    return h


def height(x, y):
    r = math.hypot(x, y)
    w = sstep(FLAT_R, 125.0, r)  # 0 no centro, 1 longe
    rolling = fbm(x * 0.011, y * 0.011, 4, 1.7) * 6.0 + fbm(x * 0.05, y * 0.05, 3, 9.1) * 1.0
    dune = math.sin((x * 0.6 + y * 0.8) * 0.11 + fbm(x * 0.02, y * 0.02, 2, 3.3) * 5) * 0.9 * sstep(80, 120, r)
    # anel de montanhas: começa em ~125 m e cresce até a borda
    mw = sstep(92.0, 160.0, r) ** 1.2
    edge = sstep(120.0, 168.0, max(abs(x), abs(y)))
    ridge = ridged(x * 0.0065, y * 0.0065, 11.0)
    peaks = (ridge * 42.0 + fbm(x * 0.02, y * 0.02, 3, 5.5) * 6.0 + 6.0) * mw + 18.0 * edge
    return w * (rolling + dune + crater(x, y)) + peaks


# ---------------------------------------------------------------- malha do chão
bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=CELLS, y_segments=CELLS, size=SIZE / 2)
bm.verts.ensure_lookup_table()
hs = []
for v in bm.verts:
    h = height(v.co.x, v.co.y)
    v.co.z = h
    hs.append(h)
bm.normal_update()
me = bpy.data.meshes.new("Mars_Terreno_Mesh")
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True

# cor por vértice: areia, poeira clara nos planos, rocha escura nas encostas
me.calc_loop_triangles()
vn = [v.normal.copy() for v in me.vertices]
col = me.color_attributes.new("Color", "FLOAT_COLOR", "POINT")


def lin(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


SAND = (0.74, 0.40, 0.24)
DUST = (0.82, 0.52, 0.34)
ROCK = (0.36, 0.20, 0.15)
PEAK = (0.52, 0.34, 0.26)
for i, v in enumerate(me.vertices):
    x, y, z = v.co
    slope = 1.0 - max(0.0, vn[i].z)
    n = fbm(x * 0.06, y * 0.06, 3, 2.2) * 0.5 + 0.5
    base = [SAND[k] + (DUST[k] - SAND[k]) * n for k in range(3)]
    rockiness = sstep(0.10, 0.42, slope + max(0.0, z - 14.0) / 120.0)
    c = [base[k] + (ROCK[k] - base[k]) * rockiness for k in range(3)]
    top = sstep(26.0, 52.0, z)  # cumes um pouco mais claros (poeira/gelo seco)
    c = [c[k] + (PEAK[k] - c[k]) * top * 0.6 for k in range(3)]
    shade = 0.92 + 0.16 * fbm(x * 0.4, y * 0.4, 2, 7.7)  # variação fina para não ficar chapado
    col.data[i].color = (*lin([min(1.0, max(0.0, k * shade)) for k in c]), 1.0)

mat = bpy.data.materials.new("M_Mars_Terreno")
mat.use_nodes = True
nt = mat.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
cn = nt.nodes.new("ShaderNodeVertexColor")
cn.layer_name = "Color"
nt.links.new(cn.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.93
bsdf.inputs["Metallic"].default_value = 0.0
me.materials.append(mat)
ground = bpy.data.objects.new("GAME_Terreno", me)
bpy.context.scene.collection.objects.link(ground)

# ---------------------------------------------------------------- rochas (malhas do terreno antigo)
rock_mat = bpy.data.materials.new("M_Mars_Rock")
rock_mat.use_nodes = True
rb = next(n for n in rock_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
rb.inputs["Base Color"].default_value = (0.46, 0.16, 0.07, 1)
rb.inputs["Roughness"].default_value = 0.9

variants = []
if os.path.exists(OLD):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=OLD)
    old = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before]
    seen = set()
    for o in old:
        if o.type == "MESH" and o.name.startswith("GAME_Rocha") and o.data.name not in seen:
            seen.add(o.data.name)
            variants.append(o.data)
    for o in old:
        bpy.data.objects.remove(o, do_unlink=True)
if not variants:  # sem GLB antigo: rochas simples
    for k in range(6):
        b = bmesh.new()
        bmesh.ops.create_icosphere(b, subdivisions=1, radius=1.0)
        for v in b.verts:
            v.co *= 0.7 + 0.6 * rnd.random()
        m = bpy.data.meshes.new(f"Rocha_Var_{k}")
        b.to_mesh(m)
        b.free()
        variants.append(m)
for m in variants:
    m.materials.clear()
    m.materials.append(rock_mat)
    for p in m.polygons:
        p.use_smooth = False

placed = 0
tries = 0
while placed < 110 and tries < 4000:
    tries += 1
    a = rnd.uniform(0, math.tau)
    r = rnd.uniform(62, 160) if rnd.random() < 0.7 else rnd.uniform(30, 62)
    x, y = math.cos(a) * r, math.sin(a) * r
    if abs(x) > SIZE / 2 - 6 or abs(y) > SIZE / 2 - 6:
        continue
    # grupos: mais pedras perto de crateras e montanhas
    z = height(x, y)
    o = bpy.data.objects.new(f"GAME_Rocha_Grande_{placed:02d}", rnd.choice(variants))
    s = rnd.uniform(0.9, 2.4) * (1.5 if r > 120 else 1.0)
    o.scale = (s * rnd.uniform(0.8, 1.2), s * rnd.uniform(0.6, 1.1), s * rnd.uniform(0.8, 1.2))
    o.location = (x, y, z + 0.15 * s)
    o.rotation_euler = (rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), rnd.uniform(0, math.tau))
    bpy.context.scene.collection.objects.link(o)
    placed += 1

print("ALTURA min/max:", round(min(hs), 1), round(max(hs), 1), "| triângulos:", len(me.polygons) * 2, "| rochas:", placed)

# ---------------------------------------------------------------- exporta
bpy.ops.object.select_all(action="SELECT")
props = bpy.ops.export_scene.gltf.get_rna_type().properties
kw = dict(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_vertex_color="ACTIVE",
)
bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "Terreno_Marte.blend"))
print("EXPORTADO", OUT)
