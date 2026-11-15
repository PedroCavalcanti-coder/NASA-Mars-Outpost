# Acessórios opcionais (cada um é um objeto separado, prefixo acc_) + atlas de emblemas.
# Requer ast2_lib.py executado antes.
import bpy, math, os
import numpy as np
from mathutils import Vector, Matrix

OUT_DIR = r"C:\Users\Dev_RV01\Documents\Github\NASA-Mars-Outpost\Assets\texturas\jogo\astronauta_v2"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------- atlas de emblemas 1024x256 (4 células 256x256) ----------------
N = 256
yy, xx = np.meshgrid(np.arange(N, dtype=np.float32) + 0.5, np.arange(N, dtype=np.float32) + 0.5, indexing='ij')
def cov(d): return np.clip(0.5 - d, 0, 1)
def disc(cx, cy, r): return cov(np.hypot(xx - cx, yy - cy) - r)
def ringm(cx, cy, r, t): return cov(np.abs(np.hypot(xx - cx, yy - cy) - r) - t / 2)
def poly(pts):
    """polígono convexo/estrela simples por teste de paridade."""
    inside = np.zeros_like(xx, dtype=bool); n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]; x1, y1 = pts[(i + 1) % n]
        cond = ((y0 > yy) != (y1 > yy)) & (xx < (x1 - x0) * (yy - y0) / (y1 - y0 + 1e-9) + x0)
        inside ^= cond
    return inside.astype(np.float32)
def paint(img, mask, rgb):
    for k in range(3):
        img[..., k] = img[..., k] * (1 - mask) + rgb[k] * mask
    img[..., 3] = np.maximum(img[..., 3], mask)

C = 128
NAVY, ORANGE, WHITE, YEL, TEAL, RED = (0.06, 0.12, 0.30), (0.93, 0.36, 0.06), (0.95, 0.95, 0.95), (0.98, 0.78, 0.25), (0.15, 0.55, 0.55), (0.75, 0.25, 0.15)
cells = []
# 0: Marte com anel orbital
im = np.zeros((N, N, 4), np.float32)
paint(im, disc(C, C, 118), WHITE); paint(im, disc(C, C, 106), NAVY)
paint(im, disc(C, C, 52), ORANGE); paint(im, disc(C - 14, C - 12, 12) * disc(C, C, 52), RED)
ell = cov(np.abs(np.hypot((xx - C) / 1.0, (yy - C) / 0.32) - 82) / 2.2 - 3.5)
ell = ell * np.clip((yy > C) + (np.hypot(xx - C, yy - C) > 52), 0, 1)
paint(im, ell, WHITE)
for (sx_, sy_) in ((70, 70), (190, 80), (180, 190), (78, 186)): paint(im, disc(sx_, sy_, 4), WHITE)
cells.append(im)
# 1: foguete
im = np.zeros((N, N, 4), np.float32)
paint(im, disc(C, C, 118), WHITE); paint(im, disc(C, C, 106), ORANGE)
paint(im, poly([(C, 40), (C + 30, 95), (C + 30, 170), (C - 30, 170), (C - 30, 95)]), WHITE)
paint(im, poly([(C - 30, 130), (C - 58, 190), (C - 30, 175)]), NAVY); paint(im, poly([(C + 30, 130), (C + 58, 190), (C + 30, 175)]), NAVY)
paint(im, disc(C, 112, 13), NAVY); paint(im, disc(C, 112, 8), (0.4, 0.75, 0.95))
paint(im, poly([(C - 16, 172), (C + 16, 172), (C, 215)]), YEL)
cells.append(im)
# 2: estrela
im = np.zeros((N, N, 4), np.float32)
paint(im, disc(C, C, 118), YEL); paint(im, disc(C, C, 106), NAVY)
pts = []
for i in range(10):
    a = -math.pi / 2 + i * math.pi / 5; r = 78 if i % 2 == 0 else 32
    pts.append((C + r * math.cos(a), C + r * math.sin(a)))
