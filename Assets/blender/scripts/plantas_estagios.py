"""
Plantas do jogo em vários estágios de crescimento -> apps/web/public/assets/bases/plantas.glb

  blender -b assets-src/blender/MarsOutpost_Bases.blend --python assets-src/blender/plantas_estagios.py

Três culturas no canteiro hidropônico (água com nutrientes + luz de cultivo, sem solo):
  Batata (6 estágios) · Alface (5) · Tomate (6)
Nomes dos nós: PLANTA_<Cultura>_<n>_<Estágio>. O jogo escolhe o estágio pelo progresso do cultivo
e o astronauta planta (estágios 0-1) e colhe (último estágio). O .blend não é salvo.
"""
import math
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "bases", "plantas.glb")

g = globals()
exec(open(os.path.join(HERE, "lib_kit.py"), encoding="utf8").read(), g)  # Piece, mat, collection
exec(open(os.path.join(HERE, "moveis.py"), encoding="utf8").read(), g)  # _canteiro, SPOTS, W, D, cores


def cmat(name, rgb, rough=0.6):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


M_FLOR_B = cmat("M_Flor_Branca", (0.93, 0.93, 0.88))
M_FLOR_Y = cmat("M_Flor_Amarela", (0.95, 0.78, 0.1))
M_FLOR_R = cmat("M_Flor_Roxa", (0.55, 0.3, 0.7))
M_TOM_V = cmat("M_Tomate_Verde", (0.35, 0.55, 0.15))
M_TOM_R = cmat("M_Tomate", (0.82, 0.1, 0.08), 0.35)
M_ALF = cmat("M_Alface", (0.38, 0.68, 0.2))
M_ALF_C = cmat("M_Alface_Clara", (0.6, 0.82, 0.35))
M_ALF_R = cmat("M_Alface_Roxa", (0.45, 0.18, 0.3))
M_CESTO = cmat("M_Cesto", (0.45, 0.32, 0.18), 0.9)
Z = 0.74  # topo do substrato
S = lambda p, r, x, y, z, m, sc=(1, 1, 1): p.sphere(r, x, y, z, m, sub=0, scale=sc)  # noqa: E731  (20 tris)


