# -*- coding: utf-8 -*-
"""壁の場面（② 動機 と ③ 止まった問題に戻る重さ）を Blender で 3D にする。

使い方（ヘッドレス）:
  blender -b -P wall_scene.py -- look  12,20,27,31,44,48,51,55,80   # 指定秒の静止画（見た目の確認）
  blender -b -P wall_scene.py -- render                              # 動きのあるコマだけ描画＋投影位置の書き出し

時刻はナレーションの文字ごとの時刻（remotion/src/data/captions.json）から引く。
手順の図そのものは描かず、紙のシートの四隅の画面上の位置を書き出して、Remotion 側で重ねる。
"""
import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
CAPTIONS = os.path.join(VIDEO, "remotion", "src", "data", "captions.json")
FONT = os.path.join(VIDEO, "assets", "fonts", "ZenMaruGothic-Bold.ttf")
OUT = os.path.join(VIDEO, "remotion", "public", "wall3d")
DATA = os.path.join(VIDEO, "remotion", "src", "data", "wall3d.json")
LOOK = os.path.join(VIDEO, "build", "wall_look")
FPS = 30
RES = (1600, 900)          # 描画の大きさ（Remotion で 1920×1080 に拡大して使う）
PROJ = (1920, 1080)        # 投影位置はこの大きさの座標で出す

# ---------------------------------------------------------------- 時刻
CAP = json.load(open(CAPTIONS, encoding="utf-8"))
LINES = {l["id"]: l for l in CAP["lines"]}


def S(i):
    return LINES[i]["start"]


def En(i):
    return LINES[i]["end"]


def at(i, phrase):
    l = LINES[i]
    k = l["text"].index(phrase)
    return l["chars"][k][0]


def F(sec):
    return int(round(sec * FPS))


# 場面の区間（Video.tsx と同じ）
MOTIVE = (14.9, 61.3)
HEAVY = (S("n21") - 0.3, S("n22") - 0.25)
T_WALL_UP = 15.0
T_ME = at("n6", "ADHD") - 0.3
T_BLAME = at("n7", "責める") - 0.2
T_WALK = S("n8")
T_DOOR = S("n8") - 0.6
T_SOLVED = at("n11", "解ける") - 0.2
T_WIDE = S("n13") - 0.3
T_CROWD = at("n13", "誰の日常") - 0.5
T_TALL = at("n14", "医療の中") - 0.3
T_ME2 = HEAVY[0] + 0.6
# 「医療の中でも、受けられる場所は限られている」：壁の手前（日常の側）にカメラを下ろし、扉の前に列ができる
T_D0 = T_TALL + 1.25
T_D1 = S("n14b") + 0.35
T_Q = at("n14b", "受けられる") - 0.3
QUEUE = [11, 3, 0, 1]                      # 列に並ぶ人（CROWD の番号）
QUEUE_AT = [(-0.75, -1.05), (-0.8, -1.85), (-0.72, -2.65), (-0.78, -3.45)]   # 壁に沿って、扉の前から並ぶ

# ---------------------------------------------------------------- 色
def hexrgb(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB → linear
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*c, a)


