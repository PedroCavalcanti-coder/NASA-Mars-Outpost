# Texturas por cor do sistema de personalização (12 cores x tecido/casco) + versões neutras.
# Também cria UVs (projeção cúbica) nas malhas tingíveis e aplica as texturas padrão nos materiais.
import bpy, bmesh, os, math
import numpy as np

OUT = r"C:\Users\Dev_RV01\Documents\Github\NASA-Mars-Outpost\Assets\texturas\jogo\astronauta_v2\cores"
os.makedirs(OUT, exist_ok=True)
COLORS = {  # packages/shared/src/astronaut.ts -> SUIT_COLORS
    "ice": "#E9ECEF", "station": "#B7BFC6", "graphite": "#30363B", "deep_blue": "#1F3A66",
    "sky": "#5AA9D6", "mint": "#7FD6A0", "orange": "#FF7A1A", "yellow": "#E5B84B",
    "coral": "#D97762", "oxide": "#B84C4C", "lilac": "#A28AC8", "pink": "#D995B9",
}
N = 512
rng = np.random.default_rng(7)
yy, xx = np.meshgrid(np.arange(N, dtype=np.float32), np.arange(N, dtype=np.float32), indexing='ij')


def blur(a, k=2):
    for _ in range(k):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5
    return a


def noise(scale_px, amp):
    small = rng.standard_normal((N // scale_px, N // scale_px)).astype(np.float32)
    big = np.kron(small, np.ones((scale_px, scale_px), np.float32))
    sm = blur(big, scale_px * 3)
    return sm * amp / max(sm.std(), 1e-6)


def periodic_line(coord, period, width):
    d = np.abs(((coord + period / 2) % period) - period / 2)
    return np.clip(width / 2 + 0.5 - d, 0, 1)


# --- relevo (fator multiplicativo em torno de 1) ---
weave = 0.5 + 0.5 * np.sin(2 * np.pi * xx / 8) * np.sin(2 * np.pi * yy / 8)
rip = np.maximum(periodic_line(xx, 64, 1.6), periodic_line(yy, 64, 1.6))
stitch = periodic_line(xx, 256, 1.2) * (((yy // 5) % 2) == 0)       # costura tracejada
stitch = np.maximum(stitch, periodic_line(yy + 128, 256, 1.2) * (((xx // 5) % 2) == 0))
TEC = 1 + 0.05 * (weave - 0.5) - 0.07 * rip + 0.09 * stitch + noise(16, 0.012) + noise(4, 0.006)

groove = np.maximum(periodic_line(xx, 256, 2.2), periodic_line(yy, 256, 2.2))
hl = np.maximum(periodic_line(xx - 2, 256, 1.0), periodic_line(yy - 2, 256, 1.0)) * (1 - groove)
rivet = np.zeros_like(xx)
for cx in (14, 242):
    for cy in (14, 242):
        d = np.hypot(((xx - cx) % 256), ((yy - cy) % 256))
        rivet = np.maximum(rivet, np.clip(4.5 - d, 0, 1))
scratch = np.zeros_like(xx)
for _ in range(26):
    x0, y0 = rng.uniform(0, N, 2); ang = rng.uniform(0, math.pi); L = rng.uniform(10, 40)
    px, py = (xx - x0 + N / 2) % N - N / 2, (yy - y0 + N / 2) % N - N / 2
    t = np.clip(px * math.cos(ang) + py * math.sin(ang), 0, L)
    d = np.hypot(px - t * math.cos(ang), py - t * math.sin(ang))
    scratch = np.maximum(scratch, np.clip(0.9 - d, 0, 1) * 0.6)
CAS = 1 - 0.2 * groove + 0.06 * hl - 0.12 * rivet + 0.035 * scratch + noise(32, 0.01) + noise(8, 0.004)


def hex2rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


def tint(rgb, fac):
    lum = float(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2])
    k = 0.18 * (1 - lum)                         # cores escuras: detalhe clareia em vez de só escurecer
    out = rgb[None, None, :] * fac[..., None] + (fac[..., None] - 1) * k
    # leve variação de matiz nos sulcos (paleta mais rica)
    shade = np.clip(1 - fac, 0, 1)[..., None]
    out = out * (1 - 0.25 * shade) + (rgb[None, None, :] ** 1.6) * 0.25 * shade
    return np.clip(out, 0, 1)


def save(name, rgb_img):
    rgba = np.dstack([rgb_img, np.ones((N, N))]).astype(np.float32)
    img = bpy.data.images.get(name) or bpy.data.images.new(name, N, N)
    img.scale(N, N)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.filepath_raw = os.path.join(OUT, name + ".png"); img.file_format = 'PNG'
    img.save(); img.pack()
    return img


IMGS = {}
for cid, hx in COLORS.items():
    c = hex2rgb(hx)
    IMGS[("tecido", cid)] = save("tecido_" + cid, tint(c, TEC))
    IMGS[("casco", cid)] = save("casco_" + cid, tint(c, CAS))
grey = np.array([1, 1, 1], np.float32)
IMGS[("tecido", "neutro")] = save("tecido_neutro", np.clip(np.dstack([TEC] * 3), 0, 1))
IMGS[("casco", "neutro")] = save("casco_neutro", np.clip(np.dstack([CAS] * 3), 0, 1))

# --- UV cúbica (1 repetição a cada 0,5 m) nas malhas tingíveis ---
def cube_uv(me, scale=2.0):
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u * scale, v * scale)
    bm.to_mesh(me); bm.free()


PART_KIND = {"AST2_color_helmet": ("casco", "ice", "AST2_Capacete"),
             "AST2_color_suit": ("tecido", "ice", "AST2_Traje"),
             "AST2_color_vest": ("tecido", "orange", "AST2_Colete"),
             "AST2_color_gloves": ("tecido", "graphite", "AST2_Luvas"),
             "AST2_color_boots": ("casco", "ice", "AST2_Botas"),
             "AST2_color_backpack": ("casco", "orange", "AST2_Mochila")}
for obj_name, (kind, cid, mat_name) in PART_KIND.items():
    cube_uv(bpy.data.objects[obj_name].data)
    m = bpy.data.materials[mat_name]; nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new("ShaderNodeTexImage")
    tex.image = IMGS[(kind, cid)]
    if not b.inputs["Base Color"].is_linked or b.inputs["Base Color"].links[0].from_node != tex:
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
for acc in ("acc_lanterna_capacete", "acc_antena_parabolica", "acc_tanques_oxigenio", "acc_joelheiras", "acc_bolsas_cinto"):
    cube_uv(bpy.data.objects[acc].data)
RESULT_TEX = {"arquivos": len(IMGS), "pasta": OUT}
