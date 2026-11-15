# Emotes e gestos do astronauta v2 (clipes de ação no esqueleto de 21 ossos).
# Convenções (eixos do armature em repouso; personagem olha para -Y):
#   "L" = osso em -X  |  "R" = osso em +X.  Gestos de uma mão usam DOM = "L".
import bpy, math
from mathutils import Euler, Vector, Quaternion

ARM = bpy.data.armatures["astronaut2_rig"]
RESTQ = {b.name: b.matrix_local.to_quaternion() for b in ARM.bones}
RESTM = {b.name: b.matrix_local.to_3x3() for b in ARM.bones}
DOM, OFF = "L", "R"


def sx(side):
    return -1 if side == "L" else 1


def q_of(bone, deg):
    qa = Euler([math.radians(a) for a in deg], 'XYZ').to_quaternion()
    R = RESTQ[bone]
    return R.inverted() @ qa @ R


# ---------------- construtores de pose (retornam dicts osso -> graus XYZ) ----------------
def arm(side, fwd=0, out=0, swing=0, elbow=0, bend_in=0, twist=0):
    s = sx(side)
    return {"arm_" + side: (-fwd, -s * out, -s * swing),
            "forearm_" + side: (-elbow, -s * bend_in, 0),
            "hand_" + side: (0, 0, twist)}


def hand(side, curl=15, index=None, thumb=0):
    s = sx(side)
    return {"fingers_" + side: (0, s * curl, 0),
            "index_" + side: (0, s * (curl if index is None else index), 0),
            "thumb_" + side: (0, 0, -s * thumb)}


FIST = dict(curl=95, thumb=55)
THUMB = dict(curl=95, thumb=0)
POINT = dict(curl=95, index=0, thumb=55)
OPEN = dict(curl=0, thumb=0)


def leg(side, lift=0, knee=0, out=0):
    s = sx(side)
    return {"leg_" + side: (-lift, -s * out, 0), "shin_" + side: (knee, 0, 0), "foot_" + side: (lift - knee, 0, 0)}


def body(lean=0, side=0, turn=0, nod=0, tilt=0, look=0):
    return {"torso": (lean, side, turn), "head": (nod, tilt, look)}


def P(*parts, z=0.0, y=0.0, spin=0.0):
    d = {}
    for p in parts:
        d.update(p)
    d["__root__"] = (z, y, spin)
    return d


RELAX = P(hand("L"), hand("R"))

# ---------------- clipes: lista de (quadro, pose) ----------------
C = {}
def both(fn, **kw):
    return P(fn("L", **kw), fn("R", **kw))

# Tchau (aceno de despedida)
wag = [(1, RELAX)]
for i, f in enumerate(range(8, 34, 6)):
    w = 25 if i % 2 == 0 else -15
    wag.append((f, P(arm(DOM, out=150, bend_in=w), hand(DOM, **OPEN), hand(OFF), body(tilt=-6 * (1 if i % 2 else -1)))))
wag += [(42, P(arm(DOM, out=150, bend_in=10), hand(DOM, **OPEN), hand(OFF))), (54, RELAX)]
C["Emote_Bye"] = wag

# Like / joinha
up = P(arm(DOM, fwd=25, swing=10, elbow=95), hand(DOM, **THUMB), hand(OFF), body(nod=8))
C["Emote_ThumbsUp"] = [(1, RELAX), (10, up), (16, P(up, z=0.02)), (22, up), (40, up), (52, RELAX)]
# Deslike / polegar para baixo
dn = P(arm(DOM, fwd=25, swing=10, elbow=95, twist=180), hand(DOM, **THUMB), hand(OFF))
C["Emote_ThumbsDown"] = [(1, RELAX), (10, P(dn, body(look=12))), (18, P(dn, body(look=-12))), (26, P(dn, body(look=12))),
                         (34, P(dn, body(nod=10))), (44, P(dn, body(nod=10))), (56, RELAX)]