def mat(name, color, rough=0.8, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexrgb(color)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = hexrgb(emit)
        b.inputs["Emission Strength"].default_value = strength
    return m


def key(obj, path, frame, value, index=-1):
    if index >= 0:
        getattr(obj, path)[index] = value
        obj.keyframe_insert(path, index=index, frame=frame)
    else:
        setattr(obj, path, value)
        obj.keyframe_insert(path, frame=frame)


def pop_keys(obj, t0, base=1.0, axis_all=True):
    """バネで「ぽん」と出る（0 → 行き過ぎ → 1）"""
    for dt, v in ((-0.01, 0.0), (0.0, 0.001), (0.2, 1.12), (0.34, 0.96), (0.48, 1.0)):
        obj.scale = (base * max(v, 0.001),) * 3
        obj.keyframe_insert("scale", frame=F(t0 + dt) if dt >= 0 else F(t0) - 1)


# ---------------------------------------------------------------- 場面づくり
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.engine = "BLENDER_EEVEE"
    ee = sc.eevee
    ee.taa_render_samples = 16
    ee.use_gtao = True
    ee.gtao_distance = 1.2
    ee.gtao_factor = 1.2
    ee.use_soft_shadows = True
    ee.shadow_cube_size = "1024"
    ee.shadow_cascade_size = "2048"
    ee.use_bloom = True
    ee.bloom_threshold = 1.0
    ee.bloom_intensity = 0.04
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = -0.45
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 92

    # 空（環境光）
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = hexrgb("#EFE7DA")
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75

    # 太陽
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(52), math.radians(-18), math.radians(-38)))
    sun = bpy.context.object
    sun.data.energy = 2.4
    sun.data.color = (1.0, 0.95, 0.88)
    sun.data.angle = math.radians(6)

    # 地面：日常（左）と医療・支援の場（右）
    for name, x, col in (("日常", -30, "#E6DBC8"), ("医療", 30, "#D6E8E2")):
        bpy.ops.mesh.primitive_plane_add(size=60, location=(x, 10, 0))
        g = bpy.context.object
        g.name = "地面_" + name
        g.data.materials.append(mat("地面_" + name, col, 0.95))

    # 壁（底を原点にした箱。Z の拡大で高さが変わる）
    import bmesh
    me = bpy.data.meshes.new("壁")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.z += 0.5
    bm.to_mesh(me)
    bm.free()
    wall = bpy.data.objects.new("壁", me)
    sc.collection.objects.link(wall)
    wall.scale = (0.42, 70.0, 3.0)
    wall.location = (0, 12, 0)
    bev = wall.modifiers.new("角", "BEVEL")
    bev.width = 0.03
    bev.segments = 2
    # 扉の穴
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.05), scale=(1.0, 1.3, 2.1))
    cut1 = bpy.context.object
    bpy.ops.mesh.primitive_cylinder_add(radius=0.65, depth=1.0, location=(0, 0, 2.1), rotation=(0, math.radians(90), 0), vertices=48)
    cut2 = bpy.context.object
    for c in (cut1, cut2):
        c.hide_render = True
        c.hide_viewport = True
        b = wall.modifiers.new("扉の穴", "BOOLEAN")
        b.operation = "DIFFERENCE"
        b.object = c
    wall_mat = bpy.data.materials.new("レンガ")
    wall_mat.use_nodes = True
    nt = wall_mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.inputs["Color1"].default_value = hexrgb("#D3C6B1")
    brick.inputs["Color2"].default_value = hexrgb("#C6B8A1")
    brick.inputs["Mortar"].default_value = hexrgb("#AFA28D")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.035
    brick.inputs["Brick Width"].default_value = 0.6
    brick.inputs["Row Height"].default_value = 0.25
    brick.offset = 0.5
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(brick.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    wall.data.materials.append(wall_mat)

    # 壁が立つ → 「医療の中にしかない」で高くなる
    for t, h in ((MOTIVE[0], 0.001), (T_WALL_UP, 0.001), (T_WALL_UP + 0.55, 3.15), (T_WALL_UP + 0.8, 3.0),
                 (T_TALL, 3.0), (T_TALL + 0.9, 4.9), (T_TALL + 1.1, 4.8)):
        key(wall, "scale", F(t), h, index=2)
    key(wall, "scale", F(HEAVY[0]) - 1, 4.8, index=2)
    key(wall, "scale", F(HEAVY[0]), 3.3, index=2)

    # 扉（ちょうつがいで開く）と、内側からの光
    # 入口と同じアーチ形で少し大きく作り、壁の日常側の面に重ねて付ける（閉じても隙間がなく、開いても壁に食い込まない）
    bpy.ops.object.empty_add(location=(DOOR_X, DOOR_HALF, 0))
    hinge = bpy.context.object
    hinge.name = "ちょうつがい"
    door = make_door()
    door.parent = hinge
    for t, r in ((MOTIVE[0], 0), (T_DOOR, 0), (T_DOOR + 0.7, -104), (T_DOOR + 0.85, -100)):
        key(hinge, "rotation_euler", F(t), math.radians(r), index=2)
    for t, h in ((MOTIVE[0], 0.001), (T_WALL_UP, 0.001), (T_WALL_UP + 0.5, 1.0)):
        key(hinge, "scale", F(t), h, index=2)
    bpy.ops.object.light_add(type="POINT", location=(1.6, 0.0, 2.2))
    inner = bpy.context.object
    inner.name = "内側の光"
    inner.data.energy = 70
    inner.data.color = (0.86, 1.0, 0.95)
    inner.data.shadow_soft_size = 0.8

    # 床の文字
    font = bpy.data.fonts.load(FONT)
    for body, loc, size in (("日常", (-8.6, 0.6, 0.012), 1.5), ("医療・支援の場", (1.2, -2.2, 0.012), 1.2)):
        cu = bpy.data.curves.new(body, "FONT")
        cu.body = body
        cu.font = font
        cu.size = size
        cu.extrude = 0.006
        ob = bpy.data.objects.new("文字_" + body, cu)
        sc.collection.objects.link(ob)
        ob.location = loc
        ob.data.materials.append(mat("文字_" + body, "#7A7266", 0.9))

    # 紙のシート（イーゼル）
    paper_png = os.path.join(HERE, "paper.png")
    make_paper_png(paper_png)
    bpy.ops.mesh.primitive_plane_add(size=1, location=BOARD["center"], rotation=(math.radians(90), 0, 0), scale=(BOARD["w"], BOARD["h"], 1))
    board = bpy.context.object
    board.name = "紙"
    board.scale = (BOARD["w"], BOARD["h"], 1.0)
    pm = bpy.data.materials.new("紙")
    pm.use_nodes = True
    pnt = pm.node_tree
    tex = pnt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(paper_png)
    pnt.links.new(tex.outputs["Color"], pnt.nodes["Principled BSDF"].inputs["Base Color"])
    pnt.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    board.data.materials.append(pm)
    bx, by, bz = BOARD["center"]
    bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by + 0.03, bz), scale=(BOARD["w"] + 0.08, 0.05, BOARD["h"] + 0.08))
    backing = bpy.context.object
    backing.data.materials.append(mat("板", "#C9B79C", 0.8))
    for dx in (-0.9, 0.9):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=bz + 0.1, location=(bx + dx, by + 0.12, (bz + 0.1) / 2), rotation=(math.radians(-6), 0, 0))
        bpy.context.object.data.materials.append(mat("脚", "#8E6B4E", 0.7))

    # 人
    crowd_m = mat("人", "#A99E8C", 0.85)
    me_m = mat("私", "#5E584E", 0.8, emit="#3F8F8A", strength=0.0)
    me = person("私", ME_OUT, me_m)
    me.rotation_euler[2] = math.radians(-90)   # 扉（+X）の方を向く
    # 私：出てくる → 責める（少し沈む）→ 扉へ歩く → 色が変わる
    me.scale = (0.001,) * 3
    me.keyframe_insert("scale", frame=F(MOTIVE[0]))
    pop_keys(me, T_ME, 1.0)
    for t, sz in ((T_BLAME, 1.0), (T_BLAME + 0.5, 0.9), (T_WALK - 0.3, 0.9), (T_WALK + 0.2, 1.0)):
        key(me, "scale", F(t), sz, index=2)
    path = [(T_WALK, ME_OUT), (T_WALK + 0.8, (-0.1, 0.0)), (T_WALK + 1.5, ME_IN)]
    for i, (t, (x, y)) in enumerate(path):
        me.location = (x, y, 0)
        me.keyframe_insert("location", frame=F(t))
    # 歩くあいだの上下
    for k in range(10):
        t = T_WALK + k * 0.19
        me.location.z = 0.06 if k % 2 else 0.0
        me.keyframe_insert("location", index=2, frame=F(t))
    me.location.z = 0
    me.keyframe_insert("location", index=2, frame=F(T_WALK + 1.95))
    for t, r in ((T_WALK + 1.4, -90), (T_WALK + 2.0, -10)):
        key(me, "rotation_euler", F(t), math.radians(r), index=2)
    bsdf = me_m.node_tree.nodes["Principled BSDF"]
    for t, col, em in ((T_BLAME, "#5E584E", 0.0), (T_BLAME + 0.5, "#4A453E", 0.0), (T_WALK, "#5E584E", 0.0),
                       (T_SOLVED, "#5E584E", 0.0), (T_SOLVED + 0.7, "#2E7672", 1.4), (T_SOLVED + 1.4, "#2E7672", 0.6)):
        bsdf.inputs["Base Color"].default_value = hexrgb(col)
        bsdf.inputs["Base Color"].keyframe_insert("default_value", frame=F(t))
        bsdf.inputs["Emission Strength"].default_value = em
        bsdf.inputs["Emission Strength"].keyframe_insert("default_value", frame=F(t))
    vis_keys(me, [(MOTIVE[0], True), (HEAVY[0], False)])

    # 外にいるたくさんの人（「誰の日常にも使える」で出てくる）
    crowd = []
    for k, (x, y) in enumerate(CROWD):
        p = person(f"人{k}", (x, y), crowd_m)
        p.rotation_euler[2] = math.radians(-90 + (k * 37) % 60 - 30)
        p.scale = (0.001,) * 3
        p.keyframe_insert("scale", frame=F(MOTIVE[0]))
        pop_keys(p, T_CROWD + k * 0.05, 0.92)
        vis_keys(p, [(MOTIVE[0], True), (HEAVY[0], False)])
        if k in QUEUE:
            qi = QUEUE.index(k)
            t0 = T_Q + qi * 0.12
            p.location = (x, y, 0)
            p.keyframe_insert("location", frame=F(t0))
            p.location = (*QUEUE_AT[qi], 0)
            p.keyframe_insert("location", frame=F(t0 + 1.25))
            for j in range(7):
                p.location.z = 0.05 if j % 2 else 0.0
                p.keyframe_insert("location", index=2, frame=F(t0 + j * 0.18))
            p.location.z = 0
            p.keyframe_insert("location", index=2, frame=F(t0 + 1.3))
            key(p, "rotation_euler", F(t0), p.rotation_euler[2], index=2)
            key(p, "rotation_euler", F(t0 + 0.5), math.radians(-8 + 6 * qi), index=2)
        crowd.append(p)

    # ③：一人でいる私（紙のそば）
    me2_m = mat("私（一人）", "#5E584E", 0.8)
    me2 = person("私（一人）", ME_IN, me2_m)
    me2.rotation_euler[2] = math.radians(-10)
    vis_keys(me2, [(MOTIVE[0], False), (HEAVY[0], True)])
    me2.scale = (0.001,) * 3
    me2.keyframe_insert("scale", frame=F(HEAVY[0]))
    pop_keys(me2, T_ME2, 0.85)

    # カメラ
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    sc.camera = cam
    cam.data.lens = 35
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 5.6
    bpy.ops.object.empty_add(location=(0, 0, 1))
    target = bpy.context.object
    target.name = "注視点"
    tc = cam.constraints.new("TRACK_TO")
    tc.target = target
    tc.track_axis = "TRACK_NEGATIVE_Z"
    tc.up_axis = "UP_Y"
    for t, pos, look, focus in CAMERA:
        cam.location = pos
        cam.keyframe_insert("location", frame=F(t))
        target.location = look
        target.keyframe_insert("location", frame=F(t))
        cam.data.dof.focus_distance = focus
        cam.data.dof.keyframe_insert("focus_distance", frame=F(t))
    for ob in (cam, target):
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.easing = "AUTO"
    return sc, cam, me, board, crowd


