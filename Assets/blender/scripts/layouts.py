# Mars Outpost — as 8 bases jogáveis. Python puro (sem bpy): valida e gera a planta; o Blender só monta.
#
# Grade de 4 m. Cada cômodo: (tipo, tile_x, tile_y, rotação em graus CCW). As portas de cada tipo vêm do
# kit (custom property "encaixes"). Corredores são criados entre portas que se olham na mesma linha,
# com o caminho livre. Portas sem corredor viram saídas para o exterior (com rampa).

TILE = 4

# tipo -> (tiles_w, tiles_d, portas "lado+índice[:g]")  — igual ao MarsOutpost_Modular.blend
ROOMS = {
    "Habitacao": (3, 2, "E1 N1 S1 W1"),
    "Estufa": (3, 3, "E1 N1 S1 W1"),
    "Laboratorio": (3, 3, "E1 N1 S1 W1"),
    "Refeitorio": (3, 2, "E1 S1 W1"),
    "Armazem": (3, 2, "E0 N0 S1:g"),
    "CentralEnergia": (2, 2, "N1 W1"),
    "Comunicacoes": (2, 2, "E0 W1"),
    "Medicina": (2, 2, "N1 S0"),
    "Oficina": (2, 2, "E0:g S0 W1"),
    "Pesquisa": (2, 2, "N1 S0"),
    "SuporteVida": (2, 2, "E1 S0"),
    "Garagem": (3, 2, "S0:g S2:g E1 N1"),
}
ESSENTIALS = {"Habitacao", "SuporteVida", "CentralEnergia", "Estufa", "Comunicacoes", "Armazem"}

NORMAL = {"E": (1, 0), "W": (-1, 0), "N": (0, 1), "S": (0, -1)}


