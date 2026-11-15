# Rosto LED do astronauta v2: atlas 1024x256 (4x2), mesma ordem do jogo:
# 0 feliz · 1 empolgado · 2 neutro · 3 cansado · 4 preocupado · 5 dormindo · 6 surpreso · 7 piscada
# Requer ast2_lib.py executado antes (Part, BN, attach, ell_point...).
import bpy, math, os
import numpy as np
from mathutils import Vector

OUT_DIR = r"C:\Users\Dev_RV01\Documents\Github\NASA-Mars-Outpost\Assets\texturas\jogo\astronauta_v2"
os.makedirs(OUT_DIR, exist_ok=True)
CW, CH, COLS, ROWS = 256, 128, 4, 2
INK = np.array([0.55, 0.93, 1.0], dtype=np.float32)
S = 1.25            # formas um pouco maiores que no rosto antigo (lê melhor em pontos)
PITCH = 5.0         # distância entre LEDs (px)
DOT_R = 1.9         # raio do LED (px)


def grid():
    x, y = np.meshgrid(np.arange(CW, dtype=np.float32) + 0.5, np.arange(CH, dtype=np.float32) + 0.5)
    # coordenadas "do rosto antigo" (escala em torno do centro)
    return 128 + (x - 128) / S, 64 + (y - 64) / S


def cov(d):
    return np.clip(0.5 - d * S, 0, 1)


def disc(x, y, cx, cy, r):
    return cov(np.hypot(x - cx, y - cy) - r)


def ring(x, y, cx, cy, r, t):
    return cov(np.abs(np.hypot(x - cx, y - cy) - r) - t / 2)