# Apontar
pt = P(arm(DOM, fwd=85, swing=-5, elbow=5), hand(DOM, **POINT), hand(OFF), body(turn=-8, look=-6))
C["Emote_Point"] = [(1, RELAX), (9, pt), (14, P(pt, body(turn=-8, look=-6, nod=-4))), (36, pt), (48, RELAX)]
# Palmas 👏
clap = []
for i, f in enumerate(range(1, 49, 6)):
    closed = i % 2 == 1
    sw = 32 if closed else 8
    clap.append((f, P(both(arm, fwd=55, swing=sw, elbow=60), both(hand, **OPEN), body(nod=4 if closed else 0), z=0.015 if closed else 0)))
C["Emote_Clap"] = [(1, RELAX)] + clap[1:] + [(56, RELAX)]
# Coração ❤️ (mãos juntas sobre o capacete)
hz = P(both(arm, out=172, bend_in=-72), both(hand, curl=40, thumb=10))
C["Emote_Heart"] = [(1, RELAX), (12, hz), (24, P(hz, body(side=6, tilt=8))), (36, P(hz, body(side=-6, tilt=-8))),
                    (48, P(hz, body(side=6, tilt=8))), (60, RELAX)]
# Risada 😂
belly = P(both(arm, fwd=25, swing=38, elbow=80), both(hand, curl=30))
laugh = [(1, RELAX)]
for i, f in enumerate(range(8, 56, 6)):
    laugh.append((f, P(belly, body(lean=-14 if i % 2 else -8, nod=-14 if i % 2 else -6, side=3 if i % 2 else -3), z=0.03 if i % 2 else 0)))
C["Emote_Laugh"] = laugh + [(64, RELAX)]
# Careta / brincalhão 😜
silly = [(1, RELAX)]
for i, f in enumerate(range(8, 56, 8)):
    a = 1 if i % 2 else -1
    silly.append((f, P(both(arm, out=110, bend_in=125, twist=25 * a), both(hand, **OPEN), body(tilt=18 * a, side=5 * a),
                       leg("L", lift=20 if a > 0 else 0, knee=35 if a > 0 else 0),
                       leg("R", lift=20 if a < 0 else 0, knee=35 if a < 0 else 0))))
C["Emote_Silly"] = silly + [(64, RELAX)]
# Surpresa 😮
C["Emote_Surprised"] = [(1, RELAX),
    (6, P(both(arm, out=60), both(hand, **OPEN), body(lean=-12, nod=-15), z=0.09, y=0.06)),
    (12, P(both(arm, out=120, bend_in=115), both(hand, **OPEN), body(lean=-6, nod=-8), both(leg, knee=15, lift=8), z=-0.02, y=0.08)),
    (18, P(both(arm, out=120, bend_in=115), both(hand, **OPEN), body(lean=-6, nod=-8), y=0.08)),
    (36, P(both(arm, out=118, bend_in=112), both(hand, **OPEN), body(lean=-4, nod=-6), y=0.08)),
    (48, RELAX)]
# Festa 🎉
cel = [(1, RELAX)]
for k, f in enumerate((6, 12, 18, 24, 30, 36)):
    if k % 3 == 0:
        cel.append((f, P(both(arm, out=40, elbow=40), both(hand, **FIST), both(leg, lift=25, knee=50), body(lean=8), z=-0.08)))
    elif k % 3 == 1:
        cel.append((f, P(both(arm, out=165), both(hand, **FIST), both(leg, knee=10), body(nod=-12), z=0.2)))
    else:
        cel.append((f, P(both(arm, out=150, bend_in=20), both(hand, **OPEN), body(nod=-6), z=0.0)))
C["Emote_Celebrate"] = cel + [(48, RELAX)]
# Foguete 🚀
fold = P(both(arm, out=176, swing=0), both(hand, **OPEN), body(nod=-6))
C["Emote_Rocket"] = [(1, RELAX),
    (12, P(both(arm, fwd=-35, elbow=10), both(hand, **FIST), both(leg, lift=45, knee=90), body(lean=20, nod=10), z=-0.16)),
    (18, P(fold, both(leg, knee=5), z=0.25)),
    (30, P(fold, z=0.62, spin=180)),
    (40, P(fold, z=0.55, spin=360)),
    (50, P(both(arm, out=60), both(hand, **OPEN), both(leg, lift=30, knee=60), body(lean=10), z=-0.08, spin=360)),
    (60, P(RELAX, spin=360))]