def cesto(p, mat_fruto, qtd=7, r=0.08):
    p.boxz((0.6, 0.35, 0.22), 0.6, -0.65, 0, mat("M_Dark_Metal"))
    for k in range(qtd):
        p.sphere(r, 0.38 + (k % 4) * 0.14, -0.72 + (k // 4) * 0.15, 0.25, mat_fruto, sub=1)


# ---------------------------------------------------------------- batata
def batata(stage):
    p = _canteiro()
    for i, (x, y) in enumerate(SPOTS):
        if stage == 1:  # batata-semente enterrada
            p.sphere(0.05, x, y, Z + 0.02, mat("M_Batata"), sub=1, scale=(1.3, 1, 0.8))
        elif stage == 2:
            _broto(p, x, y, Z)
        elif stage == 3:
            _planta(p, x, y, Z, 0.55 if (i % 3) else 0.45)
        elif stage >= 4:
            _planta(p, x, y, Z, 1.0 if (i % 3) else 0.85, madura=stage == 5)
        if stage == 4:  # florada
            for dx, dy in ((-0.05, 0.0), (0.06, 0.04), (0.0, -0.06)):
                S(p, 0.035, x + dx, y + dy, Z + 0.62 * (1.0 if (i % 3) else 0.85), M_FLOR_B if i % 2 else M_FLOR_R)
        if stage == 5:
            for dx, dy in ((-0.12, -0.13), (0.11, -0.12), (0.0, 0.14)):
                p.sphere(0.075, x + dx, y + dy, Z + 0.04, mat("M_Batata"), sub=1, scale=(1.3, 1, 0.9))
    if stage == 5:
        cesto(p, mat("M_Batata"))
    return p


# ---------------------------------------------------------------- alface
def rosette(p, x, y, n, r, d, h, mats):
    for k in range(n):
        a = 2 * math.pi * k / n + 0.4 * (k % 2)
        S(p, r, x + math.cos(a) * d, y + math.sin(a) * d, Z + h + 0.015 * (k % 3), mats[k % len(mats)], (1.35, 0.85, 0.3))


def alface(stage):
    p = _canteiro()
    for i, (x, y) in enumerate(SPOTS):
        if stage == 1:  # muda: duas folhinhas
            rosette(p, x, y, 2, 0.035, 0.02, 0.02, (M_ALF_C,))
        elif stage == 2:
            rosette(p, x, y, 5, 0.065, 0.05, 0.03, (M_ALF_C, M_ALF))
        elif stage == 3:
            rosette(p, x, y, 8, 0.095, 0.08, 0.05, (M_ALF, M_ALF_C))
            rosette(p, x, y, 4, 0.07, 0.03, 0.1, (M_ALF_C,))
        elif stage == 4:  # cabeça fechada, pronta para colher
            rosette(p, x, y, 9, 0.12, 0.1, 0.06, (M_ALF_R if i % 4 == 0 else M_ALF, M_ALF))
            rosette(p, x, y, 6, 0.1, 0.05, 0.14, (M_ALF_C, M_ALF))
            S(p, 0.1, x, y, Z + 0.22, M_ALF_C, (1, 1, 0.8))
    if stage == 4:
        cesto(p, M_ALF, qtd=5, r=0.1)
    return p


# ---------------------------------------------------------------- tomate
def tomate(stage):
    p = _canteiro()
    alt = {1: 0.14, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.0}
    for i, (x, y) in enumerate(SPOTS):
        if stage == 0:
            continue
        h = alt[stage] * (1.0 if (i % 3) else 0.88)
        if stage >= 2:
            p.cyl(0.012, h + 0.15, x, y, Z, mat("M_Aco"), seg=4)  # estaca de apoio
        p.cyl(0.018, h, x, y, Z, mat("M_Caule"), seg=5)
        n = 2 if stage == 1 else 3 + stage
        for k in range(n):
            t = (k + 1) / (n + 1)
            S(p, 0.07 if stage > 1 else 0.04, x + (0.07 if k % 2 else -0.07), y + 0.02 * (k % 3 - 1), Z + h * t, mat("M_Folha"), (1.3, 0.8, 0.45))
        if stage == 3:  # flores amarelas
            for k in range(3):
                S(p, 0.03, x + 0.05 * (k - 1), y + 0.04, Z + h * (0.55 + 0.12 * k), M_FLOR_Y)
        if stage >= 4:  # frutos em cachos
            for k in range(4 if stage == 4 else 5):
                S(p, 0.05, x + 0.06 * ((k % 2) * 2 - 1), y + 0.05 * (k % 3 - 1), Z + h * (0.42 + 0.1 * k), M_TOM_V if stage == 4 else M_TOM_R)
    if stage == 5:
        cesto(p, M_TOM_R, qtd=7, r=0.065)
    return p


CROPS = {
    "Batata": (batata, ["0_Vazio", "1_Semente", "2_Broto", "3_Jovem", "4_Crescida", "5_Colheita"]),
    "Alface": (alface, ["0_Vazio", "1_Muda", "2_Pequena", "3_Media", "4_Colheita"]),
    "Tomate": (tomate, ["0_Vazio", "1_Muda", "2_Jovem", "3_Florada", "4_FrutosVerdes", "5_Colheita"]),
}

col = bpy.data.collections.new("PLANTAS_EXPORT")
bpy.context.scene.collection.children.link(col)
objs = []
for cname, (fn, stages) in CROPS.items():
    for i, st in enumerate(stages):
        ob = fn(i).build(f"PLANTA_{cname}_{st}", col, (0, 0, 0))
        objs.append(ob)
        print("PLANTA", ob.name, sum(len(p.vertices) - 2 for p in ob.data.polygons))

bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
props = bpy.ops.export_scene.gltf.get_rna_type().properties
kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})
print("EXPORTADO", OUT, len(objs))
