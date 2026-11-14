# Mars Outpost — monta a GARAGEM, mobília dos cômodos e as 8 bases (coleção 50_BASES).
# Requer lib_kit.py, moveis.py e layouts.py carregados antes (ver build_all.py).
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

FLOOR = 0.31  # topo do piso interno
BASE_SPACING = 170.0
BASE_ORIGIN = (0.0, 420.0)  # longe do terreno da base original (340 x 340 no centro)

# ---------------------------------------------------------------- garagem (módulo novo)


def build_garage():
    """INST_Garagem 3x2 tiles, portões S0/S2, portas E1/N1. Mesmo padrão dos INST_* do kit."""
    coll = collection("20_INSTALACOES_SEPARADAS/INST_Garagem")
    W, D, H, T = 12.0, 8.0, 3.5, 0.3
    p = Piece()
    p.boxz((W + 0.5, D + 0.5, 0.3), W / 2, D / 2, 0, mat("M_Dark_Metal"))
    p.boxz((W - 0.2, D - 0.2, 0.01), W / 2, D / 2, 0.3, mat("M_Piso_Interno"))
    for x in (2.0, 10.0):  # faixas de estacionamento
        p.boxz((0.12, 6.0, 0.012), x - 1.7, 4.2, 0.305, mat("M_Hazard_Yellow"))
        p.boxz((0.12, 6.0, 0.012), x + 1.7, 4.2, 0.305, mat("M_Hazard_Yellow"))

    def wall_x(y, openings):  # parede ao longo de X (lados S/N); openings=[(centro, largura, altura)]
        segs, cur = [], 0.0
        for c, w, h in sorted(openings):
            segs.append((cur, c - w / 2))
            p.boxz((w, T, H - 0.3 - h), c, y, 0.3 + h, mat("M_Hull_White"))  # verga
            cur = c + w / 2
        segs.append((cur, W))
        for a, b in segs:
            if b - a > 0.01:
                p.boxz((b - a, T, H - 0.3), (a + b) / 2, y, 0.3, mat("M_Hull_White"))

    def wall_y(x, openings):
        segs, cur = [], 0.0
        for c, w, h in sorted(openings):
            segs.append((cur, c - w / 2))
            p.boxz((T, w, H - 0.3 - h), x, c, 0.3 + h, mat("M_Hull_White"))
            cur = c + w / 2
        segs.append((cur, D))
        for a, b in segs:
            if b - a > 0.01:
                p.boxz((T, b - a, H - 0.3), x, (a + b) / 2, 0.3, mat("M_Hull_White"))

    wall_x(0.0, [(2.0, 3.2, 2.75), (10.0, 3.2, 2.75)])
    wall_x(D, [(6.0, 2.0, 2.5)])
    wall_y(0.0, [])
    wall_y(W, [(6.0, 2.0, 2.5)])
    # faixas azul NASA e janelas, como nos outros módulos
    for y in (-0.16, D + 0.16):
        p.boxz((W, 0.02, 0.25), W / 2, y, 2.9, mat("M_NASA_Azul"))
    p.boxz((0.02, 4.0, 0.5), -0.16, 4.0, 1.6, mat("M_Janela_Luz"))
    p.boxz((0.6, 0.02, 0.4), 6.0, -0.16, 2.2, mat("M_Hazard_Yellow"))
    ob = p.build(
        "INST_Garagem",
        coll,
        (230, -12, 0),
        {
            "comodo": "Garagem",
            "nome": "Garagem",
            "tiles_w": 3,
            "tiles_d": 2,
            "tile_m": 4,
            "origem": "canto -X -Y do cômodo, no chão",
            "encaixes": "S0:g,S2:g,E1:p,N1:p",
            "redondo": False,
        },
    )
    roof = Piece()
    roof.boxz((W + 0.4, D + 0.4, 0.35), W / 2, D / 2, H, mat("M_Telhado"))
    roof.boxz((W - 1.0, D - 1.0, 0.25), W / 2, D / 2, H + 0.35, mat("M_Telhado"))
    for x in (3.0, 9.0):
        roof.boxz((1.4, 1.4, 0.3), x, D / 2, H + 0.6, mat("M_Dark_Metal"))
    rf = roof.build("INST_Garagem_Telhado", coll)
    rf.parent = ob
    # portas (cópias do kit, com as folhas animadas)
    for side, (lx, ly, rz), kit, ramp in (
        ("S0", (2.0, 0.0, 0.0), "KIT_PortaGaragem", "KIT_Rampa.002"),
        ("S2", (10.0, 0.0, 0.0), "KIT_PortaGaragem", "KIT_Rampa.002"),
        ("E1", (W, 6.0, math.pi / 2), "KIT_Porta", "KIT_Rampa.001"),
        ("N1", (6.0, D, math.pi), "KIT_Porta", "KIT_Rampa.001"),
    ):
        suffix = "PortaGaragem" if "Garagem" in kit else "Porta"
        d = copy_tree(bpy.data.objects[kit], f"INST_Garagem_{side}_{suffix}", coll)
        d.parent, d.location, d.rotation_euler = ob, (lx, ly, 0), (0, 0, rz)
        rp = copy_tree(bpy.data.objects[ramp], f"INST_Garagem_{side}_Rampa", coll)
        rp.parent, rp.location, rp.rotation_euler = ob, (lx, ly, 0), (0, 0, rz)
    return ob