# Dança
dance = []
for i, f in enumerate(range(1, 98, 12)):
    a = 1 if i % 2 == 0 else -1
    dance.append((f, P(arm("L", out=120 if a > 0 else 20, elbow=60 if a > 0 else 90, fwd=0 if a > 0 else 30),
                       arm("R", out=20 if a > 0 else 120, elbow=90 if a > 0 else 60, fwd=30 if a > 0 else 0),
                       both(hand, curl=50, thumb=20),
                       leg("L", lift=25 if a > 0 else 0, knee=40 if a > 0 else 5), leg("R", lift=0 if a > 0 else 25, knee=5 if a > 0 else 40),
                       body(side=8 * a, tilt=-10 * a, turn=10 * a), z=0.03 if i % 2 else 0.0, spin=12 * a)))
    dance.append((f + 6, P(both(arm, out=70, elbow=70), both(hand, curl=50, thumb=20), both(leg, knee=25, lift=12),
                           body(nod=8), z=-0.05)))
C["Emote_Dance"] = dance
# ---- gestos em dupla (o outro jogador faz o mesmo clipe de frente) ----
C["Duo_HighFive"] = [(1, RELAX),
    (10, P(arm(DOM, fwd=150, elbow=40), hand(DOM, **OPEN), hand(OFF), body(lean=-6))),
    (17, P(arm(DOM, fwd=140, elbow=5), hand(DOM, **OPEN), hand(OFF), body(lean=6), leg(DOM, lift=20, knee=10), y=-0.06)),
    (24, P(arm(DOM, fwd=140, elbow=10), hand(DOM, **OPEN), hand(OFF), body(lean=4), y=-0.06)),
    (40, RELAX)]
shake = [(1, RELAX)]
for i, f in enumerate(range(10, 46, 6)):
    shake.append((f, P(arm(DOM, fwd=45, swing=8, elbow=35 + (15 if i % 2 else 0)), hand(DOM, curl=45, thumb=20), hand(OFF),
                       body(lean=6, nod=6), y=-0.04)))
C["Duo_Handshake"] = shake + [(58, RELAX)]
C["Duo_FistBump"] = [(1, RELAX),
    (8, P(arm(DOM, fwd=55, elbow=80), hand(DOM, **FIST), hand(OFF), body(turn=-10))),
    (15, P(arm(DOM, fwd=85, elbow=5), hand(DOM, **FIST), hand(OFF), body(turn=6, lean=6), y=-0.05)),
    (22, P(arm(DOM, fwd=85, elbow=5), hand(DOM, **FIST), hand(OFF), body(lean=6), y=-0.05)),
    (30, P(arm(DOM, fwd=70, swing=-35, elbow=20), hand(DOM, **OPEN), hand(OFF), body(nod=-8))),
    (44, RELAX)]
# abraço: cabeças lado a lado (parceiro deslocado para a direita), rosto virado para fora,
# braço dominante por cima do ombro e o outro na cintura
hugA = P(arm("L", fwd=82, swing=18, elbow=8, bend_in=-72), arm("R", fwd=62, swing=22, elbow=8, bend_in=-78), both(hand, curl=35),
         body(lean=10, turn=-10, look=28, tilt=-10), y=-0.04)
hugB = P(arm("L", fwd=84, swing=22, elbow=10, bend_in=-80), arm("R", fwd=64, swing=26, elbow=10, bend_in=-85), both(hand, curl=40),
         body(lean=12, turn=-12, look=30, tilt=-14, side=-3), y=-0.04)
C["Duo_Hug"] = [(1, RELAX),
    (12, P(both(arm, fwd=80, swing=-40, elbow=20), both(hand, **OPEN), body(lean=4, look=15), y=-0.02)),
    (24, hugA), (36, hugB), (48, hugA), (58, hugB), (72, RELAX)]


# ---------------- gravação ----------------
def build_action(name, keys, rig):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    ad = rig.animation_data_create(); ad.action = act
    used = sorted({b for _, p in keys for b in p if not b.startswith("__")} | {"root"})
    Rroot = RESTM["root"].inverted()
    for f, p in keys:
        for b in used:
            pb = rig.pose.bones[b]
            deg = p.get(b, (0, 0, 0))
            q = q_of(b, deg)
            if b == "root":
                z, y, spin = p.get("__root__", (0, 0, 0))
                q = q_of("root", (0, 0, spin))
                pb.location = Rroot @ Vector((0, y, z))
                pb.keyframe_insert("location", frame=f)
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
    act.frame_range  # força cálculo
    return act


