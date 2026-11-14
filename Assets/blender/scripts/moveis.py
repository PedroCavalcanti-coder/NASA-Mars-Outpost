# Mars Outpost — móveis, equipamentos e plantas (catálogo 40_MOVEIS / 41_PLANTAS).
# Cada peça: origem no centro do chão da peça, frente voltada para -Y, 1 objeto, poucos materiais.
# Requer lib_kit.py carregado antes.

W, D, GL, MT = "M_Hull_White", "M_Dark_Metal", "M_Glow_Cyan", "M_Aco"
CAT_X, CAT_Y = 230.0, -200.0  # área de catálogo, longe da base montada

FURNITURE = {}


def furniture(fn):
    FURNITURE[fn.__name__] = fn
    return fn


@furniture
def MOVEL_Beliche():
    p = Piece()
    for x in (-0.95, 0.95):
        for y in (-0.42, 0.42):
            p.boxz((0.07, 0.07, 1.9), x, y, 0, mat(D))
    for z in (0.35, 1.3):
        p.boxz((2.0, 0.9, 0.1), 0, 0, z, mat(W))
        p.boxz((1.9, 0.82, 0.16), 0, 0, z + 0.1, mat("M_Tecido_Azul"))
        p.boxz((0.4, 0.6, 0.1), -0.7, 0, z + 0.26, mat("M_Almofada"))
    p.boxz((2.0, 0.05, 0.2), 0, -0.44, 1.62, mat(D))  # grade de proteção
    for z in (0.5, 0.8, 1.1):
        p.boxz((0.05, 0.4, 0.04), 1.0, -0.2, z, mat(MT), 0)
    return p


@furniture
def MOVEL_Armario():
    p = Piece()
    p.boxz((0.9, 0.55, 2.0), 0, 0, 0, mat(W))
    p.boxz((0.02, 0.56, 1.9), 0, 0, 0.05, mat(D))
    for x in (-0.06, 0.06):
        p.boxz((0.03, 0.04, 0.3), x, -0.29, 0.95, mat(D))
    p.boxz((0.12, 0.02, 0.05), -0.3, -0.28, 1.8, mat("M_Glow_Green"))
    return p


@furniture
def MOVEL_Cadeira():
    p = Piece()
    p.cyl(0.25, 0.05, 0, 0, 0, mat(D), seg=6)
    p.cyl(0.04, 0.4, 0, 0, 0.05, mat(MT), seg=6)
    p.boxz((0.5, 0.5, 0.1), 0, 0, 0.45, mat("M_Tecido_Cinza"))
    p.boxz((0.5, 0.08, 0.55), 0, 0.22, 0.55, mat("M_Tecido_Cinza"))
    return p


@furniture
def MOVEL_MesaRefeitorio():
    p = Piece()
    p.boxz((2.2, 0.9, 0.06), 0, 0, 0.72, mat(W))
    for x in (-0.95, 0.95):
        p.boxz((0.08, 0.7, 0.72), x, 0, 0, mat(D))
    for y in (-0.75, 0.75):
        p.boxz((2.0, 0.35, 0.06), 0, y, 0.42, mat("M_Tecido_Cinza"))
        for x in (-0.85, 0.85):
            p.boxz((0.06, 0.25, 0.42), x, y, 0, mat(D))
    # bandejas
    for x, y in ((-0.6, -0.2), (0.1, 0.25), (0.7, -0.2)):
        p.boxz((0.35, 0.25, 0.03), x, y, 0.78, mat(MT))
    return p


@furniture
def MOVEL_Cozinha():
    p = Piece()
    p.boxz((2.4, 0.7, 0.9), 0, 0, 0, mat(W))
    p.boxz((2.44, 0.74, 0.05), 0, 0, 0.9, mat(D))
    p.boxz((0.6, 0.45, 0.02), -0.7, 0, 0.95, mat(MT))  # pia
    p.cyl(0.03, 0.3, -0.7, 0.25, 0.95, mat(MT))
    for x in (0.4, 0.8):
        p.cyl(0.14, 0.02, x, 0, 0.95, mat("M_Tela_Laranja"), seg=10)
    p.boxz((2.4, 0.4, 0.6), 0, 0.15, 1.6, mat(W))  # armário superior
    for x in (-0.8, 0, 0.8):
        p.boxz((0.7, 0.02, 0.5), x, -0.06, 1.65, mat(D))
    p.boxz((0.5, 0.35, 0.3), 1.0, 0.05, 0.95, mat(D))  # micro-ondas/reidratador
    p.boxz((0.3, 0.02, 0.18), 0.95, -0.13, 1.0, mat(GL))
    return p


