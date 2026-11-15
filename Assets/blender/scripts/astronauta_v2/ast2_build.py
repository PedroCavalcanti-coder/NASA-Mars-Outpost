# Reconstrói as malhas do astronauta v2 (versão arredondada/amigável).
# Requer ast2_lib.py já executado no mesmo namespace.
import bpy, math
from mathutils import Vector, Matrix

SUIT = Part(["suit"]); HELM = Part(["helmet"]); VEST = Part(["vest"]); PACK = Part(["backpack"])
GLOV = Part(["gloves", "metal"]); BOOT = Part(["boots"])
STAT = Part(["black", "panel", "metal", "visor", "blue", "light", "orange_fixed"])

# ---------------- cabeça (capacete grande e redondo) ----------------
VIS = ((0, -0.125, 1.40), (0.25, 0.19, 0.185))
HELM.sphere((0, 0.01, 1.41), (0.31, 0.30, 0.29), "head", "helmet", us=30, vs=16)
STAT.sphere(*VIS, "head", "visor", us=30, vs=16)
STAT.box((0, -0.255, 1.188), (0.12, 0.05, 0.035), "head", "panel", r=0.014, seg=2)       # queixo
HELM.cyl((-0.305, 0.02, 1.41), 0.06, 0.06, 0.04, "head", "helmet", axis='X', seg=20, r=0.012)   # "orelha"
STAT.cyl((-0.33, 0.02, 1.41), 0.03, 0.03, 0.012, "head", "metal", axis='X', seg=14, r=0.004)
# rádio
PACK.box((0.32, 0.05, 1.43), (0.08, 0.105, 0.185), "head", "backpack", r=0.025, seg=3)
STAT.cyl((0.32, -0.004, 1.485), 0.015, 0.015, 0.01, "head", "light", axis='Y', seg=12)
for k in range(3):
    STAT.box((0.32, -0.003, 1.38 + k * 0.017), (0.042, 0.008, 0.006), "head", "panel")
STAT.cyl((0.32, 0.07, 1.6), 0.006, 0.006, 0.15, "head", "metal", seg=8)
STAT.sphere((0.32, 0.07, 1.68), (0.012, 0.012, 0.012), "head", "metal", us=8, vs=5)
STAT.cyl((0.32, 0.07, 1.525), 0.017, 0.017, 0.012, "head", "metal", seg=10, r=0.003)
# colar laranja (arredondado)
VEST.cyl((0, 0, 1.17), 0.235, 0.205, 0.1, "torso", "vest", seg=28, r=0.03, rseg=3)
VEST.box((0, -0.205, 1.095), (0.19, 0.06, 0.1), "torso", "vest", r=0.022, seg=3)
for x in (-0.072, 0.072):
    for z in (1.07, 1.12):
        STAT.cyl((x, -0.236, z), 0.009, 0.009, 0.006, "torso", "metal", axis='Y', seg=8)

# ---------------- tronco ----------------
SUIT.box((0, -0.01, 0.89), (0.66, 0.40, 0.52), "torso", "suit", r=0.12, seg=3)
SUIT.box((0, 0.0, 0.62), (0.5, 0.34, 0.16), "root", "suit", r=0.06, seg=3)
STAT.box((0, -0.215, 0.93), (0.34, 0.05, 0.18), "torso", "panel", r=0.022, seg=3)
STAT.box((-0.075, -0.24, 0.955), (0.078, 0.014, 0.06), "torso", "blue", r=0.006, seg=2)
STAT.box((0.065, -0.24, 0.955), (0.072, 0.014, 0.06), "torso", "orange_fixed", r=0.006, seg=2)
STAT.cyl((-0.1, -0.24, 0.885), 0.017, 0.017, 0.012, "torso", "blue", axis='Y', seg=12)
STAT.cyl((-0.052, -0.24, 0.885), 0.017, 0.017, 0.012, "torso", "orange_fixed", axis='Y', seg=12)
for (x, z) in ((-0.155, 1.0), (0.155, 1.0), (-0.155, 0.86), (0.155, 0.86)):
    STAT.cyl((x, -0.241, z), 0.006, 0.006, 0.006, "torso", "metal", axis='Y', seg=6)
STAT.tube([(0.07, -0.243, 0.873), (0.072, -0.254, 0.848), (0.11, -0.256, 0.835), (0.16, -0.248, 0.85),
           (0.185, -0.23, 0.9), (0.19, -0.215, 0.95)], 0.009, "torso", "blue", seg=8)
STAT.tube([(0.095, -0.243, 0.873), (0.098, -0.251, 0.855), (0.13, -0.252, 0.848), (0.172, -0.243, 0.868),
           (0.198, -0.223, 0.92), (0.2, -0.21, 0.96)], 0.009, "torso", "orange_fixed", seg=8)
for sx in (-1, 1):
    for k in range(3):
        STAT.box((sx * 0.215, -0.208, 1.06 - k * 0.016), (0.07, 0.008, 0.006), "torso", "panel")
    for z in (1.06, 0.72):
        STAT.cyl((sx * 0.25, -0.209, z), 0.008, 0.008, 0.006, "torso", "metal", axis='Y', seg=8)
# cinto
VEST.box((0, -0.205, 0.66), (0.42, 0.11, 0.135), "torso", "vest", r=0.04, seg=3)
for sx in (-1, 1):
    STAT.box((sx * 0.11, -0.205, 0.66), (0.034, 0.122, 0.155), "torso", "metal", r=0.008, seg=2)
    for z in (0.625, 0.695):
        STAT.cyl((sx * 0.11, -0.268, z), 0.008, 0.008, 0.006, "torso", "metal", axis='Y', seg=8)