BOARD = {"center": (3.2, 1.2, 1.62), "w": 2.8, "h": 1.43}
WALL_X = -0.235
NOTES = [  # (y の範囲, z の範囲)：日常の側から見て、左が y の大きい方
    ((4.6, 2.6), (0.9, 4.3)),       # 受けられる場所が限られる
    ((-1.5, -2.7), (2.0, 3.6)),     # 順番待ち（列の上）
]
ME_OUT = (-3.4, 0.2)
ME_IN = (0.95, 0.85)
CROWD = [(-4.6, -3.6), (-6.4, -1.0), (-8.2, -4.4), (-5.2, 2.6), (-6.6, 2.5), (-9.6, 0.8), (-3.8, -5.3), (-6.0, -6.4),
         (-8.8, -7.2), (-4.3, 3.1), (-10.6, -3.0), (-2.4, 3.4), (-7.0, 7.0), (-11.4, 4.6), (-4.1, 0.2), (-9.4, 9.4)]
CHIPS = [4, 9, 14, 6]   # 日常の困りごとを頭の上に出す人（Remotion 側と同じ番号）

# カメラ：（秒, 位置, 注視点, ピント距離）
POSE_A = ((-7.2, -6.6, 1.75), (-1.4, 0.6, 1.45), 6.8)           # 壁の外：私と扉
POSE_C = ((2.4, -3.7, 1.72), (2.75, 1.2, 1.5), 4.9)             # 紙のシートの正面（左手前に私）
POSE_W = ((-4.5, -9.5, 17.5), (1.0, 2.6, 0.0), 21.0)           # 上から：壁が世界を分けている
POSE_D = ((-11.0, -8.5, 3.4), (-2.0, 1.0, 1.8), 12.0)          # 日常の側から：高い壁と、扉の前の列
CAMERA = [
    (MOTIVE[0], *POSE_A),
    (T_WALK - 0.25, *POSE_A),
    (T_WALK + 1.0, (-3.6, -3.4, 3.6), (0.6, 0.4, 1.0), 5.0),
    (T_WALK + 1.9, (0.6, -3.6, 3.2), (2.6, 1.0, 1.3), 4.6),
    (T_WALK + 3.0, *POSE_C),
    (T_WIDE, *POSE_C),
    (T_WIDE + 1.8, *POSE_W),
    (T_D0, *POSE_W),
    (T_D1, *POSE_D),
    (MOTIVE[1], *POSE_D),
    (HEAVY[0] - 0.04, *POSE_D),
    (HEAVY[0], *POSE_C),
    (HEAVY[1], *POSE_C),
]