@furniture
def MOVEL_Despensa():
    p = Piece()
    p.boxz((0.9, 0.75, 2.0), 0, 0, 0, mat(W))
    p.boxz((0.02, 0.76, 1.9), 0, 0, 0.05, mat(D))
    p.boxz((0.25, 0.02, 0.12), 0.2, -0.38, 1.6, mat(GL))
    for x in (-0.07, 0.07):
        p.boxz((0.03, 0.04, 0.6), x, -0.39, 0.8, mat(D))
    return p


@furniture
def MOVEL_Maca():
    p = Piece()
    p.boxz((0.8, 2.0, 0.12), 0, 0, 0.72, mat(W))
    p.boxz((0.74, 1.9, 0.1), 0, 0, 0.84, mat("M_Almofada"))
    p.boxz((0.7, 0.5, 0.25), 0, 0.7, 0.9, mat("M_Almofada"))
    p.boxz((0.3, 1.4, 0.7), 0, 0, 0.02, mat(D))
    p.cyl(0.04, 1.6, 0.6, 0.8, 0, mat(MT))  # suporte do monitor
    p.boxz((0.5, 0.08, 0.35), 0.6, 0.8, 1.55, mat(D))
    p.boxz((0.44, 0.02, 0.28), 0.6, 0.755, 1.585, mat("M_Tela_Verde"))
    return p


@furniture
def MOVEL_ArmarioMedico():
    p = Piece()
    p.boxz((1.2, 0.5, 1.9), 0, 0, 0, mat(W))
    p.boxz((0.02, 0.51, 1.8), 0, 0, 0.05, mat(D))
    p.boxz((0.36, 0.02, 0.1), 0, -0.26, 1.45, mat("M_Med_Red"))
    p.boxz((0.1, 0.02, 0.36), 0, -0.26, 1.33, mat("M_Med_Red"))
    return p


@furniture
def MOVEL_Computador():
    p = Piece()
    p.boxz((1.5, 0.75, 0.05), 0, 0, 0.72, mat(W))
    for x in (-0.7, 0.7):
        p.boxz((0.06, 0.7, 0.72), x, 0, 0, mat(D))
    for x, r in ((-0.33, 0.25), (0.33, -0.25)):
        p.boxz((0.6, 0.05, 0.4), x, 0.22, 0.95, mat(D), r)
        p.boxz((0.55, 0.02, 0.34), x - 0.008 * (1 if r > 0 else -1), 0.19, 0.98, mat("M_Tela"), r)
        p.boxz((0.06, 0.06, 0.2), x, 0.25, 0.77, mat(D))
    p.boxz((0.55, 0.18, 0.03), 0, -0.1, 0.77, mat(D))  # teclado
    p.boxz((0.25, 0.4, 0.45), 0.55, 0.1, 0.0, mat(D))  # gabinete
    p.boxz((0.03, 0.02, 0.2), 0.55, -0.11, 0.2, mat(GL))
    return p