def make_instance(tag, x, y, col):
    """Cópia do astronauta (malhas compartilhadas) com rig próprio."""
    master_meshes = [o for o in bpy.data.collections["GAL_astronauta2_Idle"].objects
                     if o.type == 'MESH' and o.name.startswith("AST2_")]
    root = bpy.data.objects.get("astronaut2_root_" + tag) or bpy.data.objects.new("astronaut2_root_" + tag, None)
    if root.name not in col.objects:
        col.objects.link(root)
    root.location = (x, y, 0)
    rig = bpy.data.objects.get("astronaut2_rig_" + tag) or bpy.data.objects.new("astronaut2_rig_" + tag, ARM)
    if rig.name not in col.objects:
        col.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.update()   # cria a pose do rig novo
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for m in master_meshes:
        nm = m.name + "_" + tag
        o = bpy.data.objects.get(nm) or bpy.data.objects.new(nm, m.data)
        if o.name not in col.objects:
            col.objects.link(o)
        o.parent = rig
        if not any(md.type == 'ARMATURE' for md in o.modifiers):
            md = o.modifiers.new("Armature", 'ARMATURE'); md.object = rig
    return rig


def label(name, text, loc, col):
    lbl = bpy.data.objects.get(name)
    if not lbl:
        fd = bpy.data.objects["LBL_Idle"].data.copy(); fd.body = text
        lbl = bpy.data.objects.new(name, fd); col.objects.link(lbl)
    else:
        lbl.data.body = text
    lbl.location = loc; lbl.rotation_euler = bpy.data.objects["LBL_Idle"].rotation_euler
    lbl.scale = (0.5, 0.5, 0.5)
    return lbl


parent_col = bpy.data.collections["GAL_Personagem_e_plantas"]
col = bpy.data.collections.get("GAL_astronauta2_Emotes") or bpy.data.collections.new("GAL_astronauta2_Emotes")
if col.name not in [c.name for c in parent_col.children]:
    parent_col.children.link(col)
PT = {"Emote_Bye": "Tchau", "Emote_ThumbsUp": "Like", "Emote_ThumbsDown": "Deslike", "Emote_Point": "Apontar",
      "Emote_Clap": "Palmas", "Emote_Heart": "Coracao", "Emote_Laugh": "Risada", "Emote_Silly": "Careta",
      "Emote_Surprised": "Surpresa", "Emote_Celebrate": "Festa", "Emote_Rocket": "Foguete", "Emote_Dance": "Danca",
      "Duo_HighFive": "Toca aqui (dupla)", "Duo_Handshake": "Aperto de mao (dupla)", "Duo_FistBump": "Soquinho (dupla)",
      "Duo_Hug": "Abraco (dupla)"}
made = {}
for i, (clip, keys) in enumerate(C.items()):
    x = 600 + (i % 8) * 4; y = -88 - (i // 8) * 7
    tag = clip
    rig = make_instance(tag, x, y, col)
    act = build_action(clip, keys, rig)
    try:
        rig.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    label("LBL2_" + clip, PT[clip], (x, y - 2.2, 0.05), col)
    made[clip] = [int(v) for v in act.frame_range]
# pares de dupla: segundo astronauta de frente para o primeiro
PAIR = {"Duo_HighFive": (-0.78, 0.98), "Duo_Handshake": (-0.78, 0.92), "Duo_FistBump": (-0.78, 1.0), "Duo_Hug": (-0.36, 0.6)}
for clip in [c for c in C if c.startswith("Duo_")]:
    tag = clip + "_par"
    src = bpy.data.objects["astronaut2_root_" + clip]
    # parceiro girado 180°: (deslocamento X, distância Y) por gesto -> mãos dominantes se encontram
    dx, dist = PAIR[clip]
    rig = make_instance(tag, src.location.x + dx, src.location.y - dist, col)
    bpy.data.objects["astronaut2_root_" + tag].rotation_euler = (0, 0, math.pi)
    ad = rig.animation_data_create(); ad.action = bpy.data.actions[clip]
    try:
        ad.action_slot = ad.action.slots[0]
    except Exception:
        pass
RESULT_ANIM = made