DOOR_X = -0.222        # 壁の日常側の面（x = -0.21）のすぐ外
DOOR_HALF = 0.71       # 入口（半幅 0.65）より少し大きく
DOOR_RECT = 2.1        # 四角の部分の高さ（入口と同じ）。上に半径 DOOR_HALF の半円
DOOR_T = 0.06


def make_door():
    """アーチ形の扉。ちょうつがいを原点に、y は 0 → -2*DOOR_HALF、厚みは x の -DOOR_T → 0"""
    import bmesh
    w = 2 * DOOR_HALF
    outline = [(0.0, 0.0), (-w, 0.0), (-w, DOOR_RECT)]
    for k in range(1, 24):
        a = math.pi - math.pi * k / 24
        outline.append((-DOOR_HALF + DOOR_HALF * math.cos(a), DOOR_RECT + DOOR_HALF * math.sin(a)))
    outline.append((0.0, DOOR_RECT))
    me = bpy.data.meshes.new("扉")
    bm = bmesh.new()
    verts = [bm.verts.new((0.0, y, z)) for y, z in outline]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.x -= DOOR_T
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    door = bpy.data.objects.new("扉", me)
    bpy.context.scene.collection.objects.link(door)
    bv = door.modifiers.new("角", "BEVEL")
    bv.width = 0.012
    bv.segments = 2
    door.data.materials.append(mat("扉", "#8E6B4E", 0.7))
    # 取っ手（日常の側）
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(-DOOR_T - 0.04, -w + 0.16, 1.05), segments=16, ring_count=8)
    knob = bpy.context.object
    knob.parent = door
    knob.data.materials.append(mat("取っ手", "#D9C38C", 0.35))
    return door