paint(im, poly(pts), YEL); paint(im, ringm(C, C, 96, 4), WHITE)
cells.append(im)
# 3: montanha (Olympus Mons) com sol
im = np.zeros((N, N, 4), np.float32)
paint(im, disc(C, C, 118), WHITE); paint(im, disc(C, C, 106), TEAL)
paint(im, disc(C + 40, C - 40, 22), YEL)
paint(im, poly([(30, 190), (110, 95), (150, 135), (175, 115), (226, 190)]) * disc(C, C, 106), ORANGE)
paint(im, poly([(95, 113), (110, 95), (125, 113)]), WHITE)
cells.append(im)
GREEN, STEEL, SCI = (0.30, 0.72, 0.38), (0.62, 0.66, 0.70), (0.55, 0.40, 0.85)
def segm(x0, y0, x1, y1, t):
    px, py, dx, dy = xx - x0, yy - y0, x1 - x0, y1 - y0
    h = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
    return cov(np.hypot(px - dx * h, py - dy * h) - t / 2)
def badge(bg, ring=WHITE):
    im = np.zeros((N, N, 4), np.float32); paint(im, disc(C, C, 118), ring); paint(im, disc(C, C, 106), bg); return im
# 4: Botânica (folha)
im = badge(GREEN)
leaf = np.clip(disc(C - 28, C + 10, 62) * disc(C + 28, C - 10, 62), 0, 1)
paint(im, leaf, WHITE); paint(im, segm(C - 40, C + 44, C + 40, C - 44, 7), GREEN); paint(im, segm(C - 40, C + 44, C - 62, C + 66, 9), WHITE)
cells.append(im)
# 5: Engenharia (chave inglesa)
im = badge(STEEL, ORANGE)
paint(im, segm(C - 52, C + 52, C + 30, C - 30, 26), NAVY)
paint(im, disc(C + 40, C - 40, 34), NAVY); paint(im, poly([(C + 40, C - 40), (C + 90, C - 70), (C + 70, C - 90)]), STEEL)
paint(im, disc(C + 40, C - 40, 13), STEEL)
cells.append(im)
# 6: Medicina (cruz)
im = badge(WHITE, RED)
paint(im, poly([(C - 22, C - 70), (C + 22, C - 70), (C + 22, C + 70), (C - 22, C + 70)]), RED)
paint(im, poly([(C - 70, C - 22), (C + 70, C - 22), (C + 70, C + 22), (C - 70, C + 22)]), RED)
cells.append(im)
# 7: Ciência (frasco)
im = badge(SCI)
paint(im, poly([(C - 16, C - 72), (C + 16, C - 72), (C + 16, C - 20), (C + 60, C + 66), (C - 60, C + 66), (C - 16, C - 20)]), WHITE)
paint(im, poly([(C - 34, C + 20), (C + 34, C + 20), (C + 50, C + 56), (C - 50, C + 56)]), (0.4, 0.85, 0.95))
paint(im, disc(C - 10, C + 36, 6), WHITE); paint(im, disc(C + 14, C + 28, 4), WHITE)
cells.append(im)
atlas = np.concatenate([np.concatenate(cells[:4], axis=1), np.concatenate(cells[4:], axis=1)], axis=0)
_e = bpy.data.images.get("AST2_Emblemas")
eimg = bpy.data.images.new("AST2_Emblemas_new", 4 * N, 2 * N, alpha=True)
if _e:
    _e.user_remap(eimg); bpy.data.images.remove(_e)
eimg.name = "AST2_Emblemas"; eimg.alpha_mode = 'STRAIGHT'
eimg.pixels.foreach_set(np.flipud(atlas).ravel())
eimg.filepath_raw = os.path.join(OUT_DIR, "emblemas.png"); eimg.file_format = 'PNG'; eimg.save(); eimg.pack()

em = bpy.data.materials.get("AST2_Emblema") or bpy.data.materials.new("AST2_Emblema")
nt = em.node_tree
for n in list(nt.nodes):
    if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'): nt.nodes.remove(n)
b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
t = nt.nodes.new("ShaderNodeTexImage"); t.image = eimg
nt.links.new(t.outputs["Color"], b.inputs["Base Color"]); nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
b.inputs["Roughness"].default_value = 0.7
if hasattr(em, "surface_render_method"): em.surface_render_method = "DITHERED"
MAT["emblem"] = em

