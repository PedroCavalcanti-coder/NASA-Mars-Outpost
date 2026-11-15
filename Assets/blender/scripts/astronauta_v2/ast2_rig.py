# Cria coleções, esqueleto de 15 ossos e objetos vazios do astronauta v2 (cópia Idle).
import bpy
from mathutils import Vector

parent_col = bpy.data.collections["GAL_Personagem_e_plantas"]
for a in ["Idle", "Walk", "Work", "Wave"]:
    cn = "GAL_astronauta2_" + a
    c = bpy.data.collections.get(cn) or bpy.data.collections.new(cn)
    if c.name not in [x.name for x in parent_col.children]:
        parent_col.children.link(c)

BONES = [("root", (0, 0, 0), (0, 0, 0.5), None, False, (0, -1, 0)),
         ("torso", (0, 0, 0.6), (0, 0, 1.12), "root", False, (0, -1, 0)),
         ("head", (0, 0, 1.14), (0, 0, 1.62), "torso", False, (0, -1, 0))]
for s, sx in (("L", -1), ("R", 1)):
    ax = sx * 0.43; lx = sx * 0.13
    BONES += [("arm_" + s, (ax, 0, 1.03), (ax, 0, 0.80), "torso", False, (0, 1, 0)),
              ("forearm_" + s, (ax, 0, 0.80), (ax, 0, 0.645), "arm_" + s, True, (0, 1, 0)),
              ("hand_" + s, (ax, 0, 0.645), (ax, 0, 0.44), "forearm_" + s, True, (0, 1, 0)),
              ("leg_" + s, (lx, 0, 0.6), (lx, 0, 0.37), "root", False, (0, 1, 0)),
              ("shin_" + s, (lx, 0, 0.37), (lx, 0, 0.13), "leg_" + s, True, (0, 1, 0)),
              ("foot_" + s, (lx, 0, 0.13), (lx, -0.17, 0.05), "shin_" + s, True, (0, 0, 1))]

col = bpy.data.collections["GAL_astronauta2_Idle"]
arm = bpy.data.armatures.new("astronaut2_rig")
root_e = bpy.data.objects.new("astronaut2_root", None); col.objects.link(root_e)
root_e.location = (600, -78, 0)
rig = bpy.data.objects.new("astronaut2_rig", arm); col.objects.link(rig); rig.parent = root_e
vl = bpy.context.view_layer
for o in vl.objects:
    o.select_set(False)
vl.objects.active = rig; rig.select_set(True)
win = bpy.context.window_manager.windows[0]
area = [a for a in win.screen.areas if a.type == 'VIEW_3D'][0]
region = [r for r in area.regions if r.type == 'WINDOW'][0]
with bpy.context.temp_override(window=win, area=area, region=region, active_object=rig, object=rig):
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    for name, h, t, p, con, rv in BONES:
        e = eb.new(name); e.head = h; e.tail = t; e.align_roll(Vector(rv))
        if p:
            e.parent = eb[p]; e.use_connect = con
    bpy.ops.object.mode_set(mode='OBJECT')
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
BN = [b.name for b in arm.bones]
for name in ["AST2_static", "AST2_color_suit", "AST2_color_helmet", "AST2_color_vest",
             "AST2_color_backpack", "AST2_color_gloves", "AST2_color_boots"]:
    o = bpy.data.objects.new(name, bpy.data.meshes.new(name + "_tmp")); col.objects.link(o)
    o.parent = rig
    for b in BN:
        o.vertex_groups.new(name=b)
    md = o.modifiers.new("Armature", 'ARMATURE'); md.object = rig
RESULT_RIG = {"bones": BN}