def copy_tree(src, name, coll, keep=None):
    """Cópia ligada (mesma malha) de um objeto e filhos. keep(child)->bool filtra filhos."""
    ob = src.copy()
    ob.name = name
    coll.objects.link(ob)
    for ch in src.children:
        if keep and not keep(ch):
            continue
        cc = copy_tree(ch, name + ch.name.replace(src.name, "", 1) if ch.name.startswith(src.name) else ch.name, coll)
        cc.parent = ob
        cc.matrix_parent_inverse = ch.matrix_parent_inverse.copy()
    return ob


# ---------------------------------------------------------------- mobília por tipo de cômodo
R0, R90, R180, R270 = 0.0, math.pi / 2, math.pi, -math.pi / 2  # frente -Y; parede N=R0, S=R180, E=R270, W=R90

INTERIORS = {
    "Habitacao": [
        ("MOVEL_Beliche", 2.2, 1.0, R180),
        ("MOVEL_Beliche", 9.8, 1.0, R180),
        ("MOVEL_Armario", 0.8, 7.35, R0),
        ("MOVEL_Armario", 1.8, 7.35, R0),
        ("MOVEL_Armario", 10.2, 7.35, R0),
        ("MOVEL_Armario", 11.2, 7.35, R0),
        ("MOVEL_Sofa", 3.6, 7.2, R0),
        ("MOVEL_Esteira", 11.2, 3.0, R270),
    ],
    "Estufa": [
        (stage, x, y, R0)
        for (x, y), stage in zip(
            [(3.4, 3.0), (3.4, 4.3), (8.6, 3.0), (8.6, 4.3), (3.4, 7.7), (3.4, 9.0), (8.6, 7.7), (8.6, 9.0)],
            [
                "PLANTA_Batata_0_Vazio",
                "PLANTA_Batata_1_Broto",
                "PLANTA_Batata_1_Broto",
                "PLANTA_Batata_2_Crescida",
                "PLANTA_Batata_2_Crescida",
                "PLANTA_Batata_3_Colheita",
                "PLANTA_Batata_2_Crescida",
                "PLANTA_Batata_3_Colheita",
            ],
        )
    ],
    "Laboratorio": [  # cômodo redondo (raio ~5,6 m em torno de 6,6): tudo dentro do círculo
        ("MOVEL_BancadaLab", 6.0, 9.7, R0),
        ("MOVEL_BancadaLab", 6.0, 2.3, R180),
        ("MOVEL_CaixaLuvas", 2.4, 8.3, R90),
        ("MOVEL_RackServidor", 2.4, 3.8, R90),
        ("MOVEL_Computador", 9.5, 8.0, R270),
        ("MOVEL_Cadeira", 8.6, 8.0, R270),
        ("MOVEL_Computador", 9.5, 4.0, R270),
        ("MOVEL_Cadeira", 8.6, 4.0, R270),
    ],
    "Pesquisa": [
        ("MOVEL_Computador", 2.2, 7.3, R0),
        ("MOVEL_Cadeira", 2.2, 6.4, R0),
        ("MOVEL_Telao", 7.75, 4.0, R270),
        ("MOVEL_BancadaLab", 5.5, 0.6, R180),
        ("MOVEL_RackServidor", 0.6, 3.6, R90),
    ],
    "Comunicacoes": [
        ("MOVEL_ConsoleComunicacao", 4.3, 6.0, R0),
        ("MOVEL_Cadeira", 4.3, 5.0, R0),
        ("MOVEL_RackServidor", 7.4, 6.9, R270),
        ("MOVEL_RackServidor", 7.4, 5.9, R270),
        ("MOVEL_Telao", 4.3, 0.3, R180),
        ("MOVEL_Computador", 1.0, 2.2, R90),
    ],
    "Medicina": [
        ("MOVEL_Maca", 1.1, 5.4, R0),
        ("MOVEL_Maca", 6.9, 5.4, R0),
        ("MOVEL_ArmarioMedico", 4.0, 7.45, R0),
        ("MOVEL_Computador", 6.9, 1.2, R180),
        ("MOVEL_Cadeira", 6.9, 2.1, R180),
    ],
    "SuporteVida": [
        ("MOVEL_TanqueSuporteVida", 3.2, 7.2, R0),
        ("MOVEL_FiltroAr", 6.6, 7.3, R0),
        ("MOVEL_FiltroAr", 7.4, 2.8, R270),
        ("MOVEL_PainelEletrico", 0.45, 3.0, R90),
    ],
    "CentralEnergia": [
        ("MOVEL_PainelEletrico", 2.4, 7.5, R0),
        ("MOVEL_RackServidor", 7.4, 2.6, R270),
        ("KIT_Bateria", 2.2, 0.8, R180),
        ("KIT_Bateria", 4.0, 0.8, R180),
        ("KIT_Bateria", 5.8, 0.8, R180),
        ("KIT_Bateria", 7.2, 4.6, R270),
    ],
    "Armazem": [
        ("MOVEL_Prateleira", 5.4, 7.4, R0),
        ("MOVEL_Prateleira", 7.6, 7.4, R0),
        ("MOVEL_Prateleira", 9.8, 7.4, R0),
        ("MOVEL_Prateleira", 0.5, 4.2, R90),
        ("MOVEL_Caixote", 8.6, 4.4, 0.1),
        ("MOVEL_Caixote", 9.8, 4.5, -0.05),
        ("MOVEL_Caixote", 9.1, 5.6, 0.2),
        ("MOVEL_Caixote", 2.4, 1.2, 0.0),
    ],
    "Oficina": [
        ("MOVEL_BancadaFerramentas", 4.6, 7.35, R0),
        ("MOVEL_Prateleira", 0.45, 2.8, R90),
        ("VEICULO_RoverAberto", 5.0, 2.8, R90),
        ("MOVEL_Caixote", 7.2, 6.0, 0.15),
    ],
    "Refeitorio": [
        ("MOVEL_Cozinha", 2.0, 7.4, R0),
        ("MOVEL_Despensa", 3.8, 7.35, R0),
        ("MOVEL_MesaRefeitorio", 3.0, 3.0, R0),
        ("MOVEL_MesaRefeitorio", 9.0, 3.0, R0),
        ("MOVEL_Telao", 9.0, 7.75, R0),
    ],
    "Garagem": [
        ("EXTRA_Rover_Pressurizado", 2.1, 4.2, R90),
        ("VEICULO_RoverAberto", 10.0, 3.6, R0),
        ("MOVEL_EstacaoRecarga", 10.0, 7.3, R0),
        ("MOVEL_BancadaFerramentas", 2.2, 7.35, R0),
        ("MOVEL_Caixote", 6.0, 1.0, 0.0),
        ("MOVEL_Prateleira", 11.55, 2.4, R270),
    ],
}


