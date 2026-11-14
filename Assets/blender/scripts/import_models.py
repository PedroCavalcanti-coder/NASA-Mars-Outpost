"""Optional editable Blender source files from the uncompressed original GLBs.
Run from the repo: blender --background --python assets-src/blender/import_models.py
The procedural authoring source is scripts/art/model-library.mjs (no Blender required to rebuild).
"""
from pathlib import Path
import bpy

root = Path(__file__).resolve().parents[2]
for model in sorted((root / 'assets-src/models-raw').glob('*.glb')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model))
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    bpy.ops.wm.save_as_mainfile(filepath=str(root / 'assets-src/blender' / f'{model.stem}.blend'))