def vis_keys(root, keys):
    """root と子のメッシュの表示（hide_render）を時刻で切り替える"""
    for o in [root] + list(root.children):
        for t, shown in keys:
            o.hide_render = not shown
            o.keyframe_insert("hide_render", frame=F(t))


def person(name, xy, material):
    bpy.ops.object.empty_add(location=(xy[0], xy[1], 0))
    root = bpy.context.object
    root.name = name
    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.92, location=(0, 0, 0.56), vertices=32)
    body = bpy.context.object
    bv = body.modifiers.new("丸み", "BEVEL")
    bv.width = 0.16
    bv.segments = 6
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.19, location=(0, 0, 1.24), segments=32, ring_count=16)
    head = bpy.context.object
    bpy.ops.object.shade_smooth()
    for o in (body, head):
        o.parent = root
        o.data.materials.append(material)
    return root


def make_paper_png(path):
    """罫線の入った紙（Blender だけで描く）"""
    w, h = 1760, 900
    img = bpy.data.images.new("paper_tmp", w, h, alpha=False)
    base = hexrgb("#FFFDF8")
    line = hexrgb("#C9D4E2")
    px = [0.0] * (w * h * 4)
    for y in range(h):
        ry = h - 1 - y
        is_line = (ry % 92) in (90, 91) and 60 < ry < h - 40
        c = line if is_line else base
        row = list(c[:3]) + [1.0]
        o = y * w * 4
        px[o:o + w * 4] = row * w
    img.pixels = px
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


# ---------------------------------------------------------------- 書き出し
def project(sc, cam, pts):
    out = []
    for p in pts:
        v = world_to_camera_view(sc, cam, Vector(p))
        out.append([round(v.x * PROJ[0], 2), round((1 - v.y) * PROJ[1], 2), round(v.z, 3)])
    return out


def note_corners(n):
    (ya, yb), (z0, z1) = NOTES[n]
    return [(WALL_X, ya, z1), (WALL_X, yb, z1), (WALL_X, yb, z0), (WALL_X, ya, z0)]


def board_corners():
    x, y, z = BOARD["center"]
    hw, hh = BOARD["w"] / 2, BOARD["h"] / 2
    y -= 0.002
    return [(x - hw, y, z + hh), (x + hw, y, z + hh), (x + hw, y, z - hh), (x - hw, y, z - hh)]