# ---------------- coleção/rig de demonstração ----------------
parent_col = bpy.data.collections["GAL_Personagem_e_plantas"]
col = bpy.data.collections.get("GAL_astronauta2_Acessorios") or bpy.data.collections.new("GAL_astronauta2_Acessorios")
if col.name not in [c.name for c in parent_col.children]: parent_col.children.link(col)
master_rig = bpy.data.objects["astronaut2_rig"]
root = bpy.data.objects.get("astronaut2_root_Acessorios") or bpy.data.objects.new("astronaut2_root_Acessorios", None)
if root.name not in col.objects: col.objects.link(root)
root.location = (624, -78, 0)
rig = bpy.data.objects.get("astronaut2_rig_Acessorios") or bpy.data.objects.new("astronaut2_rig_Acessorios", master_rig.data)
if rig.name not in col.objects: col.objects.link(rig)
rig.parent = root
ad = rig.animation_data_create(); ad.action = bpy.data.actions["AST2_Idle"]
try: ad.action_slot = ad.action.slots[0]
except Exception: pass
for src in [o for o in bpy.data.collections["GAL_astronauta2_Idle"].objects if o.type == 'MESH' and o.name.startswith("AST2_")]:
    nm = src.name + "_Acessorios"
    o = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, src.data)
    if o.name not in col.objects: col.objects.link(o)
    attach(o, rig)

# ---------------- acessórios ----------------
def make(name, slots, build):
    P = Part(slots); build(P)
    me = P.to_mesh(name + "_mesh")
    o = bpy.data.objects.get(name)
    if o:
        old = o.data; o.data = me; bpy.data.meshes.remove(old)
    else:
        o = bpy.data.objects.new(name, me); col.objects.link(o)
    attach(o, rig)
    return len(me.polygons)

def lanterna(P):  # lanterna de capacete
    P.cyl((-0.2, -0.13, 1.63), 0.045, 0.045, 0.03, "head", "helmet", seg=16, r=0.008, rot=Matrix.Rotation(-0.6, 3, 'Y'))
    P.cyl((-0.215, -0.17, 1.6), 0.038, 0.034, 0.07, "head", "metal", axis='Y', seg=16, r=0.01)
    P.cyl((-0.215, -0.207, 1.6), 0.03, 0.03, 0.008, "head", "light", axis='Y', seg=16)
def parabolica(P):  # mini antena parabólica na mochila
    P.cyl((-0.2, 0.33, 1.2), 0.012, 0.012, 0.08, "torso", "metal", seg=8)
    P.cyl((-0.2, 0.33, 1.27), 0.075, 0.02, 0.035, "torso", "backpack", seg=20, r=0.006, rot=Matrix.Rotation(0.5, 3, 'X'))
    P.cyl((-0.2, 0.31, 1.295), 0.006, 0.006, 0.05, "torso", "metal", seg=6, rot=Matrix.Rotation(0.5, 3, 'X'))
def tanques(P):  # tanques de oxigênio nas costas
    for sx in (-1, 1):
        P.cyl((sx * 0.13, 0.43, 0.9), 0.075, 0.075, 0.46, "torso", "backpack", seg=20, r=0.05, rseg=3)
        P.cyl((sx * 0.13, 0.43, 1.15), 0.025, 0.025, 0.05, "torso", "metal", seg=10, r=0.006)
        P.cyl((sx * 0.13, 0.43, 0.8), 0.078, 0.078, 0.02, "torso", "black", seg=20)
        P.cyl((sx * 0.13, 0.43, 1.0), 0.078, 0.078, 0.02, "torso", "black", seg=20)
def joelheiras(P):
    for s, sx in (("L", -1), ("R", 1)):
        P.box((sx * 0.13, -0.135, 0.36), (0.17, 0.05, 0.13), "shin_" + s, "suit", r=0.024, seg=3)
        P.cyl((sx * 0.13, -0.162, 0.36), 0.03, 0.03, 0.008, "shin_" + s, "metal", axis='Y', seg=12)
def bolsas(P):
    for sx in (-1, 1):
        P.box((sx * 0.27, -0.13, 0.64), (0.1, 0.1, 0.12), "torso", "vest", r=0.025, seg=3)
        P.box((sx * 0.27, -0.18, 0.675), (0.104, 0.012, 0.05), "torso", "vest", r=0.005, seg=2)
        P.cyl((sx * 0.27, -0.186, 0.66), 0.01, 0.01, 0.006, "torso", "metal", axis='Y', seg=8)
def cracha(P):
    P.box((0.04, -0.214, 0.785), (0.12, 0.012, 0.035), "torso", "metal", r=0.004, seg=2)
    P.box((0.04, -0.2205, 0.785), (0.1, 0.004, 0.022), "torso", "panel")
def luzes_ombro(P):
    for s, sx in (("L", -1), ("R", 1)):
        P.cyl((sx * 0.39, -0.04, 1.118), 0.022, 0.022, 0.016, "arm_" + s, "metal", seg=12, r=0.004)
        P.cyl((sx * 0.39, -0.04, 1.128), 0.015, 0.015, 0.008, "arm_" + s, "light", seg=12)

