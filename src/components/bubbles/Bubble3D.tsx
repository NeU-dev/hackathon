import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { MAX_SLOTS, type BubbleSim } from './sim'
import { MatterPhysics } from './physics'

/**
 * 紙の世界になじむシャボン玉：写真のようにはせず、挿し絵くらいの描きこみにする。
 * - 輪郭は、用紙の印刷と同じ緑の線
 * - 縁の内側に、くすませた膜の色（虹そのままではなく、アプリの緑と金に寄せる）がゆっくり流れる
 * - 左上にやわらかい光の窓と弧と点、右下に金の小さな照り返し、右下の内側を少し濃くして丸みを出す
 * 形の伸び縮み（ぷるぷる・はじける前のつぶれ）は、そのまま生きる。
 * 押し合っている泡は、重なった所を平らにつぶして、2つの泡のあいだに1本の膜の壁を描く。
 */
const BubbleMaterial = shaderMaterial(
  { uTime: 0, uAlpha: 0, uSeed: 0, uSolid: 0, uLineW: 1 },
  /* glsl */ `
    // 押し合う平面（xy：つぶす向き、z：平面の位置、w：角の丸み。w = 0 は使わない）
    uniform vec4 uPlanes[3];
    varying vec3 vN;
    // 平面までの距離（内側が +、px）
    varying float vWall;
    // なめらかな min（平らな面と球の境い目を丸くする）
    float smin(float a, float b, float k) {
      float h = max(k - abs(a - b), 0.0) / k;
      return min(a, b) - h * h * k * 0.25;
    }
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      for (int i = 0; i < 3; i++) {
        vec4 p = uPlanes[i];
        if (p.w > 0.0) {
          float d = dot(wp.xy, p.xy) - p.z;
          wp.xy -= p.xy * (d - smin(d, 0.0, p.w));
        }
      }
      vWall = 10000.0;
      for (int i = 0; i < 3; i++) {
        vec4 p = uPlanes[i];
        if (p.w > 0.0) vWall = min(vWall, p.z - dot(wp.xy, p.xy));
      }
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform float uAlpha;
    uniform float uSeed;
    uniform float uSolid;
    uniform float uLineW;
    varying vec3 vN;
    varying float vWall;
    // 用紙の色（index.css と同じ値）
    const vec3 LINE = vec3(0.31, 0.502, 0.459);   // 印刷の緑
    const vec3 PAPER = vec3(1.0, 0.996, 0.973);   // 紙
    const vec3 TINT = vec3(0.839, 0.918, 0.902);  // 緑をうすめた色
    const vec3 GOLD = vec3(0.91, 0.827, 0.635);   // 真鍮の金
    void main() {
      // 補間で短くなった法線は、フラグメントで正規化し直す
      vec3 n = normalize(vN);
      // 正面から見た時の、中心からの距離（0 = 中心、1 = 輪郭）と角度
      float rho = length(n.xy);
      float ang = atan(n.y, n.x);
      float aa = fwidth(rho) * 1.2;

      // 中：紙の色が透け、上から光が当たったような淡い濃淡
      float shade = 0.5 + 0.5 * n.y;
      vec3 col = mix(TINT, PAPER, shade);
      // 浮き上がる間は、中を紙の色で満たす
      col = mix(col, PAPER, uSolid * 0.6);
      float a = mix(0.2, 0.94, uSolid);

      // 縁の内側：膜の色が、角度と時間でゆっくり流れる。
      // 用紙と同じ2色刷りにして、緑をうすめた色と金のあいだだけを行き来する（虹の桃・紫は紙から浮くので出さない）
      float film = smoothstep(0.58, 0.95, rho);
      float h = ang * 0.159 + rho * 0.7 + uTime * 0.05 + uSeed + 0.1 * sin(n.y * 6.0 + uTime * 0.9);
      float k = 0.5 + 0.5 * cos(6.28318 * h);
      vec3 iri = mix(TINT, mix(GOLD, PAPER, 0.35), k);
      iri = mix(iri, LINE, 0.12 * (1.0 - k));
      col = mix(col, iri, film * 0.6);
      a = mix(a, 0.5, film);

      // 丸み：右下の内側を、印刷の緑でうっすら濃く
      float side = clamp(0.5 + 0.6 * n.x - 0.6 * n.y, 0.0, 1.0);
      col = mix(col, LINE, smoothstep(0.45, 0.95, rho) * side * 0.2);

      // 輪郭線
      float line = smoothstep(0.962 - aa, 0.962 + aa, rho);
      col = mix(col, LINE, line);
      a = mix(a, 0.95, line);
      // 押し合っている所の膜の壁。両方の泡が片側ずつ描いて、輪郭線より少しだけ太い1本になる
      float aw = fwidth(vWall);
      float wall = 1.0 - smoothstep(uLineW - aw, uLineW + aw, vWall);
      col = mix(col, LINE, wall);
      a = mix(a, 0.95, wall);

      // 光：左上にやわらかい窓、その外側に弧、少し離れて点
      vec2 w = (n.xy - vec2(-0.3, 0.38)) * vec2(1.0, 1.45);
      float win = (1.0 - smoothstep(0.1, 0.2, length(w))) * 0.8;
      float arcBand = smoothstep(0.78 - aa, 0.78 + aa, rho) * (1.0 - smoothstep(0.86 - aa, 0.86 + aa, rho));
      float arcSpan = smoothstep(1.95, 2.1, ang) * (1.0 - smoothstep(2.55, 2.7, ang));
      float dot1 = 1.0 - smoothstep(0.055 - aa, 0.055 + aa, length(n.xy - vec2(-0.6, 0.12)));
      float shine = max(max(win, arcBand * arcSpan), dot1);
      col = mix(col, vec3(1.0), shine);
      a = max(a, shine * 0.95);

      // 右下に、金の小さな照り返し
      float glint = 1.0 - smoothstep(0.05, 0.12, length((n.xy - vec2(0.5, -0.56)) * vec2(1.0, 1.8)));
      col = mix(col, mix(GOLD, PAPER, 0.25), glint * 0.85);
      a = max(a, glint * 0.7);

      gl_FragColor = vec4(col, a * uAlpha);
    }
  `,
)