def furnish(room_ob, kind, coll, prefix, bay=False):
    """Mobília do cômodo. Os veículos NÃO entram aqui: são objetos do jogo (pilotado e remoto) que
    ficam na sala-garagem (`bay`) e saem pela porta; nela as caixas também saem, para dar espaço."""
    for i, (name, x, y, rz) in enumerate(INTERIORS.get(kind, [])):
        if name.startswith("VEICULO_") or name == "EXTRA_Rover_Pressurizado":
            continue
        if bay and name == "MOVEL_Caixote":
            continue
        src = bpy.data.objects.get(name)
        if not src:
            continue
        ob = src.copy()
        ob.name = f"{prefix}_{name.split('_', 1)[1]}_{i:02d}"
        coll.objects.link(ob)
        ob.parent = room_ob
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = (x, y, FLOOR - (0.15 if name.startswith("KIT_") else 0.0))
        ob.rotation_euler = (0, 0, rz)
        ob["camada"] = "interior"


# ---------------------------------------------------------------- exterior


def _place(name, src, coll, root, loc, rz=0.0, z=0.0):
    ob = bpy.data.objects[src].copy()
    ob.name = name
    coll.objects.link(ob)
    ob.parent = root
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = (loc[0], loc[1], z)
    ob.rotation_euler = (0, 0, rz)
    ob["camada"] = "exterior"
    return ob


