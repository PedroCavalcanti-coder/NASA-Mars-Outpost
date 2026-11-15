# Vitrine: acessórios individuais, amostras de textura por cor, marcas e combinações de cor.
# Requer ast2_lib.py, ast2_tex.py (IMGS, COLORS) e ast2_anim.py (make_instance, label) no namespace.
import bpy, bmesh, math
from mathutils import Vector, Matrix

parent_col = bpy.data.collections["GAL_Personagem_e_plantas"]
def coll(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in [x.name for x in parent_col.children]:
        parent_col.children.link(c)
    return c

def set_idle(rig):
    ad = rig.animation_data_create(); ad.action = bpy.data.actions["AST2_Idle"]
    try: ad.action_slot = ad.action.slots[0]
    except Exception: pass

# ---------------- 1. acessórios individuais ----------------
cA = coll("GAL_astronauta2_Vitrine_Acessorios")
ACC = [("acc_lanterna_capacete", "Lanterna de capacete"), ("acc_antena_parabolica", "Antena parabolica"),
       ("acc_tanques_oxigenio", "Tanques de O2"), ("acc_joelheiras", "Joelheiras"), ("acc_bolsas_cinto", "Bolsas de cinto"),
       ("acc_cracha", "Cracha"), ("acc_luzes_ombro", "Luzes de ombro"),
       ("acc_emblema_ombro|acc_emblema_peito|acc_emblema_capacete|acc_emblema_mochila", "Marcas (4 lugares)")]
for i, (names, text) in enumerate(ACC):
    tag = "Vit%d" % i; x = 600 + i * 4; y = -104
    rig = make_instance(tag, x, y, cA); set_idle(rig)
    for n in names.split("|"):
        src = bpy.data.objects[n]; nm = n + "_" + tag
        o = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, src.data)
        if o.name not in cA.objects: cA.objects.link(o)
        attach(o, rig)
    # gira o boneco das costas para mostrar o que fica atrás
    if names in ("acc_antena_parabolica", "acc_tanques_oxigenio"):
        bpy.data.objects["astronaut2_root_" + tag].rotation_euler = (0, 0, math.radians(150))
    label("LBL2_" + tag, text, (x, y - 2.2, 0.05), cA)

# ---------------- 2. amostras de textura por cor ----------------
cT = coll("GAL_astronauta2_Vitrine_Texturas")
NAMES = {"ice": "Branco Gelo", "station": "Cinza Estacao", "graphite": "Grafite", "deep_blue": "Azul Cosmico",
         "sky": "Azul Ceu", "mint": "Verde Menta", "orange": "Laranja Ares", "yellow": "Amarelo Solar", "coral": "Coral",
         "oxide": "Vermelho Oxido", "lilac": "Lilas Orbital", "pink": "Rosa Nebulosa", "neutro": "Neutro (tinge)"}
def tex_mat(kind, cid):
    name = "AST2_%s_%s" % (kind, cid)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    t = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None) or nt.nodes.new("ShaderNodeTexImage")
    t.image = IMGS[(kind, cid)]
    if not b.inputs["Base Color"].is_linked: nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.6 if kind == "tecido" else 0.42
    return m
swatch_me = bpy.data.meshes.get("AST2_amostra_mesh")
if not swatch_me:
    bm = bmesh.new(); r = bmesh.ops.create_cube(bm, size=0.8)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.08, segments=3, profile=0.5, affect='EDGES')
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        ax = max(range(3), key=lambda k: abs(f.normal[k]))
        for l in f.loops:
            c = l.vert.co; u, v = [(c.y, c.z), (c.x, c.z), (c.x, c.y)][ax]; l[uv].uv = (u * 1.2, v * 1.2)
    swatch_me = bpy.data.meshes.new("AST2_amostra_mesh"); bm.to_mesh(swatch_me); bm.free()
    for p in swatch_me.polygons: p.use_smooth = True
    swatch_me.set_sharp_from_angle(angle=math.radians(40))
    swatch_me.materials.append(None)
