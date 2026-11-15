# Exporta o astronauta v2 para Assets/modelos/astronaut_v2.glb com os nomes que o jogo espera.
# Renomeia temporariamente (e desfaz no final) os objetos do modelo antigo que têm os mesmos nomes.
import bpy, os, shutil

REPO = r"C:\Users\Dev_RV01\Documents\Github\NASA-Mars-Outpost"
OUT = os.path.join(REPO, "Assets", "modelos", "astronaut_v2.glb")
CLIPS = {"Idle": "AST2_Idle", "Walk": "AST2_Walk", "Work": "AST2_Work", "Wave": "AST2_Wave"}
for a in bpy.data.actions:
    if a.name.startswith(("Emote_", "Duo_")):
        CLIPS[a.name] = a.name
RENAME = {"astronaut2_root": "astronaut_root", "astronaut2_rig": "astronaut_rig",
          "AST2_color_helmet": "color_helmet", "AST2_color_suit": "color_suit", "AST2_color_vest": "color_vest",
          "AST2_color_gloves": "color_gloves", "AST2_color_boots": "color_boots", "AST2_color_backpack": "color_backpack",
          "AST2_static": "static_body", "AST2_face": "face"}
ACC = ["acc_lanterna_capacete", "acc_antena_parabolica", "acc_tanques_oxigenio", "acc_joelheiras", "acc_bolsas_cinto",
       "acc_cracha", "acc_luzes_ombro", "acc_emblema_ombro", "acc_emblema_peito", "acc_emblema_capacete", "acc_emblema_mochila"]

rig = bpy.data.objects["astronaut2_rig"]
undo_names = []      # (datablock, nome original)
temp_objs = []
saved_action = rig.animation_data.action
saved_slot = rig.animation_data.action_slot


def rename(idb, new):
    clash = type(idb).__name__
    coll = bpy.data.objects if isinstance(idb, bpy.types.Object) else (
        bpy.data.materials if isinstance(idb, bpy.types.Material) else bpy.data.actions)
    other = coll.get(new)
    if other is not None and other != idb:
        undo_names.append((other, other.name)); other.name = new + "__tmp_export"
    undo_names.append((idb, idb.name)); idb.name = new


try:
    # acessórios: cópias presas ao rig principal (os originais estão no boneco de vitrine)
    for n in ACC:
        src = bpy.data.objects[n]
        undo_names.append((src, src.name)); src.name = n + "__src"
        o = bpy.data.objects.new(n, src.data)
        bpy.data.collections["GAL_astronauta2_Idle"].objects.link(o); o.parent = rig
        md = o.modifiers.new("Armature", 'ARMATURE'); md.object = rig
        temp_objs.append(o)
    for old, new in RENAME.items():
        rename(bpy.data.objects[old], new)
    rename(bpy.data.materials["M_Rosto_LED"], "M_Rosto")
    # clipes como trilhas NLA (nome da trilha = nome do clipe no GLB)
    ad = rig.animation_data
    ad.action = None
    for clip, act_name in CLIPS.items():
        tr = ad.nla_tracks.new(); tr.name = clip
        st = tr.strips.new(clip, int(bpy.data.actions[act_name].frame_range[0]), bpy.data.actions[act_name])
        try:
            st.action_slot = bpy.data.actions[act_name].slots[0]
        except Exception:
            pass
        tr.mute = False
    # seleção
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    sel = [bpy.data.objects["astronaut_root"], rig] + [bpy.data.objects[v] for k, v in RENAME.items() if v.startswith(("color_", "static", "face"))] + temp_objs
    for o in sel:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    root = bpy.data.objects["astronaut_root"]; saved_loc = root.location.copy(); root.location = (0, 0, 0)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animation_mode='NLA_TRACKS',
                              export_skins=True, export_def_bones=False, export_force_sampling=True, export_yup=True,
                              export_apply=False, export_materials='EXPORT', export_image_format='AUTO')
    root.location = saved_loc
finally:
    ad = rig.animation_data
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    ad.action = saved_action
    try:
        ad.action_slot = saved_slot
    except Exception:
        pass
    for o in temp_objs:
        bpy.data.objects.remove(o)
    for idb, name in reversed(undo_names):
        idb.name = name

# texturas trocáveis numa pasta pública (/assets/modelos/astronauta_v2/...)
src = os.path.join(REPO, "Assets", "texturas", "jogo", "astronauta_v2")
dst = os.path.join(REPO, "Assets", "modelos", "astronauta_v2")
os.makedirs(os.path.join(dst, "cores"), exist_ok=True)
for f in os.listdir(os.path.join(src, "cores")):
    shutil.copy2(os.path.join(src, "cores", f), os.path.join(dst, "cores", f))
for f in ("emblemas.png", "rostos_led.png"):
    shutil.copy2(os.path.join(src, f), os.path.join(dst, f))
RESULT_EXPORT = {"glb": OUT, "kb": round(os.path.getsize(OUT) / 1024), "clips": list(CLIPS)}