def free_block(occ, w, h, near, avoid):
    """Primeiro bloco livre w x h (em tiles) mais próximo de `near`, com 1 tile de folga."""
    best = None
    x0, y0, x1, y1 = (min(c[0] for c in occ) - w - 3, min(c[1] for c in occ) - h - 3, max(c[0] for c in occ) + 3, max(c[1] for c in occ) + 3)
    for bx in range(x0, x1 + 1):
        for by in range(y0, y1 + 1):
            cells = {(bx + i, by + j) for i in range(-1, w + 1) for j in range(-1, h + 1)}
            if cells & occ or cells & avoid:
                continue
            cx, cy = bx + w / 2, by + h / 2
            dist = (cx - near[0]) ** 2 + (cy - near[1]) ** 2
            if best is None or dist < best[0]:
                best = (dist, bx, by)
    return best[1], best[2]


def split_dish(roof_ob, coll, name):
    """Separa o prato da torre de comunicações (faces acima de 9,8 m) e cria a animação 'Scan'.

    O prato vira um objeto filho do telhado, com a origem no eixo da torre (centro do módulo),
    para girar sem sair do lugar. A malha do telhado é copiada antes (era compartilhada)."""
    me = roof_ob.data.copy()
    roof_ob.data = me
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    top = [f for f in bm.faces if f.calc_center_median().z > 9.8]
    if not top:
        bm.free()
        return None
    cx, cy, cz = 4.0, 4.0, 10.2
    nb = bmesh.new()
    vmap = {}
    for f in top:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = nb.verts.new((v.co.x - cx, v.co.y - cy, v.co.z - cz))
            vs.append(vmap[v])
        nf = nb.faces.new(vs)
        nf.material_index = f.material_index
        nf.smooth = False
    bmesh.ops.delete(bm, geom=top, context="FACES")
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me)
    bm.free()
    dme = bpy.data.meshes.new(name)
    nb.to_mesh(dme)
    nb.free()
    for m in me.materials:
        dme.materials.append(m)
    dish = bpy.data.objects.new(name, dme)
    dish.parent = roof_ob
    dish.matrix_parent_inverse = Matrix.Identity(4)
    dish.location = (cx, cy, cz)
    coll.objects.link(dish)
    # varredura lenta: +-70 graus em 8 s (24 quadros por segundo)
    act = bpy.data.actions.new("Scan_" + name)
    ad = dish.animation_data_create()
    ad.action = act
    for f in range(0, 193, 8):
        dish.rotation_euler = (0, 0, math.radians(70) * math.sin(2 * math.pi * f / 192))
        dish.keyframe_insert("rotation_euler", frame=f + 1)
    dish.rotation_euler = (0, 0, 0)
    dish["camada"] = "animado"
    return dish


def plug_door(room_ob, door, coll, name):
    """Tampa o vão de uma porta sem saída com um painel no material da parede ao lado."""
    lx, ly = door["local"]
    s = door["id"][0]
    # casco branco do lado de fora, parede interna do lado de dentro (y local aponta para fora em N/W)
    out = {"N": 1, "W": 1, "S": -1, "E": -1}[s]
    ob = (
        Piece()
        .box((2.06, 0.14, 2.56), (0, 0.1 * out, 1.28), mat("M_Hull_White"))
        .box((2.06, 0.22, 2.56), (0, -0.07 * out, 1.28), mat("M_Parede_Interna"))
        .build(name, coll)
    )
    ob.parent = room_ob
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = (lx, ly, 0)
    ob.rotation_euler = (0, 0, 0 if s in "NS" else math.pi / 2)
    ob["camada"] = "modulo"
    return ob