@furniture
def MOVEL_BancadaLab():
    p = Piece()
    p.boxz((2.4, 0.8, 0.92), 0, 0, 0, mat(W))
    p.boxz((2.44, 0.84, 0.05), 0, 0, 0.92, mat(D))
    p.boxz((2.4, 0.3, 0.04), 0, 0.25, 1.55, mat(W))  # prateleira
    for x in (-1.15, 1.15):
        p.boxz((0.05, 0.05, 0.65), x, 0.38, 0.97, mat(D))
    # microscópio
    p.boxz((0.25, 0.3, 0.05), -0.7, 0, 0.97, mat(D))
    p.boxz((0.06, 0.06, 0.4), -0.7, 0.1, 1.0, mat(D))
    p.cyl(0.045, 0.25, -0.7, -0.02, 1.25, mat(W), seg=6, r2=0.03)
    # frascos
    for i, x in enumerate((0.1, 0.3, 0.5, 0.7, 0.95)):
        liq = mat("M_Liquido_Verde" if i % 2 else "M_Liquido_Azul")
        p.cyl(0.06, 0.14, x, -0.05 + (i % 2) * 0.12, 0.97, liq, seg=8)
        p.cyl(0.065, 0.1, x, -0.05 + (i % 2) * 0.12, 1.11, mat("M_Vidro_Lab"), seg=8, r2=0.03)
    for x in (-0.9, -0.4, 0.2, 0.8):
        p.cyl(0.07, 0.18, x, 0.25, 1.59, mat("M_Vidro_Lab"), seg=8)
    return p


@furniture
def MOVEL_CaixaLuvas():
    """Glovebox para análise de amostras de solo marciano."""
    p = Piece()
    p.boxz((1.4, 0.75, 0.85), 0, 0, 0, mat(D))
    p.boxz((1.3, 0.7, 0.7), 0, 0, 0.85, mat("M_Vidro_Lab"))
    p.boxz((1.4, 0.75, 0.08), 0, 0, 1.55, mat(W))
    for x in (-0.3, 0.3):
        p.cyl(0.11, 0.06, x, -0.36, 1.12, mat("M_Borracha"), seg=10, axis="Y")
    p.boxz((0.3, 0.25, 0.12), 0.1, 0.05, 0.86, mat("M_Mars_Soil"))
    return p


@furniture
def MOVEL_ConsoleComunicacao():
    p = Piece()
    import math as _m

    for i, ang in enumerate((-0.45, 0, 0.45)):
        x, y = _m.sin(ang) * 1.1, -_m.cos(ang) * 1.1 + 1.1
        p.boxz((1.0, 0.7, 0.85), x, y, 0, mat(W), ang)
        p.boxz((1.0, 0.7, 0.04), x, y, 0.85, mat(D), ang)
        sx, sy = x + _m.sin(ang) * 0.25, y + (-_m.cos(ang) * -0.25)
        p.boxz((0.9, 0.06, 0.55), sx, sy, 0.95, mat(D), ang)
        scr = ("M_Tela", "M_Tela_Verde", "M_Tela")[i]
        p.boxz((0.82, 0.02, 0.47), sx - _m.sin(ang) * 0.035, sy - _m.cos(ang) * 0.035, 0.99, mat(scr), ang)
    p.boxz((0.6, 0.25, 0.1), 0, 0.1, 0.89, mat(D))  # rádio / microfone
    p.cyl(0.015, 0.25, 0.2, 0.15, 0.99, mat(MT))
    p.sphere(0.04, 0.2, 0.15, 1.26, mat(D))
    return p


@furniture
def MOVEL_RackServidor():
    p = Piece()
    p.boxz((0.7, 0.9, 2.05), 0, 0, 0, mat(D))
    for i in range(8):
        z = 0.15 + i * 0.22
        p.boxz((0.62, 0.02, 0.16), 0, -0.455, z, mat("M_Aco"))
        p.boxz((0.06, 0.02, 0.03), -0.22, -0.47, z + 0.06, mat("M_Glow_Green" if i % 3 else GL))
        p.boxz((0.06, 0.02, 0.03), -0.12, -0.47, z + 0.06, mat("M_Glow_Orange" if i == 5 else "M_Glow_Green"))
    return p


@furniture
def MOVEL_Prateleira():
    p = Piece()
    for x in (-0.98, 0.98):
        for y in (-0.28, 0.28):
            p.boxz((0.05, 0.05, 2.2), x, y, 0, mat(D))
    for z in (0.15, 0.85, 1.55, 2.15):
        p.boxz((2.0, 0.6, 0.04), 0, 0, z, mat(MT))
    for x, z, s in ((-0.6, 0.19, 0.5), (0.15, 0.19, 0.45), (0.65, 0.19, 0.4), (-0.4, 0.89, 0.45), (0.5, 0.89, 0.55), (0.0, 1.59, 0.4), (-0.65, 1.59, 0.35)):
        p.boxz((s, 0.45, s * 0.75), x, 0, z, mat("M_Caixa_Carga"))
    return p