def seg(x, y, x0, y0, x1, y1, t):
    px, py, dx, dy = x - x0, y - y0, x1 - x0, y1 - y0
    h = np.clip((px * dx + py * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
    return cov(np.hypot(px - dx * h, py - dy * h) - t / 2)


def arc(x, y, cx, cy, r, a0, a1, t):
    ang = np.degrees(np.arctan2(y - cy, x - cx)) % 360
    a0, a1 = a0 % 360, a1 % 360
    inside = (ang >= a0) & (ang <= a1) if a0 <= a1 else (ang >= a0) | (ang <= a1)
    d = np.where(inside, np.abs(np.hypot(x - cx, y - cy) - r) - t / 2, 1e3)
    for a in (a0, a1):
        ex, ey = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        d = np.minimum(d, np.hypot(x - ex, y - ey) - t / 2)
    return cov(d)


def draw(name):
    x, y = grid()
    e1, e2, ey, my = 88, 168, 50, 92
    m = np.zeros_like(x)
    add = lambda v: np.maximum(m, v)  # noqa: E731
    if name == "feliz":                       # olhos-anel da referência + sorriso
        for ex in (e1, e2):
            m = add(ring(x, y, ex, ey, 15, 8)); m = add(disc(x, y, ex, ey, 4.5))
        m = add(arc(x, y, 128, my - 24, 30, 30, 150, 7))
    elif name == "empolgado":
        for ex in (e1, e2):
            m = add(arc(x, y, ex, ey + 10, 17, 200, 340, 8))
        m = add(disc(x, y, 128, my - 10, 24) * (y > my - 12))
    elif name == "neutro":                    # exatamente o visual da imagem: "O o"
        for ex in (e1, e2):
            m = add(ring(x, y, ex, ey + 4, 17, 9)); m = add(ring(x, y, ex, ey + 4, 5, 4))
    elif name == "cansado":
        for ex in (e1, e2):
            m = add(disc(x, y, ex, ey + 8, 14) * (y > ey + 6))
            m = add(seg(x, y, ex - 17, ey + 6, ex + 17, ey + 6, 6))
        m = add(ring(x, y, 128, my, 7, 5))
    elif name == "preocupado":
        for ex, s_ in ((e1, 1), (e2, -1)):
            m = add(disc(x, y, ex, ey + 6, 10))
            m = add(seg(x, y, ex - 16 * s_, ey - 12, ex + 14 * s_, ey - 22, 6))
        m = add(arc(x, y, 128, my + 22, 24, 215, 325, 7))
    elif name == "dormindo":
        for ex in (e1, e2):
            m = add(arc(x, y, ex, ey - 4, 16, 20, 160, 7))
        m = add(seg(x, y, 194, 20, 214, 20, 5)); m = add(seg(x, y, 214, 20, 194, 38, 5)); m = add(seg(x, y, 194, 38, 214, 38, 5))
    elif name == "surpreso":
        for ex in (e1, e2):
            m = add(ring(x, y, ex, ey, 16, 8))
        m = add(ring(x, y, 128, my + 2, 11, 7))
    else:                                     # piscada
        m = add(arc(x, y, e1, ey + 10, 16, 200, 340, 8))
        m = add(ring(x, y, e2, ey, 15, 8)); m = add(disc(x, y, e2, ey, 4.5))
        m = add(arc(x, y, 128, my - 24, 30, 30, 150, 7))
    return m


def to_leds(mask):
    """Converte a máscara em matriz de LEDs redondos + leve brilho."""
    H, W = mask.shape
    yy, xx = np.meshgrid(np.arange(H, dtype=np.float32) + 0.5, np.arange(W, dtype=np.float32) + 0.5, indexing='ij')
    gx = np.floor(xx / PITCH) * PITCH + PITCH / 2
    gy = np.floor(yy / PITCH) * PITCH + PITCH / 2
    ix = np.clip(gx.astype(int), 0, W - 1); iy = np.clip(gy.astype(int), 0, H - 1)
    on = mask[iy, ix] > 0.35
    d = np.hypot(xx - gx, yy - gy)
    dot = np.clip(DOT_R + 0.5 - d, 0, 1) * on
    glow = dot.copy()
    for _ in range(3):  # desfoque barato
        glow = (glow + np.roll(glow, 1, 0) + np.roll(glow, -1, 0) + np.roll(glow, 1, 1) + np.roll(glow, -1, 1)) / 5
    return np.clip(dot + glow * 0.55, 0, 1)


NAMES = ["feliz", "empolgado", "neutro", "cansado", "preocupado", "dormindo", "surpreso", "piscada"]
atlas = np.zeros((CH * ROWS, CW * COLS), dtype=np.float32)
for i, n in enumerate(NAMES):
    r, c = divmod(i, COLS)
    atlas[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = to_leds(draw(n))
rgba = np.dstack([np.broadcast_to(INK, atlas.shape + (3,)), atlas]).astype(np.float32)
img = bpy.data.images.get("AST2_Rostos_LED") or bpy.data.images.new("AST2_Rostos_LED", CW * COLS, CH * ROWS, alpha=True)
img.scale(CW * COLS, CH * ROWS)
img.alpha_mode = "STRAIGHT"
img.pixels.foreach_set(np.flipud(rgba).ravel())
img.filepath_raw = os.path.join(OUT_DIR, "rostos_led.png"); img.file_format = 'PNG'
img.save()
img.pack()

# material (o jogo procura material chamado "M_Rosto"; renomear na exportação)
fm = bpy.data.materials.get("M_Rosto_LED") or bpy.data.materials.new("M_Rosto_LED")
nt = fm.node_tree
for n in list(nt.nodes):
    if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'):
        nt.nodes.remove(n)
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = 'Linear'
mp = nt.nodes.new("ShaderNodeMapping"); uv = nt.nodes.new("ShaderNodeTexCoord")
mp.inputs["Scale"].default_value = (0.25, 0.5, 1); mp.inputs["Location"].default_value = (0, 0.5, 0)   # prévia: célula 0
nt.links.new(uv.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
bsdf.inputs["Emission Strength"].default_value = 2.5
bsdf.inputs["Roughness"].default_value = 0.4
if hasattr(fm, "surface_render_method"):
    fm.surface_render_method = "BLENDED"

# malha do rosto: grade 2:1 colada na curva do visor (UV 0..1 cobrindo o atlas inteiro, v=1 no topo)
VIS = ((0, -0.125, 1.40), (0.25, 0.19, 0.185))
NX, NY = 20, 10
HW, HH, CZ = 0.19, 0.095, 1.395
verts, uvs = [], []
for j in range(NY + 1):
    for i in range(NX + 1):
        x = -HW + 2 * HW * i / NX; z = CZ + HH - 2 * HH * j / NY
        verts.append(tuple(ell_point(VIS, x, z, 0.004)))
        uvs.append((i / NX, 1 - j / NY))
faces = [(j * (NX + 1) + i, (j + 1) * (NX + 1) + i, (j + 1) * (NX + 1) + i + 1, j * (NX + 1) + i + 1)
         for j in range(NY) for i in range(NX)]
_old = bpy.data.meshes.get("AST2_face_mesh")
fme = bpy.data.meshes.new("AST2_face_mesh_new")
if _old:
    _old.user_remap(fme); bpy.data.meshes.remove(_old)
fme.name = "AST2_face_mesh"
fme.from_pydata(verts, [], faces); fme.update()
if sum(p.normal.y for p in fme.polygons) > 0:
    fme.flip_normals()
uvl = fme.uv_layers.get("UVMap") or fme.uv_layers.new(name="UVMap")
for p in fme.polygons:
    p.use_smooth = True
    for li in p.loop_indices:
        uvl.data[li].uv = uvs[fme.loops[li].vertex_index]
fme.materials.clear(); fme.materials.append(fm)
# peso total no osso da cabeça
made = []
for col in [c for c in bpy.data.collections if c.name.startswith("GAL_astronauta2_")]:
    rig = next((o for o in col.objects if o.type == 'ARMATURE'), None)
    if not rig:
        continue
    suffix = "" if rig.name == "astronaut2_rig" else "_" + rig.name.split("_")[-1]
    name = "AST2_face" + suffix
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, fme)
    if ob.name not in col.objects:
        col.objects.link(ob)
    attach(ob, rig)
    vg = ob.vertex_groups["head"]; vg.add(list(range(len(fme.vertices))), 1.0, 'REPLACE')
    made.append(name)
RESULT_FACE = {"atlas": img.filepath_raw, "faces": made}
