# Biblioteca comum para o astronauta v2 (executada dentro do Blender)
import bpy, bmesh, math
from mathutils import Vector, Matrix

# ordem dos grupos de vértices = ordem já usada nos objetos (não a ordem hierárquica dos ossos)
BN = [b.name for b in bpy.data.armatures["astronaut2_rig"].bones]   # ordem canônica (hierárquica)


def mat(name, rgb, rough=0.6, metal=0.0, emit=None, st=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    b = [x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'][0]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = st
    return m


WHITE = (0.85, 0.86, 0.88)
ORANGE = (0.93, 0.33, 0.04)
MAT = {
    # um material por peça tingível (o jogo troca a cor do material inteiro)
    "helmet": mat("AST2_Capacete", WHITE, 0.45),
    "suit": mat("AST2_Traje", WHITE, 0.6),
    "vest": mat("AST2_Colete", ORANGE, 0.5),
    "gloves": mat("AST2_Luvas", (0.06, 0.06, 0.065), 0.7),
    "boots": mat("AST2_Botas", WHITE, 0.6),
    "backpack": mat("AST2_Mochila", ORANGE, 0.5),
    # fixos
    "black": mat("AST2_Preto", (0.035, 0.035, 0.04), 0.7),
    "panel": mat("AST2_Painel", (0.03, 0.032, 0.038), 0.45),
    "metal": mat("AST2_Metal", (0.42, 0.44, 0.47), 0.35, 0.6),
    "visor": mat("AST2_Visor", (0.006, 0.008, 0.02), 0.05, 0.0),
    "blue": mat("AST2_Azul", (0.30, 0.60, 0.80), 0.45, 0, (0.2, 0.5, 0.75), 0.6),
    "light": mat("AST2_Luz", (0.95, 0.95, 0.9), 0.3, 0, (1, 1, 0.95), 3.0),
    "orange_fixed": mat("AST2_LaranjaFixo", ORANGE, 0.5),
}


class Part:
    def __init__(s, slots):
        s.bm = bmesh.new(); s.dl = s.bm.verts.layers.deform.verify(); s.slots = slots

    def _st(s):
        return set(s.bm.verts), set(s.bm.faces)

    def _tag(s, bv, bf, g, m):
        gi = BN.index(g); mi = s.slots.index(m)
        for v in set(s.bm.verts) - bv:
            v[s.dl][gi] = 1.0
        for f in set(s.bm.faces) - bf:
            f.material_index = mi

    def _round(s, verts, r, seg, min_angle=0.5):
        ed = [e for e in {e for v in verts for e in v.link_edges}
              if len(e.link_faces) == 2 and e.calc_face_angle(0) > min_angle]
        if ed and r > 0:
            bmesh.ops.bevel(s.bm, geom=ed, offset=r, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)

    def box(s, c, sz, g, m, r=0.0, seg=1, rot=None):
        bv, bf = s._st()
        res = bmesh.ops.create_cube(s.bm, size=1.0)
        R = rot.to_4x4() if rot else Matrix.Identity(4)
        bmesh.ops.transform(s.bm, matrix=Matrix.Translation(c) @ R @ Matrix.Diagonal((*sz, 1)), verts=res['verts'])
        s._round(res['verts'], r, seg)
        s._tag(bv, bf, g, m)

    def cyl(s, c, r1, r2, h, g, m, axis='Z', seg=16, r=0.0, rseg=2, rot=None):
        bv, bf = s._st()
        A = {'Z': Matrix.Identity(4), 'X': Matrix.Rotation(math.radians(90), 4, 'Y'),
             'Y': Matrix.Rotation(math.radians(90), 4, 'X')}[axis]
        R = rot.to_4x4() if rot else Matrix.Identity(4)
        res = bmesh.ops.create_cone(s.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2,
                                    depth=h, matrix=Matrix.Translation(c) @ R @ A)
        s._round(res['verts'], r, rseg)
        s._tag(bv, bf, g, m)

    def sphere(s, c, sc, g, m, us=24, vs=14):
        bv, bf = s._st()
        bmesh.ops.create_uvsphere(s.bm, u_segments=us, v_segments=vs, radius=1.0,
                                  matrix=Matrix.Translation(c) @ Matrix.Diagonal((*sc, 1)))
        s._tag(bv, bf, g, m)

    def tube(s, pts, r, g, m, seg=6):
        bv, bf = s._st(); pts = [Vector(p) for p in pts]; n = len(pts); rings = []; prev = None
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            a = (prev - d * prev.dot(d)).normalized() if prev else d.orthogonal().normalized()
            prev = a; b = d.cross(a)
            rings.append([s.bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r)
                          for k in range(seg)])
        for i in range(n - 1):
            for k in range(seg):
                j = (k + 1) % seg
                s.bm.faces.new((rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]))
        s.bm.faces.new(rings[-1]); s.bm.faces.new(list(reversed(rings[0])))
        s._tag(bv, bf, g, m)

    def to_mesh(s, name, smooth_angle=40):
        me = bpy.data.meshes.new(name)
        # Blender 5: grupos vivem na malha; precisam existir ANTES de gravar os pesos do bmesh
        tmp = bpy.data.objects.new("_tmp_vg", me)
        for b in BN:
            tmp.vertex_groups.new(name=b)
        s.bm.to_mesh(me); s.bm.free()
        bpy.data.objects.remove(tmp)
        for k in s.slots:
            me.materials.append(MAT[k])
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
        return me


def ell_point(ell, x, z, off):
    (ex, ey, ez), (ax, ay, az) = ell
    t = 1 - ((x - ex) / ax) ** 2 - ((z - ez) / az) ** 2
    return Vector((x, ey - ay * math.sqrt(max(t, 0.0)) - off, z))


def attach(obj, rig, bone=None):
    """Liga um objeto ao rig: por grupo de vértices (modificador) ou parent de osso."""
    obj.parent = rig
    if bone:
        obj.parent_type = 'BONE'; obj.parent_bone = bone
        pb = rig.data.bones[bone]
        # compensa: filho de osso fica na ponta (tail) do osso
        obj.matrix_parent_inverse = (rig.matrix_world @ Matrix.Translation(pb.tail_local) @ pb.matrix_local.to_3x3().to_4x4()).inverted() @ rig.matrix_world
    else:
        for b in BN:
            if b not in obj.vertex_groups:
                obj.vertex_groups.new(name=b)
        if not any(md.type == 'ARMATURE' for md in obj.modifiers):
            md = obj.modifiers.new("Armature", 'ARMATURE'); md.object = rig