@furniture
def MOVEL_Caixote():
    p = Piece()
    p.boxz((1.0, 1.0, 0.8), 0, 0, 0, mat("M_Caixa_Carga"))
    for x in (-0.5, 0.5):
        p.boxz((0.04, 1.02, 0.82), x, 0, -0.01, mat(D))
    p.boxz((1.02, 1.02, 0.04), 0, 0, 0.4, mat(D))
    p.boxz((0.3, 0.02, 0.15), 0, -0.51, 0.55, mat("M_Hazard_Yellow"))
    return p


@furniture
def MOVEL_BancadaFerramentas():
    p = Piece()
    p.boxz((2.2, 0.8, 0.9), 0, 0, 0, mat(D))
    p.boxz((2.24, 0.84, 0.06), 0, 0, 0.9, mat(MT))
    p.boxz((2.2, 0.06, 1.0), 0, 0.37, 0.96, mat(W))  # painel de ferramentas
    for i, x in enumerate((-0.8, -0.45, -0.1, 0.25, 0.6, 0.85)):
        p.boxz((0.05, 0.03, 0.35 + (i % 3) * 0.1), x, 0.32, 1.25, mat(D if i % 2 else "M_Hazard_Yellow"))
    p.boxz((0.35, 0.25, 0.15), -0.5, -0.05, 0.96, mat("M_Hazard_Yellow"))  # caixa de ferramentas
    p.cyl(0.12, 0.08, 0.5, 0, 0.96, mat(MT), seg=8)  # morsa
    p.boxz((0.15, 0.1, 0.18), 0.5, 0, 1.04, mat(D))
    return p


@furniture
def MOVEL_TanqueSuporteVida():
    p = Piece()
    for x in (-0.55, 0.55):
        p.cyl(0.42, 1.7, x, 0, 0.1, mat(W), seg=12)
        p.cyl(0.42, 0.1, x, 0, 1.8, mat(D), seg=12, r2=0.2)
        p.boxz((0.86, 0.04, 0.12), x, -0.4, 1.0, mat("M_NASA_Azul"))
    p.boxz((2.0, 0.9, 0.1), 0, 0, 0, mat(D))
    p.cyl(0.06, 1.1, 0, 0, 1.6, mat(MT), axis="X")
    p.boxz((0.35, 0.25, 0.5), 0, -0.3, 0.1, mat(D))
    p.boxz((0.2, 0.02, 0.12), 0, -0.43, 0.42, mat("M_Tela_Verde"))
    return p


@furniture
def MOVEL_FiltroAr():
    p = Piece()
    p.boxz((1.2, 0.8, 1.8), 0, 0, 0, mat(W))
    for z in (0.3, 0.7, 1.1):
        p.boxz((1.0, 0.02, 0.28), 0, -0.41, z, mat(D))
    p.cyl(0.25, 0.04, 0, -0.42, 1.5, mat(MT), seg=10, axis="Y")
    p.boxz((0.15, 0.02, 0.06), 0.4, -0.41, 1.6, mat(GL))
    return p


@furniture
def MOVEL_PainelEletrico():
    p = Piece()
    p.boxz((1.6, 0.5, 2.0), 0, 0, 0, mat(D))
    for x in (-0.4, 0.4):
        p.boxz((0.72, 0.02, 1.8), x, -0.26, 0.1, mat("M_Aco"))
    p.boxz((0.5, 0.02, 0.3), -0.4, -0.28, 1.5, mat("M_Tela_Laranja"))
    for i in range(5):
        p.boxz((0.05, 0.02, 0.05), 0.15 + i * 0.12, -0.28, 1.6, mat("M_Glow_Green"))
    p.boxz((0.3, 0.02, 0.2), 0.4, -0.28, 1.2, mat("M_Hazard_Yellow"))
    return p


