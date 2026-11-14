# Mars Outpost — utilitários para gerar peças low-poly no Blender, no mesmo padrão do kit modular
# (MarsOutpost_Modular.blend): grade de 4 m, origem no chão, materiais M_* compartilhados.
#
# Uso dentro do Blender (Scripting ou MCP):
#   exec(open(r"<repo>/assets-src/blender/lib_kit.py", encoding="utf8").read())
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

# Cores dos materiais NOVOS (os que já existem no arquivo são reaproveitados).
NEW_MATERIALS = {
    "M_Tecido_Azul": ((0.16, 0.27, 0.45), 0.9, 0.0, None),
    "M_Tecido_Cinza": ((0.42, 0.42, 0.44), 0.9, 0.0, None),
    "M_Almofada": ((0.86, 0.85, 0.82), 0.9, 0.0, None),
    "M_Tela": ((0.05, 0.35, 0.45), 0.3, 0.0, ((0.25, 0.85, 1.0), 2.5)),
    "M_Tela_Verde": ((0.05, 0.4, 0.15), 0.3, 0.0, ((0.3, 1.0, 0.45), 2.0)),
    "M_Tela_Laranja": ((0.45, 0.2, 0.05), 0.3, 0.0, ((1.0, 0.55, 0.15), 2.0)),
    "M_Vidro_Lab": ((0.6, 0.85, 0.95), 0.05, 0.0, None),
    "M_Liquido_Verde": ((0.2, 0.8, 0.35), 0.2, 0.0, ((0.2, 0.9, 0.4), 0.6)),
    "M_Liquido_Azul": ((0.2, 0.5, 0.95), 0.2, 0.0, ((0.25, 0.55, 1.0), 0.6)),
    "M_Substrato": ((0.24, 0.16, 0.1), 1.0, 0.0, None),
    "M_Folha": ((0.22, 0.55, 0.18), 0.7, 0.0, None),
    "M_Folha_Clara": ((0.45, 0.75, 0.25), 0.7, 0.0, None),
    "M_Folha_Seca": ((0.62, 0.6, 0.22), 0.8, 0.0, None),
    "M_Caule": ((0.35, 0.5, 0.2), 0.8, 0.0, None),
    "M_Batata": ((0.62, 0.45, 0.25), 0.9, 0.0, None),
    "M_Luz_Cultivo": ((0.7, 0.2, 0.8), 0.4, 0.0, ((0.95, 0.35, 1.0), 3.0)),
    "M_Borracha": ((0.05, 0.05, 0.05), 0.95, 0.0, None),
    "M_Aco": ((0.55, 0.57, 0.6), 0.35, 0.8, None),
    "M_Caixa_Carga": ((0.75, 0.62, 0.38), 0.8, 0.0, None),
}


def mat(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    color, rough, metal, emit = NEW_MATERIALS.get(name, ((0.8, 0.8, 0.8), 0.6, 0.0, None))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new(
            "ShaderNodeOutputMaterial"
        )
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if name == "M_Vidro_Lab":
        bsdf.inputs["Alpha"].default_value = 0.35
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "BLENDED"
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit[0], 1)
        bsdf.inputs["Emission Strength"].default_value = emit[1]
    m.diffuse_color = (*color, 1)
    return m


def collection(path):
    """Cria/obtém uma coleção aninhada: 'A/B/C'."""
    parent = bpy.context.scene.collection
    for name in path.split("/"):
        c = bpy.data.collections.get(name)
        if not c:
            c = bpy.data.collections.new(name)
            parent.children.link(c)
        elif name not in parent.children:
            try:
                parent.children.link(c)
            except RuntimeError:
                pass
        parent = c
    return parent


class Piece:
    """Acumula primitivas (caixas, cilindros, esferas) e gera UM objeto com vários materiais."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _tag(self, geom_verts, m):
        mi = self._mi(m)
        faces = {f for v in geom_verts for f in v.link_faces}
        for f in faces:
            f.material_index = mi
            f.smooth = False

    def box(self, size, center, m, rot_z=0.0):
        """size=(x,y,z), center=(x,y,z) do CENTRO da caixa."""
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        vs = res["verts"]
        mtx = (
            Matrix.Translation(Vector(center))
            @ Matrix.Rotation(rot_z, 4, "Z")
            @ Matrix.Diagonal((*size, 1))
        )
        bmesh.ops.transform(self.bm, matrix=mtx, verts=vs)
        self._tag(vs, m)
        return self

    def boxz(self, size, x, y, z0, m, rot_z=0.0):
        """Caixa apoiada em z0 (base), centrada em x,y."""
        return self.box(size, (x, y, z0 + size[2] / 2), m, rot_z)

    def cyl(self, r, h, x, y, z0, m, seg=8, r2=None, axis="Z"):
        res = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            segments=seg,
            radius1=r,
            radius2=r if r2 is None else r2,
            depth=h,
        )
        vs = res["verts"]
        rot = Matrix.Identity(4)
        if axis == "X":
            rot = Matrix.Rotation(math.pi / 2, 4, "Y")
        elif axis == "Y":
            rot = Matrix.Rotation(math.pi / 2, 4, "X")
        off = Vector((x, y, z0 + h / 2)) if axis == "Z" else Vector((x, y, z0))
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(off) @ rot, verts=vs)
        self._tag(vs, m)
        return self

    def sphere(self, r, x, y, z, m, sub=1, scale=(1, 1, 1)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r)
        vs = res["verts"]
        bmesh.ops.transform(
            self.bm,
            matrix=Matrix.Translation(Vector((x, y, z))) @ Matrix.Diagonal((*scale, 1)),
            verts=vs,
        )
        self._tag(vs, m)
        return self

    def build(self, name, coll, loc=(0, 0, 0), props=None):
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        me = bpy.data.meshes.get(name)
        if me:
            bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        ob.location = loc
        coll.objects.link(ob)
        for k, v in (props or {}).items():
            ob[k] = v
        return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