export default function Bubble3D({ sim }: { sim: BubbleSim }) {
  // ぶつかり合いの計算は、3D の部品といっしょに読み込む
  useLayoutEffect(() => {
    const physics = new MatterPhysics(sim)
    sim.physics = physics
    return () => {
      physics.dispose()
      if (sim.physics === physics) sim.physics = undefined
    }
  }, [sim])
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 300], zoom: 1, near: 0.1, far: 1000 }}
      // 画面の高さいっぱいに描くので、解像度は少しおさえる（スマホで重くならないように）
      dpr={[1, 1.75]}
      // 大きさは変形（作業画面が開く時の拡大）の影響を受けない測り方で。
      // 開く途中に測ると、描く面だけ小さいまま残り、泡の絵が文字からずれて端で切れる
      resize={{ offsetSize: true }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      <Driver sim={sim} />
    </Canvas>
  )
}

function Driver({ sim }: { sim: BubbleSim }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const mats = useMemo(
    () =>
      Array.from({ length: MAX_SLOTS }, (_, i) => {
        const m = new BubbleMaterial() as THREE.ShaderMaterial
        m.transparent = true
        m.depthWrite = false
        m.uniforms.uSeed.value = i * 0.37
        // 配列の値は材質どうしで共有されてしまうので、1つずつ持たせる
        m.uniforms.uPlanes = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }
        return m
      }),
    [],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1, 40, 28), [])

  useFrame((_, dt) => {
    sim.step(Math.min(dt, 0.05))
    sim.applyDom()
    for (let i = 0; i < MAX_SLOTS; i++) {
      const mesh = meshes.current[i]
      if (!mesh) continue
      const s = sim.bySlot(i)
      if (!s) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.set(s.x - sim.w / 2, sim.h / 2 - s.y, 0)
      // ぷるぷる・伸び縮み（進む向きに伸びる、はじける前につぶれる）
      const d = sim.deform(s)
      const rr = s.r * s.scale
      mesh.scale.set(rr * d.sx, rr * d.sy, rr)
      mesh.rotation.z = d.rot
      const u = mats[i].uniforms
      u.uAlpha.value = s.alpha
      u.uSolid.value = s.solid
      u.uTime.value = sim.time
      // 2つの泡がそれぞれ描いて1本になる。合わせると輪郭線（半径の 3.8%）より少しだけ太く（細いと、そこだけ膜が切れて見える）
      u.uLineW.value = rr * 0.024
      const planes = sim.pressPlanes(s)
      const slots = u.uPlanes.value as THREE.Vector4[]
      for (let j = 0; j < 3; j++) {
        const p = planes[j]
        if (p) slots[j].set(p.nx, p.ny, p.c, p.k)
        else slots[j].set(0, 0, 0, 0)
      }
    }
  })

  return (
    <>
      {mats.map((m, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          geometry={geo}
          material={m}
          visible={false}
        />
      ))}
    </>
  )
}