for k in range(4):
    STAT.box((0.165, -0.262, 0.635 + k * 0.015), (0.045, 0.006, 0.006), "torso", "panel")
# mochila
PACK.box((0, 0.295, 0.9), (0.56, 0.23, 0.58), "torso", "backpack", r=0.1, seg=3)
for k in range(4):
    STAT.box((0, 0.411, 0.78 + k * 0.03), (0.22, 0.006, 0.012), "torso", "panel")

# ---------------- braços / pernas (cápsulas arredondadas) ----------------
for s, sx in (("L", -1), ("R", 1)):
    ax = sx * 0.39; lx = sx * 0.13
    # junta flexível preta entre peito e ombro (como na referência)
    STAT.cyl((sx * 0.33, 0, 0.97), 0.085, 0.085, 0.07, "torso", "black", axis='X', seg=18, r=0.02)
    # ombreira: cúpula macia presa ao peito (traje humano, não bloco de robô)
    SUIT.sphere((sx * 0.37, 0, 1.0), (0.135, 0.155, 0.12), "arm_" + s, "suit", us=22, vs=12)
    STAT.cyl((sx * 0.47, -0.075, 0.975), 0.032, 0.032, 0.02, "arm_" + s, "black", axis='X', seg=14, r=0.005,
             rot=Matrix.Rotation(sx * -0.6, 3, 'Z'))
    # manga contínua: braço, cotovelo, antebraço
    SUIT.cyl((ax, 0, 0.885), 0.082, 0.088, 0.17, "arm_" + s, "suit", seg=18, r=0.03, rseg=3)
    STAT.cyl((ax, 0, 0.80), 0.09, 0.09, 0.035, "forearm_" + s, "black", seg=18, r=0.01)
    SUIT.cyl((ax, 0, 0.725), 0.078, 0.085, 0.13, "forearm_" + s, "suit", seg=18, r=0.028, rseg=3)
    STAT.cyl((ax, 0, 0.655), 0.08, 0.08, 0.026, "forearm_" + s, "black", seg=18, r=0.008)
    # luva: punho, palma virada para o corpo, dedos em fila de frente para trás
    GLOV.cyl((ax, 0, 0.628), 0.075, 0.088, 0.045, "hand_" + s, "gloves", seg=18, r=0.012)
    GLOV.box((ax, 0.005, 0.572), (0.088, 0.15, 0.115), "hand_" + s, "gloves", r=0.036, seg=3)
    for k, (fy, L) in enumerate(((-0.052, 0.105), (-0.014, 0.115), (0.024, 0.11), (0.06, 0.092))):
        bone = ("index_" if k == 0 else "fingers_") + s
        top = 0.548
        GLOV.box((ax - sx * 0.004, fy, top - L / 2), (0.068, 0.034, L), bone, "gloves", r=0.015, seg=2)
        GLOV.box((ax - sx * 0.004, fy, top - L * 0.42), (0.0695, 0.0352, 0.007), bone, "metal")
    # polegar na frente da palma, apontando para frente/baixo (no joinha ele fica para cima)
    GLOV.box((ax - sx * 0.03, -0.1, 0.56), (0.046, 0.044, 0.095), "thumb_" + s, "gloves", r=0.019, seg=2,
             rot=Matrix.Rotation(-0.6, 3, 'X'))
    # perna
    SUIT.box((lx, 0, 0.49), (0.245, 0.255, 0.23), "leg_" + s, "suit", r=0.075, seg=3)
    STAT.cyl((lx, -0.127, 0.5), 0.056, 0.056, 0.03, "leg_" + s, "black", seg=20, axis='Y', r=0.008)
    STAT.cyl((lx, -0.143, 0.5), 0.028, 0.028, 0.006, "leg_" + s, "panel", seg=14, axis='Y')
    STAT.cyl((lx, 0, 0.365), 0.128, 0.128, 0.04, "shin_" + s, "black", seg=20, r=0.01)
    SUIT.box((lx, 0, 0.25), (0.235, 0.245, 0.21), "shin_" + s, "suit", r=0.07, seg=3)
    STAT.cyl((lx, -0.122, 0.29), 0.056, 0.056, 0.03, "shin_" + s, "black", seg=20, axis='Y', r=0.008)
    STAT.cyl((lx, -0.138, 0.29), 0.028, 0.028, 0.006, "shin_" + s, "panel", seg=14, axis='Y')
    STAT.cyl((lx, 0, 0.155), 0.122, 0.122, 0.03, "shin_" + s, "black", seg=20, r=0.008)
    BOOT.box((lx, -0.03, 0.092), (0.255, 0.345, 0.135), "foot_" + s, "boots", r=0.06, seg=3)
    STAT.box((lx, -0.03, 0.02), (0.26, 0.35, 0.04), "foot_" + s, "black", r=0.016, seg=2)

NEW = {"AST2_static": STAT, "AST2_color_suit": SUIT, "AST2_color_helmet": HELM, "AST2_color_vest": VEST,
       "AST2_color_backpack": PACK, "AST2_color_gloves": GLOV, "AST2_color_boots": BOOT}
faces = 0
for name, P in NEW.items():
    me = P.to_mesh(name + "_mesh_new")
    faces += len(me.polygons)
    master = bpy.data.objects[name]
    old = master.data
    old.user_remap(me)          # troca em todas as cópias (Idle/Walk/Work/Wave)
    bpy.data.meshes.remove(old)
    me.name = name + "_mesh"
RESULT_BUILD = {"faces_corpo": faces}