order = list(COLORS.keys()) + ["neutro"]
for row, kind in enumerate(("tecido", "casco")):
    y = -112 - row * 3.2
    label("LBL2_tex_" + kind, "Textura " + kind + (" (traje, colete, luvas)" if kind == "tecido" else " (capacete, botas, mochila)"),
          (596.5, y, 0.05), cT)
    for i, cid in enumerate(order):
        nm = "AST2_amostra_%s_%s" % (kind, cid)
        o = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, swatch_me)
        if o.name not in cT.objects: cT.objects.link(o)
        o.location = (600 + i * 2.4, y, 0.45)
        o.material_slots[0].link = 'OBJECT'; o.material_slots[0].material = tex_mat(kind, cid)
        lb = label("LBL2_am_%s_%s" % (kind, cid), NAMES[cid], (600 + i * 2.4, y - 1.0, 0.02), cT)
        lb.scale = (0.28, 0.28, 0.28)

# ---------------- 3. marcas (atlas 4x2) ----------------
cM = coll("GAL_astronauta2_Vitrine_Marcas")
MARK = ["0 Missao Marte", "1 Foguete", "2 Estrela", "3 Olympus Mons", "4 Botanica", "5 Engenharia", "6 Medicina", "7 Ciencia"]
em = bpy.data.materials["AST2_Emblema"]
for k, text in enumerate(MARK):
    nm = "AST2_marca_%d" % k
    me = bpy.data.meshes.get(nm + "_mesh")
    if not me:
        me = bpy.data.meshes.new(nm + "_mesh")
        me.from_pydata([(-0.6, 0, 0), (0.6, 0, 0), (0.6, 0, 1.2), (-0.6, 0, 1.2)], [], [(0, 1, 2, 3)])
        uvl = me.uv_layers.new(name="UVMap"); cu, cv = (k % 4) * 0.25, (0.5 if k < 4 else 0.0)
        for li, (u, v) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
            uvl.data[li].uv = (cu + u * 0.25, cv + v * 0.5)
        me.materials.append(em)
    o = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, me)
    if o.name not in cM.objects: cM.objects.link(o)
    o.location = (600 + k * 2.6, -122, 0.1)
    lb = label("LBL2_marca_%d" % k, text, (600 + k * 2.6, -123, 0.02), cM); lb.scale = (0.3, 0.3, 0.3)

# ---------------- 4. combinações de cor (texturas por cor aplicadas por objeto) ----------------
cC = coll("GAL_astronauta2_Vitrine_Combinacoes")
PART = {"AST2_color_helmet": "casco", "AST2_color_suit": "tecido", "AST2_color_vest": "tecido",
        "AST2_color_gloves": "tecido", "AST2_color_boots": "casco", "AST2_color_backpack": "casco"}
COMBOS = [("Classico", dict(helmet="ice", suit="ice", vest="orange", gloves="graphite", boots="ice", backpack="orange")),
          ("Cosmos", dict(helmet="deep_blue", suit="ice", vest="sky", gloves="graphite", boots="deep_blue", backpack="sky")),
          ("Botanico", dict(helmet="mint", suit="ice", vest="yellow", gloves="graphite", boots="mint", backpack="yellow")),
          ("Nebulosa", dict(helmet="lilac", suit="pink", vest="lilac", gloves="graphite", boots="pink", backpack="lilac")),
          ("Oxido", dict(helmet="station", suit="station", vest="oxide", gloves="graphite", boots="graphite", backpack="oxide")),
          ("Solar", dict(helmet="yellow", suit="ice", vest="coral", gloves="graphite", boots="yellow", backpack="coral"))]
for i, (cname, combo) in enumerate(COMBOS):
    tag = "Combo_" + cname; x = 600 + i * 4; y = -130
    rig = make_instance(tag, x, y, cC); set_idle(rig)
    for base, kind in PART.items():
        o = bpy.data.objects[base + "_" + tag]
        part = base.replace("AST2_color_", "")
        o.material_slots[0].link = 'OBJECT'; o.material_slots[0].material = tex_mat(kind, combo[part])
    label("LBL2_" + tag, cname, (x, y - 2.2, 0.05), cC)
RESULT_SHOW = {"acessorios": len(ACC), "amostras": 2 * len(order), "marcas": len(MARK), "combos": len(COMBOS)}