@furniture
def MOVEL_Esteira():
    p = Piece()
    p.boxz((0.8, 1.8, 0.2), 0, 0, 0, mat(D))
    p.boxz((0.6, 1.6, 0.03), 0, 0, 0.2, mat("M_Borracha"))
    for x in (-0.38, 0.38):
        p.boxz((0.05, 0.05, 1.1), x, -0.8, 0.2, mat(MT))
    p.boxz((0.8, 0.25, 0.25), 0, -0.85, 1.2, mat(W))
    p.boxz((0.3, 0.02, 0.15), 0, -0.98, 1.25, mat(GL))
    return p


@furniture
def MOVEL_Sofa():
    p = Piece()
    p.boxz((2.0, 0.85, 0.42), 0, 0, 0, mat("M_Tecido_Cinza"))
    p.boxz((2.0, 0.25, 0.5), 0, 0.3, 0.42, mat("M_Tecido_Cinza"))
    for x in (-0.95, 0.95):
        p.boxz((0.18, 0.85, 0.3), x, 0, 0.42, mat("M_Tecido_Cinza"))
    for x in (-0.45, 0.45):
        p.boxz((0.8, 0.6, 0.12), x, -0.08, 0.42, mat("M_Tecido_Azul"))
    return p


@furniture
def MOVEL_Telao():
    """Tela de parede (mapa da base / briefing)."""
    p = Piece()
    p.boxz((2.2, 0.08, 1.2), 0, 0, 1.0, mat(D))
    p.boxz((2.08, 0.02, 1.08), 0, -0.045, 1.06, mat("M_Tela"))
    p.boxz((0.1, 0.06, 1.0), 0, 0.02, 0, mat(D))
    return p


@furniture
def MOVEL_EstacaoRecarga():
    p = Piece()
    p.boxz((0.6, 0.5, 1.5), 0, 0, 0, mat(W))
    p.boxz((0.6, 0.5, 0.08), 0, 0, 1.5, mat("M_Hazard_Yellow"))
    p.boxz((0.35, 0.02, 0.25), 0, -0.26, 1.05, mat("M_Tela_Verde"))
    p.cyl(0.05, 0.6, 0.2, -0.3, 0.4, mat("M_Borracha"), axis="Y")
    p.boxz((1.6, 1.0, 0.03), 0, -1.0, 0, mat("M_Hazard_Yellow"))  # faixa de estacionamento
    return p


@furniture
def VEICULO_RoverAberto():
    """Rover de exploração não pressurizado (2 lugares)."""
    p = Piece()
    p.boxz((1.6, 2.6, 0.25), 0, 0, 0.55, mat(W))
    p.boxz((1.4, 0.8, 0.3), 0, 0.8, 0.8, mat(D))
    for x in (-0.35, 0.35):
        p.boxz((0.5, 0.5, 0.12), x, -0.2, 0.8, mat("M_Tecido_Cinza"))
        p.boxz((0.5, 0.1, 0.55), x, 0.05, 0.8, mat("M_Tecido_Cinza"))
    p.boxz((0.9, 0.3, 0.35), 0, -0.85, 0.8, mat(D))
    p.boxz((0.6, 0.02, 0.2), 0, -1.0, 1.0, mat("M_Tela"))
    for x in (-0.9, 0.9):
        for y in (-0.95, 0.95):
            p.cyl(0.4, 0.3, x, y, 0.4, mat("M_Borracha"), seg=10, axis="X")
            p.cyl(0.2, 0.32, x, y, 0.4, mat(MT), seg=8, axis="X")
    p.cyl(0.02, 1.0, 0.6, 1.0, 1.1, mat(MT))
    p.cyl(0.3, 0.06, 0.6, 1.0, 2.1, mat(W), seg=10, r2=0.05)  # antena
    p.boxz((0.25, 0.02, 0.1), -0.6, -1.31, 0.62, mat("M_Glow_Orange"))
    p.boxz((0.25, 0.02, 0.1), 0.6, -1.31, 0.62, mat("M_Glow_Orange"))
    return p


# ---------------- Plantas: canteiro hidropônico de batata em 4 estágios ----------------