def rot_vec(x, y, deg):
    for _ in range((deg // 90) % 4):
        x, y = -y, x
    return x, y



# Vaga dos dois veículos (pilotado = "crew", remoto = "auto") dentro da sala que tem porta de garagem.
# Coordenadas LOCAIS da sala em metros: caminho (vaga -> ... -> porta) e direção em que o veículo aponta.
BAY_KINDS = ("Garagem", "Oficina", "Armazem")
BAY_PATHS = {
    "Garagem": {
        "S0": {"crew": [(2.0, 3.4), (2.0, 0.0)], "auto": [(2.0, 3.4), (2.0, 0.0)], "head": (0, -1)},
        "S2": {"crew": [(10.0, 3.0), (10.0, 0.0)], "auto": [(10.0, 3.0), (10.0, 0.0)], "head": (0, -1)},
    },
    "Armazem": {
        "S1": {"crew": [(8.6, 3.2), (6.0, 2.4), (6.0, 0.0)], "auto": [(3.0, 2.8), (6.0, 1.6), (6.0, 0.0)], "head": (0, -1)},
    },
    "Oficina": {
        "E0": {"crew": [(3.6, 2.3), (8.0, 2.0)], "auto": [(4.2, 5.7), (7.0, 5.7), (7.0, 2.0), (8.0, 2.0)], "head": (1, 0)},
    },
}


class Room:
    def __init__(self, key, kind, tx, ty, rot=0):
        self.key, self.kind, self.tx, self.ty, self.rot = key, kind, tx, ty, rot % 360
        w, d, doors = ROOMS[kind]
        self.w0, self.d0 = w, d
        self.w, self.d = (w, d) if self.rot in (0, 180) else (d, w)
        self.doors = []
        for spec in doors.split():
            side, garage = spec.split(":")[0], spec.endswith(":g")
            s, i = side[0], int(side[1])
            lx, ly = {"E": (w * TILE, i * TILE + 2), "W": (0, i * TILE + 2), "N": (i * TILE + 2, d * TILE), "S": (i * TILE + 2, 0)}[s]
            self.doors.append({"id": side, "local": (lx, ly), "garage": garage, "room": self, "link": None})
        # posição do objeto (origem do cômodo) para que a pegada rotacionada comece em (tx,ty)
        W, D = w * TILE, d * TILE
        ox, oy = {0: (0, 0), 90: (D, 0), 180: (W, D), 270: (0, W)}[self.rot]
        self.origin = (tx * TILE + ox, ty * TILE + oy)
        for dr in self.doors:
            lx, ly = dr["local"]
            rx, ry = rot_vec(lx, ly, self.rot)
            dr["pos"] = (self.origin[0] + rx, self.origin[1] + ry)
            dr["normal"] = rot_vec(*NORMAL[dr["id"][0]], self.rot)

    def cells(self):
        return {(self.tx + i, self.ty + j) for i in range(self.w) for j in range(self.d)}


class Layout:
    def __init__(self, key, name, desc, rooms, exterior=None):
        self.key, self.name, self.desc = key, name, desc
        self.rooms = [Room(f"{k}_{n}", *r) for n, (k, *r) in enumerate(((r[0], r[0], *r[1:]) for r in rooms))]
        self.exterior = exterior or {}
        self.corridors = []  # (cell_x, cell_y, eixo 'x'|'y', peça, rot)
        self.errors = []
        self._solve()

    def occupied(self):
        occ = {}
        for r in self.rooms:
            for c in r.cells():
                if c in occ:
                    self.errors.append(f"sobreposição em {c}: {occ[c].kind} x {r.kind}")
                occ[c] = r
        return occ

    def _solve(self):
        occ = self.occupied()
        doors = [d for r in self.rooms for d in r.doors]
        pairs = []
        for a in doors:
            nx, ny = a["normal"]
            if (nx, ny) not in ((1, 0), (0, 1)):
                continue
            for b in doors:
                if b["room"] is a["room"] or b["normal"] != (-nx, -ny):
                    continue
                if nx and abs(a["pos"][1] - b["pos"][1]) < 0.01 and b["pos"][0] > a["pos"][0]:
                    gap = round((b["pos"][0] - a["pos"][0]) / TILE)
                    cells = [(round((a["pos"][0]) / TILE) + k, int(a["pos"][1] // TILE)) for k in range(gap)]
                elif ny and abs(a["pos"][0] - b["pos"][0]) < 0.01 and b["pos"][1] > a["pos"][1]:
                    gap = round((b["pos"][1] - a["pos"][1]) / TILE)
                    cells = [(int(a["pos"][0] // TILE), round(a["pos"][1] / TILE) + k) for k in range(gap)]
                else:
                    continue
                if gap < 1 or any(c in occ for c in cells):
                    continue
                pairs.append((gap, a, b, cells, "x" if nx else "y"))
        used_cells = set()
        for gap, a, b, cells, axis in sorted(pairs, key=lambda p: p[0]):
            if a["link"] or b["link"] or any(c in used_cells for c in cells):
                continue
            a["link"], b["link"] = b, a
            used_cells.update(cells)
            for k, c in enumerate(cells):
                if gap == 1:
                    piece, rot = "CORREDOR_1Tile", 0
                elif k == 0:
                    piece, rot = "CORREDOR_Ponta", 0
                elif k == gap - 1:
                    piece, rot = "CORREDOR_Ponta", 180
                else:
                    piece, rot = "CORREDOR_Meio", 0
                self.corridors.append((c[0], c[1], axis, piece, rot + (90 if axis == "y" else 0)))
        # conectividade
        adj = {r.key: set() for r in self.rooms}
        for d in doors:
            if d["link"]:
                adj[d["room"].key].add(d["link"]["room"].key)
        seen, stack = set(), [self.rooms[0].key]
        while stack:
            k = stack.pop()
            if k not in seen:
                seen.add(k)
                stack.extend(adj[k] - seen)
        missing = [r.key for r in self.rooms if r.key not in seen]
        if missing:
            self.errors.append(f"cômodos isolados: {missing}")
        kinds = {r.kind for r in self.rooms}
        if not ESSENTIALS <= kinds:
            self.errors.append(f"faltam essenciais: {ESSENTIALS - kinds}")
        # porta sem corredor que dá de cara com outro cômodo: sem saída -> vira parede (sem porta/rampa)
        for d in doors:
            nx, ny = d["normal"]
            cell = (int((d["pos"][0] + nx * 2) // TILE), int((d["pos"][1] + ny * 2) // TILE))
            d["blocked"] = d["link"] is None and cell in occ
        if not any(d["link"] is None and not d["blocked"] for d in doors):
            self.errors.append("sem saída para o exterior")

    def bounds(self):
        xs = [c[0] for r in self.rooms for c in r.cells()] + [c[0] for c in self.corridors]
        ys = [c[1] for r in self.rooms for c in r.cells()] + [c[1] for c in self.corridors]
        return min(xs), min(ys), max(xs), max(ys)

    def ascii(self):
        occ = {}
        for r in self.rooms:
            ch = r.kind[0] if r.kind != "Comunicacoes" else "c"
            ch = {"Medicina": "+", "Garagem": "V", "Laboratorio": "L", "Refeitorio": "R", "Pesquisa": "P"}.get(r.kind, ch)
            for c in r.cells():
                occ[c] = ch
        for c in self.corridors:
            occ[(c[0], c[1])] = "-" if c[2] == "x" else "|"
        x0, y0, x1, y1 = self.bounds()
        rows = []
        for y in range(y1, y0 - 1, -1):
            rows.append("".join(occ.get((x, y), ".") for x in range(x0, x1 + 1)))
        return "\n".join(rows)

    def bay(self):
        """Sala-garagem da base: onde ficam e por onde saem os veículos (coordenadas do mundo, metros)."""
        if hasattr(self, "_bay"):
            return self._bay
        self._bay = None
        for kind in BAY_KINDS:
            for r in self.rooms:
                if r.kind != kind:
                    continue
                ext = {d["id"]: d for d in r.doors if d["garage"] and d["link"] is None and not d.get("blocked")}
                table = BAY_PATHS[kind]
                sides = [k for k in table if k in ext]
                if not sides:
                    continue
                pick = {"crew": sides[0], "auto": sides[-1]}
                out = {"room": r.key, "kind": kind}
                for who, side in pick.items():
                    spec = table[side]
                    pts = []
                    for lx, ly in spec[who]:
                        rx, ry = rot_vec(lx, ly, r.rot)
                        pts.append([round(r.origin[0] + rx, 3), round(r.origin[1] + ry, 3)])
                    hx, hy = rot_vec(spec["head"][0], spec["head"][1], r.rot)
                    nx, ny = ext[side]["normal"]
                    out[who] = {"path": pts, "heading": [hx, hy], "door": side, "exit": [nx, ny]}
                self._bay = out
                return out
        return None

    def to_json(self):
        x0, y0, x1, y1 = self.bounds()
        return {
            "id": self.key,
            "name": self.name,
            "description": self.desc,
            "tileMeters": TILE,
            "bounds": {"x0": x0, "y0": y0, "x1": x1 + 1, "y1": y1 + 1},
            "rooms": [
                {
                    "id": r.key,
                    "kind": r.kind,
                    "tile": [r.tx, r.ty],
                    "size": [r.w, r.d],
                    "rotation": r.rot,
                    "doors": [
                        {"side": d["id"], "pos": list(d["pos"]), "garage": d["garage"], "exterior": d["link"] is None}
                        for d in r.doors
                        if not d.get("blocked")
                    ],
                }
                for r in self.rooms
            ],
            "corridors": [{"tile": [c[0], c[1]], "axis": c[2]} for c in self.corridors],
            "bay": self.bay(),
        }


# ------------------------------------------------------------------ as 8 bases
# (tipo, tile_x, tile_y, rotação)
LAYOUTS = [
    Layout(
        "jezero",
        "Jezero · Cruz",
        "Compacta em cruz ao redor da estufa central. Extras: laboratório e refeitório.",
        [
            ("Estufa", 0, 0),
            ("Habitacao", 0, -3),
            ("Laboratorio", 4, 0),
            ("Refeitorio", -4, 0),
            ("SuporteVida", 1, 4),
            ("Comunicacoes", -7, 1),
            ("CentralEnergia", 4, -3),
            ("Armazem", -4, -2),
        ],
    ),
    Layout(
        "utopia",
        "Utopia · Linha",
        "Esticada ao longo de um eixo leste-oeste, com corredores longos. Extras: refeitório, "
        "laboratório e garagem.",
        [
            ("Comunicacoes", -14, 1),
            ("Habitacao", -10, 0),
            ("Estufa", -5, 0),
            ("Refeitorio", 0, 0),
            ("Laboratorio", 5, 0),
            ("CentralEnergia", 10, 0),
            ("Armazem", -9, -4),
            ("SuporteVida", -5, -4, 180),
            ("Garagem", 5, 4, 180),
        ],
    ),
    Layout(
        "gale",
        "Gale · Bloco",
        "Bem compacta: módulos colados por corredores de um tile. Extras: enfermaria e pesquisa.",
        [
            ("Habitacao", 0, 0),
            ("Estufa", 0, 3),
            ("SuporteVida", 4, 1, 180),
            ("CentralEnergia", -3, 1, 180),
            ("Comunicacoes", -3, 4),
            ("Armazem", 4, 3, 180),
            ("Medicina", 0, -3),
            ("Pesquisa", 1, 7),
        ],
    ),
    Layout(
        "olympus",
        "Olympus · Anel",
        "Desenha um anel ao redor de um pátio central com a plataforma de pouso. Extras: "
        "laboratório e pesquisa.",
        [
            ("Habitacao", 0, 0),
            ("SuporteVida", 4, 1, 180),
            ("Laboratorio", 4, 4),
            ("Estufa", 0, 7),
            ("Armazem", 4, 7, 180),
            ("CentralEnergia", -3, 1, 270),
            ("Pesquisa", -2, 4),
            ("Comunicacoes", -3, 8),
        ],
    ),
    Layout(
        "valles",
        "Valles · Duas Estufas",
        "Duas estufas lado a lado em volta da habitação: muita comida, mais água e energia. "
        "Extra: refeitório.",
        [
            ("Estufa", -4, -1),
            ("Habitacao", 0, -1),
            ("Estufa", 4, -1),
            ("Refeitorio", 0, 2),
            ("CentralEnergia", 4, 2),
            ("Comunicacoes", -3, 3),
            ("SuporteVida", 0, -4, 180),
            ("Armazem", -3, -5),
        ],
    ),
    Layout(
        "hellas",
        "Hellas · Estrela",
        "Laboratório no centro e quatro braços longos. Extras: laboratório, enfermaria e garagem.",
        [
            ("Laboratorio", 0, 0),
            ("Estufa", 0, 5),
            ("Habitacao", 5, 0),
            ("Comunicacoes", -4, 1),
            ("Medicina", 0, -4),
            ("CentralEnergia", 10, 0),
            ("SuporteVida", 1, 10),
            ("Armazem", -9, 2),
            ("Garagem", -1, -8),
        ],
    ),
    Layout(
        "elysium",
        "Elysium · Expedição",
        "Base em L voltada à exploração: oficina e garagem para os rovers. Extras: oficina, "
        "garagem e pesquisa.",
        [
            ("Habitacao", 0, 0),
            ("Oficina", 4, 0),
            ("Estufa", -4, 0),
            ("CentralEnergia", -7, 1, 180),
            ("Pesquisa", -3, 4),
            ("Comunicacoes", -2, 7, 90),
            ("Armazem", -3, 10, 180),
            ("SuporteVida", 0, -3, 180),
            ("Garagem", 3, -3),
        ],
    ),
    Layout(
        "arcadia",
        "Arcadia · Campus",
        "Campus científico em H. Extras: laboratório, pesquisa, enfermaria e refeitório.",
        [
            ("Laboratorio", 0, 0),
            ("Habitacao", -4, 0),
            ("Estufa", -4, 3),
            ("SuporteVida", -4, -3, 180),
            ("Refeitorio", 4, 0),
            ("CentralEnergia", 4, -3),
            ("Pesquisa", 1, 4),
            ("Comunicacoes", 2, 7, 90),
            ("Armazem", 1, -3),
            ("Medicina", -3, 7),
        ],
    ),
]

if __name__ == "__main__":
    for L in LAYOUTS:
        print(f"== {L.key}: {L.name}  {'OK' if not L.errors else L.errors}")
        print(L.ascii())
