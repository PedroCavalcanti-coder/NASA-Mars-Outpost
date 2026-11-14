# Mars Outpost — gera tudo no arquivo aberto (MarsOutpost_Modular.blend):
#   40_MOVEIS, 41_PLANTAS, INST_Garagem e as 8 bases em 50_BASES; exporta GLB+JSON para o jogo.
# No Blender: Scripting > abrir este arquivo > Run Script (ou exec via MCP).
import os

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else BLENDER_DIR  # noqa: F821
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "apps", "web", "public", "assets", "bases")

g = globals()
for f in ("lib_kit.py", "moveis.py", "layouts.py", "bases.py"):
    exec(open(os.path.join(HERE, f), encoding="utf8").read(), g)


def build_all(export=True):
    report = {"catalog": build_catalog()}
    if "INST_Garagem" not in bpy.data.objects:  # noqa: F821
        build_garage()  # noqa: F821
    report["bases"] = {}
    for i, L in enumerate(LAYOUTS):  # noqa: F821
        root, ext = build_base(L, i)  # noqa: F821
        report["bases"][L.key] = len(root.children_recursive)
        if export:
            export_base(root, L, OUT, ext)  # noqa: F821
    return report
