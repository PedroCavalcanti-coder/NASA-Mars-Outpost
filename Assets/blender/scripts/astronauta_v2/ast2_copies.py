# Cópias Walk/Work/Wave (malhas compartilhadas) + animações antigas copiadas para o rig novo.
import bpy

SRC = {"Idle": "Idle", "Walk": "Walk.001", "Work": "Work.002", "Wave": "Wave.003"}
OFF = {"Idle": 0, "Walk": 6, "Work": 12, "Wave": 18}
master_rig = bpy.data.objects["astronaut2_rig"]; master_root = bpy.data.objects["astronaut2_root"]
meshes = [o for o in bpy.data.collections["GAL_astronauta2_Idle"].objects if o.type == 'MESH']
log = {}
for anim, src in SRC.items():
    col = bpy.data.collections["GAL_astronauta2_" + anim]
    if anim == "Idle":
        root, rig = master_root, master_rig
    else:
        root = bpy.data.objects.new("astronaut2_root_" + anim, None); col.objects.link(root)
        rig = bpy.data.objects.new("astronaut2_rig_" + anim, master_rig.data); col.objects.link(rig)
        rig.parent = root
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
        for m in meshes:
            o = bpy.data.objects.new(m.name + "_" + anim, m.data); col.objects.link(o); o.parent = rig
            for vg in m.vertex_groups:
                o.vertex_groups.new(name=vg.name)
            md = o.modifiers.new("Armature", 'ARMATURE'); md.object = rig
    root.location = (600 + OFF[anim], -78, 0)
    act = old = bpy.data.actions[src].copy()
    act.name = "AST2_" + anim; act.use_fake_user = True
    ad = rig.animation_data_create(); ad.action = act
    try:
        ad.action_slot = act.slots[0]
    except Exception as e:
        log["slot_err_" + anim] = str(e)
    lbl_old = bpy.data.objects["LBL_" + anim]
    fd = lbl_old.data.copy(); fd.body = anim + " (novo)"
    lbl = bpy.data.objects.new("LBL2_" + anim, fd); col.objects.link(lbl)
    lbl.location = (600 + OFF[anim], -81, 0.05); lbl.rotation_euler = lbl_old.rotation_euler
    log[anim] = act.name
RESULT_COPIES = log
