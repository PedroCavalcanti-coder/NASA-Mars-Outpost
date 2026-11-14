"""
Terreno da cratera de Marte (gerado do zero, procedural) — Blender 4.x/5.x.

Cena: bacia plana no centro (onde fica a base), parede com degraus, platô externo com crateras em anel
e pequenas crateras na bacia. A malha é ADAPTATIVA: poucos triângulos nas áreas planas e muitos onde há
inclinação (paredes, bordas e crateras). Pontos vêm de uma quadtree guiada pela inclinação e pela curvatura,
e a triangulação é Delaunay (mathutils.geometry.delaunay_2d_cdt).

Uso (dentro do Blender):
    exec(open(r".../terreno_cratera.py", encoding="utf-8").read(), {"__name__": "__main__", "OUT": r".../terreno.glb"})
Unidades: 1 unidade = 1 m do mundo do jogo, terreno de 255 x 255, piso da bacia em Z=0.
"""

import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector, geometry

SIZE = 255.0
HALF = SIZE / 2
SEED = 11

# --- cenário -----------------------------------------------------------------
BASIN_R = 78.0  # raio da bacia plana (superelipse arredondada)
WALL_W = 21.0  # largura da parede
RIM_H = 13.0  # altura do platô em relação ao piso
SUPER_P = 2.5  # 2 = círculo; maior = mais "quadrado"

# (x, y, raio, profundidade, altura da borda)
OUTER_CRATERS = [
    (-98, -96, 30, 5.0, 2.6),
    (100, 94, 34, 5.5, 2.8),
    (-104, 58, 21, 3.4, 1.9),
    (28, 110, 26, 4.2, 2.2),
    (112, -42, 22, 3.6, 2.0),
    (-38, -113, 24, 3.8, 2.0),
    (64, -104, 18, 3.0, 1.7),
    (-112, 8, 16, 2.6, 1.5),
]
BASIN_CRATERS = [
    (-56, 42, 7.0, 0.9, 0.38),
    (52, -48, 8.5, 1.1, 0.42),
    (-31, -60, 6.0, 0.8, 0.32),
    (62, 35, 9.0, 1.2, 0.45),
    (-63, -21, 5.0, 0.7, 0.3),
    (20, 62, 6.5, 0.85, 0.34),
    (2, -69, 7.0, 0.95, 0.36),
    (-44, 60, 5.5, 0.75, 0.3),
    (46, 8, 4.5, 0.6, 0.26),
]