counts = {
    "acc_lanterna_capacete": make("acc_lanterna_capacete", ["helmet", "metal", "light"], lanterna),
    "acc_antena_parabolica": make("acc_antena_parabolica", ["backpack", "metal"], parabolica),
    "acc_tanques_oxigenio": make("acc_tanques_oxigenio", ["backpack", "metal", "black"], tanques),
    "acc_joelheiras": make("acc_joelheiras", ["suit", "metal"], joelheiras),
    "acc_bolsas_cinto": make("acc_bolsas_cinto", ["vest", "metal"], bolsas),
    "acc_cracha": make("acc_cracha", ["metal", "panel"], cracha),
    "acc_luzes_ombro": make("acc_luzes_ombro", ["metal", "light"], luzes_ombro),
}

# ---------------- decalques de marca (atlas 4x2: célula = repeat 0.25x0.5, offset por célula) ----------------
def decal(name, items, cell):
    """items: (centro, normal, up, meia-largura, osso). UV aponta para a célula `cell` do atlas."""
    cu, cv = (cell % 4) * 0.25, 0.5 if cell < 4 else 0.0
    me = bpy.data.meshes.new(name + "_mesh_new")
    tmp = bpy.data.objects.new("_tmp_vg", me)
    for b in BN: tmp.vertex_groups.new(name=b)
    verts, faces, uvs, groups = [], [], [], []
    for (c, n, up, h, bone) in items:
        c, n, up = Vector(c), Vector(n).normalized(), Vector(up)
        right = up.cross(n).normalized(); up = n.cross(right).normalized()
        base = len(verts)
        for (a, b, u, v) in ((-1, -1, 0, 0), (1, -1, 1, 0), (1, 1, 1, 1), (-1, 1, 0, 1)):
            verts.append(c + n * 0.002 + right * a * h + up * b * h); uvs.append((cu + u * 0.25, cv + v * 0.5))
        faces.append((base, base + 1, base + 2, base + 3)); groups.append(bone)
    me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    uvl = me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        for li in p.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    for p, bone in zip(me.polygons, groups):
        tmp.vertex_groups[bone].add(list(p.vertices), 1.0, 'REPLACE')
    bpy.data.objects.remove(tmp)
    me.materials.append(em)
    o = bpy.data.objects.get(name)
    if o:
        old = o.data; o.data = me; bpy.data.meshes.remove(old)
    else:
        o = bpy.data.objects.new(name, me); col.objects.link(o)
    me.name = name + "_mesh"
    attach(o, rig)
    return len(me.polygons)

import math as _m
def on_ell(c, sc, dirv):
    d = Vector(dirv).normalized()
    p = Vector(c) + Vector((d.x * sc[0], d.y * sc[1], d.z * sc[2]))
    n = Vector((d.x / sc[0], d.y / sc[1], d.z / sc[2])).normalized()
    return p, n
items = []
for s, sx in (("L", -1), ("R", 1)):
    p, n = on_ell((sx * 0.37, 0, 1.0), (0.135, 0.155, 0.12), (sx, 0.1, -0.1))
    items.append((p, n, (0, 0, 1), 0.042, "arm_" + s))
counts["acc_emblema_ombro"] = decal("acc_emblema_ombro", items, 0)
counts["acc_emblema_peito"] = decal("acc_emblema_peito", [((-0.13, -0.21, 0.785), (0, -1, 0), (0, 0, 1), 0.04, "torso")], 4)
p, n = on_ell((0, 0.01, 1.41), (0.31, 0.30, 0.29), (-0.75, 0.35, 0.45))
counts["acc_emblema_capacete"] = decal("acc_emblema_capacete", [(p, n, (0, 0, 1), 0.05, "head")], 1)
counts["acc_emblema_mochila"] = decal("acc_emblema_mochila", [((0, 0.41, 1.0), (0, 1, 0), (0, 0, 1), 0.08, "torso")], 2)

lbl = bpy.data.objects.get("LBL2_Acessorios")
if not lbl:
    fd = bpy.data.objects["LBL_Idle"].data.copy(); fd.body = "Acessorios (novo)"
    lbl = bpy.data.objects.new("LBL2_Acessorios", fd); col.objects.link(lbl)
lbl.location = (624, -81, 0.05); lbl.rotation_euler = bpy.data.objects["LBL_Idle"].rotation_euler
RESULT_ACC = {"acc": counts, "emblemas": eimg.filepath_raw}