def build_exterior(L, coll, root, pre):
    occ = {c for r in L.rooms for c in r.cells()} | {(c[0], c[1]) for c in L.corridors}
    # células na frente das portas externas ficam livres (rampas e acesso)
    avoid = set()
    for r in L.rooms:
        for d in r.doors:
            if d["link"] is None and not d.get("blocked"):
                nx, ny = d["normal"]
                cx, cy = int((d["pos"][0] + nx) // TILE), int((d["pos"][1] + ny) // TILE)
                avoid |= {(cx + i * nx, cy + i * ny) for i in range(2)}
    byk = {r.kind: r for r in L.rooms}
    used = set()

    def take(w, h, near):
        bx, by = free_block(occ | used, w, h, near, avoid)
        used.update({(bx + i, by + j) for i in range(w) for j in range(h)})
        return bx, by

    ce = byk["CentralEnergia"]
    n_solar = {"valles": 15, "hellas": 9}.get(L.key, 12)
    cols = 3
    bx, by = take(cols, math.ceil(n_solar / cols), (ce.tx + 1, ce.ty + 1))
    for i in range(n_solar):
        _place(f"{pre}_Solar_{i:02d}", "KIT_Painel_Solar", coll, root, ((bx + i % cols) * 4 + 2, (by + i // cols) * 4 + 2))
    bx, by = take(2, 1, (ce.tx + 1, ce.ty + 1))
    for i in range(2):
        _place(f"{pre}_PisoBat_{i}", "KIT_Plataforma_Piso", coll, root, ((bx + i) * 4 + 2, by * 4 + 2))
        for j, dx in enumerate((-0.9, 0.9)):
            _place(f"{pre}_Bateria_{i}{j}", "KIT_Bateria", coll, root, ((bx + i) * 4 + 2 + dx, by * 4 + 2.3), z=0.16)
    # plataforma de pouso 3x3 com a nave
    hab = byk["Habitacao"]
    bx, by = take(3, 3, (hab.tx + 1, hab.ty - 6))
    cx, cy = bx * 4 + 6, by * 4 + 6
    for k, (dx, dy, src, rz) in enumerate(
        [
            (-4, -4, "KIT_Plataforma_Canto", 0),
            (-4, 4, "KIT_Plataforma_Canto", -math.pi / 2),
            (4, -4, "KIT_Plataforma_Canto", math.pi / 2),
            (4, 4, "KIT_Plataforma_Canto", math.pi),
            (-4, 0, "KIT_Plataforma_Borda", -math.pi / 2),
            (0, -4, "KIT_Plataforma_Borda", 0),
            (0, 4, "KIT_Plataforma_Borda", math.pi),
            (4, 0, "KIT_Plataforma_Borda", math.pi / 2),
            (0, 0, "KIT_Plataforma_Centro_H", 0),
        ]
    ):
        _place(f"{pre}_Pad_{k}", src, coll, root, (cx + dx, cy + dy), rz)
    for k, (dx, dy) in enumerate(((-5.7, -5.7), (5.7, -5.7), (5.7, 5.7), (-5.7, 5.7))):
        _place(f"{pre}_PadLuz_{k}", "KIT_Luz_Pouso", coll, root, (cx + dx, cy + dy), z=0.16)
    nave = _place(f"{pre}_Nave", "EXTRA_Nave_Marte", coll, root, (cx, cy), 0.3, 0.16)
    nave["camada"] = "nave"
    # depósitos perto do armazém, sonda de perfuração, postes
    arm = byk["Armazem"]
    bx, by = take(2, 1, (arm.tx + 1, arm.ty - 2))
    for i, (dx, dy, z) in enumerate(((-0.9, -0.9, 0.16), (0.9, -0.9, 0.16), (-0.9, 0.9, 0.16), (-0.9, -0.9, 1.76))):
        _place(f"{pre}_Deposito_{i}", "KIT_Deposito", coll, root, (bx * 4 + 2 + dx, by * 4 + 2 + dy), 0.05 * i, z)
    _place(f"{pre}_PisoDep", "KIT_Plataforma_Piso", coll, root, (bx * 4 + 2, by * 4 + 2))
    x0, y0, x1, y1 = L.bounds()
    bx, by = take(1, 1, (x0 - 3, y1 + 2))
    _place(f"{pre}_PisoSonda", "KIT_Plataforma_Piso", coll, root, (bx * 4 + 2, by * 4 + 2))
    _place(f"{pre}_Sonda", "KIT_Sonda_Perfuracao", coll, root, (bx * 4 + 2, by * 4 + 2), z=0.16)
    corners = [(x0 - 1, y0 - 1), (x1 + 1, y0 - 1), (x0 - 1, y1 + 1), (x1 + 1, y1 + 1), ((x0 + x1) // 2, y0 - 2)]
    for k, (gx, gy) in enumerate(corners):
        if (gx, gy) not in occ and (gx, gy) not in used:
            _place(f"{pre}_Poste_{k}", "KIT_Poste_Luz", coll, root, (gx * 4 + 2, gy * 4 + 2))
    return {"pad": [cx, cy]}


# ---------------------------------------------------------------- base completa


def build_base(L, index):
    pre = f"B{index + 1}_{L.key}"
    coll = collection(f"50_BASES/{pre}")
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    root = bpy.data.objects.new(f"ROOT_{pre}", None)
    coll.objects.link(root)
    root.location = (BASE_ORIGIN[0] + (index % 4) * BASE_SPACING, BASE_ORIGIN[1] + (index // 4) * BASE_SPACING, 0)
    root["base"] = L.key
    root["nome"] = L.name
    for n, r in enumerate(L.rooms):
        src = bpy.data.objects[f"INST_{r.kind}"]
        linked = {d["id"] for d in r.doors if d["link"]}
        blocked = {d["id"] for d in r.doors if d.get("blocked")}

        def keep(ch, linked=linked, blocked=blocked):
            parts = ch.name.split("_")
            side = parts[2] if len(parts) > 2 else ""
            if side in blocked:  # porta sem saída: some porta e rampa, o vão é tampado
                return False
            return not (side in linked and ch.name.endswith("_Rampa"))

        ob = copy_tree(src, f"{pre}_{r.kind}_{n}", coll, keep)
        for d in r.doors:
            if d.get("blocked"):
                plug_door(ob, d, coll, f"{pre}_{r.kind}_{n}_{d['id']}_Tampa")
        ob.parent = root
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = (r.origin[0], r.origin[1], 0)
        ob.rotation_euler = (0, 0, math.radians(r.rot))
        ob["comodo"] = r.kind
        ob["camada"] = "modulo"
        furnish(ob, r.kind, coll, f"{pre}_{r.kind}_{n}", bay=bool(L.bay()) and L.bay()["room"] == r.key)
        if r.kind == "Comunicacoes":
            roof = bpy.data.objects.get(f"{pre}_{r.kind}_{n}_Telhado")
            if roof:
                split_dish(roof, coll, f"{pre}_{r.kind}_{n}_Antena_Prato")
    for k, (cx, cy, axis, piece, rot) in enumerate(L.corridors):
        ob = copy_tree(bpy.data.objects[piece], f"{pre}_Corredor_{k:02d}", coll)
        ob.parent = root
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = (cx * TILE + 2, cy * TILE + 2, 0)
        ob.rotation_euler = (0, 0, math.radians(rot))
        ob["camada"] = "corredor"
    ext = build_exterior(L, coll, root, pre)
    return root, ext


def export_base(root, L, out_dir, ext):
    """Exporta a base como GLB (origem = canto da grade da base) + JSON com a planta."""
    os.makedirs(out_dir, exist_ok=True)
    keep_loc = root.location.copy()
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    objs = [root] + list(root.children_recursive)
    # Canteiros: o jogo troca a batata por plantas.glb (4 estágios). Exporta só um marcador vazio
    # (mesmo nome e posição) no lugar da malha; os objetos originais continuam intactos no .blend.
    temp = []
    for ob in objs:
        if ob.type == "MESH" and "_Batata_" in ob.name:
            orig = ob.name
            ob.name = orig + "~orig"  # libera o nome para o marcador
            mk = bpy.data.objects.new(orig, None)
            for c in ob.users_collection:
                c.objects.link(mk)
            mk.parent = ob.parent
            mk.matrix_parent_inverse = ob.matrix_parent_inverse.copy()
            mk.location, mk.rotation_euler, mk.scale = ob.location.copy(), ob.rotation_euler.copy(), ob.scale.copy()
            temp.append((mk, ob, orig))
    plant_names = {ob.name for ob in objs if ob.type == "MESH" and "_Batata_" in ob.name}
    for o in objs:
        o.hide_set(False)
        if o.name not in plant_names:
            o.select_set(True)
    for mk, _ob, _orig in temp:
        mk.hide_set(False)
        mk.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(out_dir, f"base_{L.key}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_extras=True,
        export_yup=True,
    )
    root.location = keep_loc
    for mk, ob, orig in temp:
        bpy.data.objects.remove(mk, do_unlink=True)
        ob.name = orig
    data = L.to_json()
    # painéis solares: posição (m, no quadro da base) para o astronauta ir limpar um por um
    data["solar"] = sorted(
        ([round(o.matrix_world.translation.x, 3), round(o.matrix_world.translation.y, 3)] for o in objs if "_Solar_" in o.name and o.type == "MESH"),
        key=lambda p: (p[1], p[0]),
    )
    data["pad"] = ext["pad"]
    data["model"] = f"/assets/bases/base_{L.key}.glb"
    with open(os.path.join(out_dir, f"base_{L.key}.json"), "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return path
