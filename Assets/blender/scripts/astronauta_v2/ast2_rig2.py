# Braços mais perto do peito + ossos de dedos (polegar, indicador, demais dedos) para gestos.
import bpy
from mathutils import Vector

arm = bpy.data.armatures["astronaut2_rig"]
rig = bpy.data.objects["astronaut2_rig"]
AX = 0.39
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
    for s, sx in (("L", -1), ("R", 1)):
        ax = sx * AX
        a = eb["arm_" + s]; f = eb["forearm_" + s]; h = eb["hand_" + s]
        a.head = (ax, 0, 1.03); a.tail = (ax, 0, 0.80); a.align_roll(Vector((0, 1, 0)))
        f.head = (ax, 0, 0.80); f.tail = (ax, 0, 0.645); f.align_roll(Vector((0, 1, 0)))
        h.head = (ax, 0, 0.645); h.tail = (ax, 0, 0.53); h.align_roll(Vector((0, 1, 0)))
        for name, hd, tl, roll in (("thumb_" + s, (ax - sx * 0.03, -0.06, 0.6), (ax - sx * 0.035, -0.115, 0.53), (-sx, 0, 0)),
                                   ("index_" + s, (ax, -0.052, 0.545), (ax, -0.052, 0.435), (0, 1, 0)),
                                   ("fingers_" + s, (ax, 0.025, 0.545), (ax, 0.025, 0.43), (0, 1, 0))):
            e = eb.get(name) or eb.new(name)
            e.head = hd; e.tail = tl; e.align_roll(Vector(roll)); e.parent = h; e.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
for r in [o for o in bpy.data.objects if o.type == 'ARMATURE' and o.data == arm]:
    for pb in r.pose.bones:
        pb.rotation_mode = 'QUATERNION'
BN = [b.name for b in arm.bones]
fixed = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object and m.object.data == arm for m in o.modifiers):
        for b in BN:
            if b not in o.vertex_groups:
                o.vertex_groups.new(name=b); fixed += 1
RESULT_RIG2 = {"bones": BN, "groups_added": fixed}