def _smooth(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _noise(x, y, seed, scale, octaves=3):
    """Ruído barato e suave (soma de senos), determinístico."""
    rng = random.Random(seed)
    out = np.zeros_like(x, dtype=np.float64)
    amp, freq, norm = 1.0, 1.0 / scale, 0.0
    for _ in range(octaves):
        a, b = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
        d = rng.uniform(0, 6.28)
        out += amp * np.sin(x * freq * 1.0 + a + np.sin(y * freq * 0.7 + b)) * np.cos(y * freq * 0.9 + d)
        norm += amp
        amp *= 0.5
        freq *= 2.1
    return out / norm


def height(x, y):
    """Altura do terreno em (x, y). Aceita arrays numpy."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    r = (np.abs(x) ** SUPER_P + np.abs(y) ** SUPER_P) ** (1.0 / SUPER_P)

    # parede da bacia com degraus suaves
    t = np.clip((r - BASIN_R) / WALL_W, 0, 1)
    n = 3
    stepped = (np.floor(t * n) + _smooth(t * n - np.floor(t * n))) / n
    profile = 0.55 * stepped + 0.45 * _smooth(t)
    wall = RIM_H * profile
    wall_mask = _smooth(t) * (1 - _smooth((r - BASIN_R - WALL_W) / 6.0))
    h = wall + 0.9 * wall_mask * _noise(x, y, SEED + 1, 7.0)

    # platô externo: relevo leve
    plateau = _smooth((r - BASIN_R - WALL_W * 0.6) / 14.0)
    h += plateau * (0.5 * _noise(x, y, SEED + 2, 26.0) + 0.18 * _noise(x, y, SEED + 3, 8.0))

    # piso da bacia: quase liso
    floor_mask = 1 - _smooth((r - BASIN_R + 6) / 10.0)
    h += floor_mask * 0.06 * _noise(x, y, SEED + 4, 9.0)

    # crateras externas: bacia rebaixada + borda elevada
    for cx, cy, R, depth, rim in OUTER_CRATERS:
        d = np.hypot(x - cx, y - cy) * (1 + 0.06 * _noise(x, y, SEED + 5, 9.0))
        bowl = -depth * (1 - _smooth((d - R * 0.55) / (R * 0.4)))
        ridge = rim * np.exp(-(((d - R) / (R * 0.13)) ** 2))
        ejecta = 0.25 * rim * np.exp(-(((d - R * 1.35) / (R * 0.3)) ** 2))
        h += plateau * (bowl + ridge + ejecta)

    # pequenas crateras no piso da bacia
    for cx, cy, R, depth, rim in BASIN_CRATERS:
        d = np.hypot(x - cx, y - cy) * (1 + 0.08 * _noise(x, y, SEED + 6, 4.0))
        bowl = -depth * (1 - _smooth((d - R * 0.45) / (R * 0.55)))
        ridge = rim * np.exp(-(((d - R) / (R * 0.16)) ** 2))
        h += floor_mask * (bowl + ridge)
    return h


# --- malha adaptativa ----------------------------------------------------------
def importance_map(res=0.5):
    """Mapa 0..1 de 'quanto detalhe precisa': inclinação + curvatura, suavizado e dilatado."""
    n = int(SIZE / res) + 1
    xs = np.linspace(-HALF, HALF, n)
    X, Y = np.meshgrid(xs, xs)
    H = height(X, Y)
    gy, gx = np.gradient(H, res)
    slope = np.hypot(gx, gy)
    lap = np.abs(np.gradient(gx, res, axis=1) + np.gradient(gy, res, axis=0))
    imp = np.clip(slope * 1.1 + lap * 5.0, 0, 1)
    # dilatação + suavização: a transição de densidade é gradual
    k = 13
    pad = np.pad(imp, k // 2, mode="edge")
    dil = np.max(
        [pad[i : i + n, j : j + n] for i in range(0, k, 2) for j in range(0, k, 2)], axis=0
    )
    ker = np.ones(9) / 9
    for axis in (0, 1):
        dil = np.apply_along_axis(lambda a: np.convolve(np.pad(a, 4, mode="edge"), ker, "valid"), axis, dil)
    return dil, res


def sample_points(imp, res, rng):
    """Quadtree guiada pela importância -> um ponto (com jitter) por folha."""
    n = imp.shape[0]

    def peak(x0, y0, size):
        i0 = max(0, int((y0 + HALF) / res))
        i1 = min(n, int((y0 + size + HALF) / res) + 1)
        j0 = max(0, int((x0 + HALF) / res))
        j1 = min(n, int((x0 + size + HALF) / res) + 1)
        return float(imp[i0:i1, j0:j1].max())

    # tamanho da folha por nível e limiar para subdividir
    sizes = [SIZE / 16, SIZE / 32, SIZE / 64, SIZE / 128]
    thresholds = [0.03, 0.1, 0.26]
    pts = []

    def rec(x0, y0, level):
        size = sizes[level]
        if level < len(thresholds) and peak(x0, y0, size) > thresholds[level]:
            h2 = size / 2
            for dx in (0, h2):
                for dy in (0, h2):
                    rec(x0 + dx, y0 + dy, level + 1)
            return
        jx = rng.uniform(-0.28, 0.28) * size
        jy = rng.uniform(-0.28, 0.28) * size
        pts.append((x0 + size / 2 + jx, y0 + size / 2 + jy, size))

    for i in range(16):
        for j in range(16):
            rec(-HALF + i * sizes[0], -HALF + j * sizes[0], 0)

    # borda: pontos regulares no perímetro (o casco convexo vira o quadrado exato)
    step = sizes[0] / 2
    k = int(SIZE / step)
    for a in range(k + 1):
        t = -HALF + a * SIZE / k
        pts += [(t, -HALF, step), (t, HALF, step), (-HALF, t, step), (HALF, t, step)]
    seen, out = set(), []
    for x, y, s in pts:
        key = (round(x, 3), round(y, 3))
        if key not in seen:
            seen.add(key)
            out.append((x, y, s))
    return out


def build_terrain_mesh(rng):
    imp, res = importance_map()
    pts = sample_points(imp, res, rng)
    coords = [Vector((x, y)) for x, y, _ in pts]
    verts, _edges, faces, *_ = geometry.delaunay_2d_cdt(coords, [], [], 0, 1e-6)
    xs = np.array([v.x for v in verts])
    ys = np.array([v.y for v in verts])
    zs = height(xs, ys)
    mesh = bpy.data.meshes.new("Terreno_Cratera")
    mesh.from_pydata([(float(x), float(y), float(z)) for x, y, z in zip(xs, ys, zs)], [], faces)
    mesh.update()
    return mesh


def paint(mesh, rng):
    """Cor por face (ocre) escurecendo nas paredes e nos fundos de cratera, clareando nas bordas."""
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    floor = np.array([0.60, 0.26, 0.14])
    wall = np.array([0.40, 0.16, 0.085])
    dust = np.array([0.72, 0.38, 0.22])
    for poly in mesh.polygons:
        nz = poly.normal.z
        slope = np.clip((1 - nz) * 2.6, 0, 1)
        z = poly.center.z
        base = floor * (1 - slope) + wall * slope
        base = base * (1 - 0.35 * np.clip(z / RIM_H, 0, 1)) + dust * 0.35 * np.clip(z / RIM_H, 0, 1)
        # face voltada ao sol fica um pouco mais clara
        lit = 0.92 + 0.16 * np.clip(Vector((-0.5, 0.4, 0.7)).dot(poly.normal), 0, 1)
        c = base * lit * rng.uniform(0.94, 1.06)
        for li in poly.loop_indices:
            attr.data[li].color = (c[0], c[1], c[2], 1.0)
    mesh.color_attributes.active_color = attr


def build_rocks(rng, count=140):
    """Rochas low-poly (icosfera amassada) espalhadas pela bacia e pelas encostas."""
    bm = bmesh.new()
    placed = 0
    tries = 0
    while placed < count and tries < count * 20:
        tries += 1
        x, y = rng.uniform(-HALF + 8, HALF - 8), rng.uniform(-HALF + 8, HALF - 8)
        r = (abs(x) ** SUPER_P + abs(y) ** SUPER_P) ** (1 / SUPER_P)
        if r < 34:  # a base fica livre
            continue
        if r > BASIN_R + WALL_W and rng.random() < 0.7:  # poucas no platô
            continue
        s = rng.choice([0.35, 0.5, 0.7, 0.9, 1.3, 1.9]) * (1.0 if r < BASIN_R else 1.3)
        z = float(height(x, y)) + s * 0.18
        ico = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        sx, sy, sz = s * rng.uniform(0.8, 1.3), s * rng.uniform(0.8, 1.3), s * rng.uniform(0.5, 0.85)
        rot = rng.uniform(0, math.tau)
        for v in ico["verts"]:
            p = v.co * 1.0
            p.x *= sx * rng.uniform(0.85, 1.15)
            p.y *= sy * rng.uniform(0.85, 1.15)
            p.z *= sz * rng.uniform(0.85, 1.15)
            cs, sn = math.cos(rot), math.sin(rot)
            v.co = Vector((p.x * cs - p.y * sn + x, p.x * sn + p.y * cs + y, p.z + z))
        placed += 1
    mesh = bpy.data.meshes.new("Rocas")
    bm.to_mesh(mesh)
    bm.free()
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly in mesh.polygons:
        k = 0.85 + 0.3 * max(0.0, poly.normal.z) * rng.uniform(0.8, 1.2)
        for li in poly.loop_indices:
            attr.data[li].color = (0.36 * k, 0.15 * k, 0.085 * k, 1.0)
    mesh.color_attributes.active_color = attr
    return mesh


def make_material():
    mat = bpy.data.materials.new("M_Terreno")
    mat.use_nodes = True  # (no Blender 5 a árvore vem vazia: criamos os nós)
    nt = mat.node_tree
    nt.nodes.clear()
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    col = nt.nodes.new("ShaderNodeAttribute")
    col.attribute_name = "Col"
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def build(out_path):
    rng = random.Random(SEED)
    prev = bpy.context.window.scene
    if prev.name == "TerrenoNovo":  # sobra de uma execução que falhou
        prev = next(s for s in bpy.data.scenes if s.name != "TerrenoNovo")
        bpy.context.window.scene = prev
    for old in [s for s in bpy.data.scenes if s.name == "TerrenoNovo"]:
        bpy.data.scenes.remove(old)
    scene = bpy.data.scenes.new("TerrenoNovo")  # cena isolada: não mexe na cena do usuário
    bpy.context.window.scene = scene
    coll = bpy.data.collections.new("Terreno")
    scene.collection.children.link(coll)
    mat = make_material()
    objs = []
    for mesh in (build_terrain_mesh(rng),):
        paint(mesh, rng)
        mesh.materials.append(mat)
        o = bpy.data.objects.new("Terreno", mesh)
        coll.objects.link(o)
        objs.append(o)
    rocks = build_rocks(rng)
    rocks.materials.append(mat)
    o = bpy.data.objects.new("Rocas", rocks)
    coll.objects.link(o)
    objs.append(o)
    for o in objs:
        for p in o.data.polygons:
            p.use_smooth = False
    stats = {o.name: len(o.data.polygons) for o in objs}
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        use_active_scene=True,  # sem isto exporta todas as cenas do arquivo aberto
        export_apply=True,
        export_yup=True,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_meshopt_compression_enable=True,  # o jogo usa o MeshoptDecoder
    )
    # limpa: remove a cena temporária e volta à cena do usuário
    bpy.context.window.scene = prev
    bpy.data.scenes.remove(scene)
    for o in objs:
        bpy.data.objects.remove(o)
    return stats


if __name__ == "__main__":
    result = build(OUT)  # noqa: F821 (OUT vem de quem executa)