def _canteiro():
    p = Piece()
    p.boxz((2.2, 0.9, 0.7), 0, 0, 0, mat(W))
    p.boxz((2.1, 0.8, 0.08), 0, 0, 0.66, mat("M_Substrato"))
    p.boxz((2.2, 0.06, 0.12), 0, -0.45, 0.68, mat("M_NASA_Azul"))
    for x in (-1.05, 1.05):
        p.boxz((0.05, 0.05, 1.5), x, 0.4, 0.7, mat(D))
    p.boxz((2.2, 0.2, 0.06), 0, 0.4, 2.15, mat(D))  # barra de luz de cultivo
    p.boxz((2.0, 0.16, 0.02), 0, 0.4, 2.13, mat("M_Luz_Cultivo"))
    p.boxz((0.12, 0.02, 0.06), 0.9, -0.46, 0.45, mat("M_Glow_Green"))
    return p


SPOTS = [(x, y) for x in (-0.75, -0.25, 0.25, 0.75) for y in (-0.18, 0.18)]


def _broto(p, x, y, z):
    p.cyl(0.015, 0.08, x, y, z, mat("M_Caule"), seg=4)
    p.sphere(0.05, x - 0.03, y, z + 0.09, mat("M_Folha_Clara"), sub=1, scale=(1.2, 0.6, 0.35))
    p.sphere(0.05, x + 0.03, y, z + 0.1, mat("M_Folha_Clara"), sub=1, scale=(1.2, 0.6, 0.35))


def _planta(p, x, y, z, s=1.0, madura=False):
    folhas = ("M_Folha_Seca", "M_Folha") if madura else ("M_Folha_Clara", "M_Folha")
    p.cyl(0.025 * s, 0.35 * s, x, y, z, mat("M_Caule"), seg=5)
    for i, (dx, dy, dz) in enumerate(((-0.1, 0, 0.3), (0.1, 0.05, 0.36), (0, -0.09, 0.42), (0.02, 0.08, 0.5), (0, 0, 0.58))):
        p.sphere(0.13 * s, x + dx * s, y + dy * s, z + dz * s, mat(folhas[i % 2]), sub=1, scale=(1, 1, 0.55))


def _plantas_estagio(stage):
    p = _canteiro()
    z = 0.74
    for i, (x, y) in enumerate(SPOTS):
        if stage == 1:
            _broto(p, x, y, z)
        elif stage >= 2:
            _planta(p, x, y, z, 1.0 if (i % 3) else 0.85, madura=stage == 3)
        if stage == 3:
            for j, (dx, dy) in enumerate(((-0.12, -0.13), (0.11, -0.12), (0.0, 0.14))):
                p.sphere(0.075, x + dx, y + dy, z + 0.04, mat("M_Batata"), sub=1, scale=(1.3, 1, 0.9))
    if stage == 3:  # cesto com batatas colhidas na frente do canteiro
        p.boxz((0.6, 0.35, 0.22), 0.6, -0.65, 0, mat(D))
        for k in range(7):
            p.sphere(0.08, 0.38 + (k % 4) * 0.14, -0.72 + (k // 4) * 0.15, 0.25, mat("M_Batata"), sub=1, scale=(1.3, 1, 0.9))
    return p


PLANT_STAGES = {
    "PLANTA_Batata_0_Vazio": lambda: _plantas_estagio(0),
    "PLANTA_Batata_1_Broto": lambda: _plantas_estagio(1),
    "PLANTA_Batata_2_Crescida": lambda: _plantas_estagio(2),
    "PLANTA_Batata_3_Colheita": lambda: _plantas_estagio(3),
}


def build_catalog():
    c_mov = collection("40_MOVEIS")
    c_pl = collection("41_PLANTAS")
    out = {}
    for i, (name, fn) in enumerate(FURNITURE.items()):
        ob = fn().build(name, c_mov, (CAT_X + (i % 8) * 4, CAT_Y - (i // 8) * 4, 0), {"tipo": "movel"})
        out[name] = tris(ob)
    for i, (name, fn) in enumerate(PLANT_STAGES.items()):
        ob = fn().build(name, c_pl, (CAT_X + i * 4, CAT_Y - 16, 0), {"tipo": "planta", "estagio": i})
        out[name] = tris(ob)
    return out