def motion_windows():
    """3D の中で何かが動いている区間（秒）。ほかのコマは直前のコマを使う。"""
    return [
        (MOTIVE[0], T_WALL_UP + 0.9),
        (T_ME - 0.05, T_ME + 0.55),
        (T_BLAME - 0.05, T_BLAME + 0.6),
        (T_DOOR - 0.05, T_WALK + 3.05),
        (T_SOLVED - 0.05, T_SOLVED + 1.45),
        (T_WIDE - 0.05, T_WIDE + 1.85),
        (T_CROWD - 0.05, T_CROWD + 16 * 0.05 + 0.55),
        (T_TALL - 0.05, T_TALL + 1.15),
        (T_D0 - 0.05, T_D1 + 0.05),
        (T_Q - 0.05, T_Q + 0.12 * 3 + 1.35),
        (MOTIVE[1] - 0.02, MOTIVE[1]),
        (HEAVY[0], T_ME2 + 0.55),
        (HEAVY[1] - 0.02, HEAVY[1]),
    ]


def plan():
    frames = list(range(F(MOTIVE[0]), F(MOTIVE[1]) + 1)) + list(range(F(HEAVY[0]), F(HEAVY[1]) + 1))
    wins = [(F(a), F(b)) for a, b in motion_windows()]
    render_set = set()
    for f in frames:
        if any(a <= f <= b for a, b in wins):
            render_set.add(f)
    # 区間の頭は必ず描く
    render_set.add(F(MOTIVE[0]))
    render_set.add(F(HEAVY[0]))
    src = {}
    last = None
    for f in frames:
        if f in render_set:
            last = f
        src[f] = last
    return frames, sorted(render_set), src


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["look"]
    mode = args[0]
    sc, cam, me, board, crowd = build()
    if mode == "look":
        os.makedirs(LOOK, exist_ok=True)
        secs = [float(s) for s in (args[1].split(",") if len(args) > 1 else ["12", "20", "27", "31", "44", "48", "51", "55", "80"])]
        for s in secs:
            sc.frame_set(F(s))
            sc.render.filepath = os.path.join(LOOK, f"look_{s:06.2f}.jpg")
            bpy.ops.render.render(write_still=True)
            heads = [p.matrix_world @ Vector((0, 0, 1.45)) for p in crowd]
            print("LOOK", s, json.dumps({"crowd": [[round(v[0]), round(v[1])] for v in project(sc, cam, heads)],
                                          "notes": [[[round(v[0]), round(v[1])] for v in project(sc, cam, note_corners(n))] for n in range(len(NOTES))]}))
        return
    frames, render_list, src = plan()
    os.makedirs(OUT, exist_ok=True)
    # 描くコマの投影位置を求め、止まっているコマはそのコマの値を使う
    at_src = {}
    for f in render_list:
        sc.frame_set(f)
        head = me.matrix_world @ Vector((0, 0, 1.45))
        heads = [p.matrix_world @ Vector((0, 0, 1.45)) for p in crowd]
        at_src[f] = {"board": project(sc, cam, board_corners()), "head": project(sc, cam, [head])[0],
                     "crowd": project(sc, cam, heads), "notes": [project(sc, cam, note_corners(n)) for n in range(len(NOTES))]}
    proj = {f: {"src": src[f], **at_src[src[f]]} for f in frames}
    with open(os.path.join(OUT, "wall3d.json"), "w") as fp:
        json.dump({"fps": FPS, "res": RES, "proj": PROJ, "frames": proj}, fp)
    # Remotion が読む小さい版：コマ → 描いたコマ、描いたコマ → 紙の四隅と頭の位置（画面座標）
    compact = {
        "fps": FPS,
        "src": {str(f): src[f] for f in frames},
        "at": {str(f): {"board": [p[:2] for p in v["board"]], "head": v["head"][:2],
                        "crowd": [[round(p[0], 1), round(p[1], 1)] for p in v["crowd"]],
                        "notes": [[q[:2] for q in quad] for quad in v["notes"]]} for f, v in at_src.items()},
    }
    with open(DATA, "w") as fp:
        json.dump(compact, fp, separators=(",", ":"))
    print("PLAN", len(frames), "frames,", len(render_list), "to render")
    only = args[1] if len(args) > 1 else None
    done = 0
    for f in render_list:
        path = os.path.join(OUT, f"f{f:05d}.jpg")
        if only != "force" and os.path.exists(path):
            continue
        sc.frame_set(f)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        done += 1
        print("RENDERED", f, done, flush=True)


main()
