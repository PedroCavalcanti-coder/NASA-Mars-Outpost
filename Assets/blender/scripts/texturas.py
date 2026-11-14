"""
Geometria -> textura, feito em memória na hora de exportar (o .blend NÃO é alterado).

* decalize_logos(obj): o logo da NASA modelado em dezenas/centenas de triângulos (ilhas planas de
  M_Logo_Branco + peças azul/vermelho em volta) vira UM quad com textura PNG (alfa). A textura é
  rasterizada a partir da própria geometria, então o desenho é idêntico ao original.
* texturize_floor(obj): remove as juntas modeladas do piso (M_Piso_Junta) e põe UV + textura de
  placas no M_Piso_Interno (2 m x 2 m, 2x2 placas, juntas pintadas, leve desgaste).

Usado por exportar_bases.py e rover_animado.py:  exec(open('texturas.py').read(), globals())
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

DECAL_MATS = {"M_Logo_Branco", "M_NASA_Vermelho", "M_NASA_Azul"}
LAYER = {"M_NASA_Azul": 0, "M_NASA_Vermelho": 1, "M_Logo_Branco": 2}  # ordem de pintura (embaixo -> em cima)
PPM = 380  # pixels por metro nos logos
SS = 2  # supersampling
_images = {}  # assinatura -> material do decal
_done = set()


def _srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float32), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def _mat_color(mat, default=(0.8, 0.8, 0.8)):
    if mat and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                v = n.inputs["Base Color"].default_value
                return tuple(v[:3])
    return default


def _islands(bm):
    seen, out = set(), []
    for f in bm.faces:
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


def _bb(faces):
    pts = [v.co for f in faces for v in f.verts]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _gap(a, b):
    """Distância entre duas caixas (0 se encostam)."""
    d = [max(a[0][i] - b[1][i], b[0][i] - a[1][i], 0.0) for i in range(3)]
    return math.sqrt(sum(x * x for x in d))


def _raster(tris, w, h):
    """tris: lista de (cor_srgb, [(u,v)*3]) em pixels. Retorna array h x w x 4 (RGBA, alfa reta)."""
    W, H = w * SS, h * SS
    img = np.zeros((H, W, 4), dtype=np.float32)
    for col, p in tris:
        (x0, y0), (x1, y1), (x2, y2) = [(a * SS, b * SS) for a, b in p]
        xmin, xmax = int(max(0, math.floor(min(x0, x1, x2)))), int(min(W - 1, math.ceil(max(x0, x1, x2))))
        ymin, ymax = int(max(0, math.floor(min(y0, y1, y2)))), int(min(H - 1, math.ceil(max(y0, y1, y2))))
        if xmax < xmin or ymax < ymin:
            continue
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9:
            continue
        gx, gy = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
        a = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / den
        b = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / den
        c = 1 - a - b
        m = (a >= -1e-6) & (b >= -1e-6) & (c >= -1e-6)
        img[ymin : ymax + 1, xmin : xmax + 1][m] = (*col, 1.0)
    # média das subamostras (alfa reta; cor ponderada pelo alfa)
    img = img.reshape(h, SS, w, SS, 4)
    a = img[..., 3].mean(axis=(1, 3))
    rgb = (img[..., :3] * img[..., 3:4]).sum(axis=(1, 3)) / np.maximum(img[..., 3].sum(axis=(1, 3))[..., None], 1e-6)
    return np.dstack([rgb, a])


def _image_material(name, arr):
    """Cria imagem (RGBA, sRGB) + material com alfa a partir de um array h x w x 4 (origem no topo)."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.colorspace_settings.name = "sRGB"
    img.alpha_mode = "STRAIGHT"
    img.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())  # Blender: origem embaixo
    img.pack()
    mat = bpy.data.materials.new("M_" + name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.6
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "BLENDED"
    else:
        mat.blend_method = "BLEND"
    return mat


def decalize_logos(obj):
    """Troca os logos de uma malha por quads com textura. Retorna quantos logos foram trocados."""
    me = obj.data
    if me.name in _done or obj.type != "MESH":
        return 0
    _done.add(me.name)
    names = [m.name if m else "" for m in me.materials]
    if "M_Logo_Branco" not in names:
        return 0
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    flat = []
    for faces in _islands(bm):
        ms = {names[f.material_index] for f in faces}
        if not ms <= DECAL_MATS:
            continue
        n = faces[0].normal.copy()
        if any(f.normal.dot(n) < 0.99 for f in faces):
            continue
        d = n.dot(faces[0].verts[0].co)
        if any(abs(n.dot(v.co) - d) > 0.012 for f in faces for v in f.verts):
            continue
        flat.append({"faces": faces, "n": n, "d": d, "ms": ms, "bb": _bb(faces)})
    whites = [i for i in flat if "M_Logo_Branco" in i["ms"]]
    # agrupa as peças brancas coplanares e próximas (letras, estrelas, desenho) num logo
    parent = list(range(len(whites)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for i in range(len(whites)):
        for j in range(i + 1, len(whites)):
            a, b = whites[i], whites[j]
            if abs(a["n"].dot(b["n"])) > 0.99 and abs(a["d"] - (b["d"] if a["n"].dot(b["n"]) > 0 else -b["d"])) < 0.03 and _gap(a["bb"], b["bb"]) < 0.4:
                parent[find(i)] = find(j)
    groups = {}
    for i, w in enumerate(whites):
        groups.setdefault(find(i), []).append(w)
    decals, kill = [], []
    entries = []  # [(membros brancos, índices de peças azul/vermelha que pertencem ao logo)]
    for members in groups.values():
        n, d = members[0]["n"], members[0]["d"]
        lo = Vector([min(m["bb"][0][k] for m in members) for k in range(3)])
        hi = Vector([max(m["bb"][1][k] for m in members) for k in range(3)])
        extra = set()
        for idx, o in enumerate(flat):
            if "M_Logo_Branco" in o["ms"]:
                continue
            if o["n"].dot(n) < 0.99 or abs(o["d"] - d) > 0.03:
                continue
            if max((o["bb"][1] - o["bb"][0]).to_tuple()) > 3.2:  # faixas compridas do casco não são logo
                continue
            if _gap(o["bb"], (lo - Vector((0.1,) * 3), hi + Vector((0.1,) * 3))) <= 0.0:
                extra.add(idx)
        entries.append([list(members), extra])
    # grupos que dividem a mesma peça (ex.: o círculo azul) são o mesmo logo
    merged = True
    while merged:
        merged = False
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                if entries[i][1] & entries[j][1]:
                    entries[i][0] += entries[j][0]
                    entries[i][1] |= entries[j][1]
                    del entries[j]
                    merged = True
                    break
            if merged:
                break
    for members, extra in entries:
        n, d = members[0]["n"], members[0]["d"]
        part = list(members) + [flat[i] for i in extra]
        faces = [f for p in part for f in p["faces"]]
        up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((0, 1, 0))
        up = (up - n * up.dot(n)).normalized()
        right = up.cross(n)
        pts = [v.co for f in faces for v in f.verts]
        us = [(p - pts[0]).dot(right) for p in pts]
        vs = [(p - pts[0]).dot(up) for p in pts]
        umin, umax, vmin, vmax = min(us), max(us), min(vs), max(vs)
        pad = 0.03
        umin, umax, vmin, vmax = umin - pad, umax + pad, vmin - pad, vmax + pad
        W, H = umax - umin, vmax - vmin
        decals.append((faces, n, d, right, up, pts[0], umin, umax, vmin, vmax, W, H))
        kill += faces
    if not decals:
        bm.free()
        return 0
    quads = []
    for faces, n, d, right, up, o, umin, umax, vmin, vmax, W, H in decals:
        ppm = min(PPM, 768 / max(W, H))  # no máximo 768 px no lado maior
        pw, ph = max(8, int(round(W * ppm))), max(8, int(round(H * ppm)))
        tris = []
        for f in sorted(faces, key=lambda f: LAYER[names[f.material_index]]):
            col = _srgb(_mat_color(me.materials[f.material_index]))
            vv = [((v.co - o).dot(right) - umin, (v.co - o).dot(up) - vmin) for v in f.verts]
            px = [(u / W * pw, (1 - v / H) * ph) for u, v in vv]
            for k in range(1, len(px) - 1):
                tris.append((tuple(col), [px[0], px[k], px[k + 1]]))
        arr = _raster(tris, pw, ph)
        key = (pw, ph, hash(np.round(arr[::7, ::7, :3], 1).tobytes()))
        if key not in _images:
            _images[key] = _image_material(f"Decal_{len(_images):02d}", arr)
        quads.append((_images[key], n, right, up, o, umin, umax, vmin, vmax))
    bmesh.ops.delete(bm, geom=list({f for f in kill}), context="FACES")
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    uvl = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    first = len(me.materials)
    mats = []
    for mat, n, right, up, o, umin, umax, vmin, vmax in quads:
        if mat not in mats:
            mats.append(mat)
        c = [o + right * u + up * v + n * 0.004 for u, v in ((umin, vmin), (umax, vmin), (umax, vmax), (umin, vmax))]
        f = bm.faces.new([bm.verts.new(p) for p in c])
        f.material_index = first + mats.index(mat)
        f.smooth = False
        for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uvl].uv = uv
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    return len(quads)


# ---------------------------------------------------------------- piso
_floor_mat = None


def _floor_image(base):
    S = 512
    yy, xx = np.mgrid[0:S, 0:S] / S * 2.0  # metros (tile de 2 m)
    fx, fy = xx % 1.0, yy % 1.0
    edge = np.minimum.reduce([fx, 1 - fx, fy, 1 - fy])
    sm = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))  # noqa: E731
    groove = 1 - sm(0.004, 0.012, edge)
    bevel = (1 - sm(0.012, 0.035, edge)) * (1 - groove)
    rng = np.random.default_rng(11)
    plate = rng.normal(0, 0.025, (2, 2))[(yy // 1).astype(int) % 2, (xx // 1).astype(int) % 2]
    noise = rng.normal(0, 0.012, (S, S))
    for _ in range(14):  # riscos de uso
        x0, y0, ang, ln = rng.uniform(0, 2), rng.uniform(0, 2), rng.uniform(0, math.pi), rng.uniform(0.15, 0.5)
        t = np.linspace(0, ln, 60)
        px = ((x0 + t * math.cos(ang)) % 2.0 / 2.0 * S).astype(int) % S
        py = ((y0 + t * math.sin(ang)) % 2.0 / 2.0 * S).astype(int) % S
        noise[py, px] += 0.05
    lum = 1 + plate + noise + bevel * 0.10 - groove * 0.5
    col = np.clip(np.array(base, dtype=np.float32)[None, None, :] * lum[..., None], 0, 1)
    return np.dstack([_srgb(col), np.ones((S, S), dtype=np.float32)])


def _get_floor_material():
    global _floor_mat
    if _floor_mat:
        return _floor_mat
    base_mat = bpy.data.materials.get("M_Piso_Interno")
    arr = _floor_image(_mat_color(base_mat, (0.28, 0.28, 0.3)))
    img = bpy.data.images.new("Piso_Placas", arr.shape[1], arr.shape[0], alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(np.flipud(arr).astype(np.float32).ravel())
    img.pack()
    mat = base_mat or bpy.data.materials.new("M_Piso_Interno")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    _floor_mat = mat
    return mat


def texturize_floor(obj):
    """Remove as juntas modeladas e põe UV (2 m) nas faces horizontais do piso. Retorna faces removidas."""
    me = obj.data
    key = "floor:" + me.name
    if key in _done or obj.type != "MESH":
        return 0
    _done.add(key)
    names = [m.name if m else "" for m in me.materials]
    if "M_Piso_Interno" not in names:
        return 0
    _get_floor_material()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    junta = [f for f in bm.faces if names[f.material_index] == "M_Piso_Junta"]
    n = len(junta)
    if junta:
        bmesh.ops.delete(bm, geom=junta, context="FACES")
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    uvl = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        if names[f.material_index] != "M_Piso_Interno":
            continue
        for loop in f.loops:
            p = loop.vert.co
            loop[uvl].uv = (p.x / 2.0, p.y / 2.0) if abs(f.normal.z) > 0.7 else ((p.x + p.y) / 2.0, p.z / 2.0)
    bm.to_mesh(me)
    bm.free()
    return n


def apply_all():
    """Logos e piso em todas as malhas do arquivo aberto. Retorna (logos, juntas)."""
    logos = juntas = 0
    for o in list(bpy.data.objects):
        if o.type == "MESH":
            logos += decalize_logos(o)
            juntas += texturize_floor(o)
    return logos, juntas


# ---------------------------------------------------------------- poeira nos painéis solares
DUST_STAGES = 5  # 0 limpo · 1-3 intermediários (cada painel pega o seu) · 4 totalmente empoeirado
_dust_done = False


def _vnoise(h, w, cell, rng):
    """Ruído de valor suave (interpolação bilinear)."""
    gh, gw = h // cell + 2, w // cell + 2
    g = rng.random((gh, gw)).astype(np.float32)
    ys, xs = (np.arange(h) / cell), (np.arange(w) / cell)
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b = g[y0][:, x0], g[y0][:, x0 + 1]
    c, d = g[y0 + 1][:, x0], g[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def _dust_atlas(cw=384, ch=204):
    """5 células lado a lado: alfa da poeira por estágio (cada uma com padrão e semente próprios)."""
    cover = [0.0, 0.22, 0.45, 0.68, 0.97]
    atlas = np.zeros((ch, cw * DUST_STAGES, 4), dtype=np.float32)
    colour = np.array([0.80, 0.56, 0.38], dtype=np.float32)
    for st in range(DUST_STAGES):
        rng = np.random.default_rng(100 + st * 7)
        if st == 0:
            continue
        n = 0.55 * _vnoise(ch, cw, 48, rng) + 0.3 * _vnoise(ch, cw, 16, rng) + 0.15 * _vnoise(ch, cw, 5, rng)
        # a poeira se acumula mais na borda de baixo (escorre) e em listras verticais (vento)
        edge = np.linspace(0, 1, ch)[:, None] ** 2.0 * 0.25
        streak = _vnoise(ch, cw, 120, rng)[:1, :] * 0.0 + _vnoise(8, cw, 9, rng)[:1, :].repeat(ch, axis=0) * 0.12
        field = n + edge + streak
        thr = np.quantile(field, 1 - cover[st])
        a = np.clip((field - thr) * 7 + 0.5, 0, 1) * (0.55 + 0.4 * st / 4)
        a = np.maximum(a, 0.0) if st < 4 else np.clip(a + 0.15, 0, 0.96)
        shade = 0.9 + 0.2 * _vnoise(ch, cw, 22, rng)
        cell = atlas[:, st * cw : (st + 1) * cw]
        cell[..., :3] = np.clip(colour * shade[..., None], 0, 1)
        cell[..., 3] = a
    atlas[..., :3] = _srgb(atlas[..., :3])
    return atlas


def add_solar_dust(obj):
    """Camada de poeira sobre as células do painel (faces M_Solar_Cell), com UV 0-1 no atlas de 5 estágios."""
    global _dust_done
    me = obj.data
    names = [m.name if m else "" for m in me.materials]
    if _dust_done or "M_Solar_Cell" not in names:
        return 0
    _dust_done = True
    arr = _dust_atlas()
    mat = _image_material("Poeira_Solar", arr)
    mat.name = "M_Solar_Poeira"
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    uvl = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    first = len(me.materials)
    n = 0
    for f in [f for f in bm.faces if names[f.material_index] == "M_Solar_Cell"]:
        vs = [v.co.copy() for v in f.verts]
        if len(vs) != 4:
            continue
        e1, e2 = vs[1] - vs[0], vs[3] - vs[0]
        off = f.normal * 0.012  # 12 mm acima da célula
        nf = bm.faces.new([bm.verts.new(v + off) for v in vs])
        nf.material_index = first
        for loop, v in zip(nf.loops, vs):
            loop[uvl].uv = (min(1, max(0, (v - vs[0]).dot(e1) / e1.length_squared)), min(1, max(0, (v - vs[0]).dot(e2) / e2.length_squared)))
        n += 1
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return n
