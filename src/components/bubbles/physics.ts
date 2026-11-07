import Matter from 'matter-js'
import { BOTTOM_INSET, CORE, INSET, TOP_INSET, type BubblePhysics, type BubbleSim, type Sim } from './sim'

const { Engine, Bodies, Body, Composite, Events } = Matter

/** 当たり判定の分類：泡どうし・泡と壁 */
const BUBBLE = 0x1
const WALL = 0x2
/** 壁の厚さ（速くぶつかっても突き抜けないように厚く） */
const WALL_T = 400
/** matter の速さは「1/60 秒あたりの px」。px/秒 との換算 */
const PER_SEC = 60

type Mode = 'float' | 'enter' | 'grab' | 'held' | 'fling' | 'off'

const modeOf = (s: Sim): Mode =>
  s.state === 'float' || s.state === 'enter' || s.state === 'grab' || s.state === 'held' || s.state === 'fling' ? s.state : 'off'

interface Entry {
  sim: Sim
  body: Matter.Body
  mode: Mode
  /** ふだんの重さ（大きい泡ほど重い） */
  mass: number
}

/**
 * 泡どうしのぶつかり合い（matter.js、重力なしの2D）。
 * - 漂う泡：ゆっくり流れる向きへ、やわらかく速さを戻す。ぶつかると押し合い、相手から離れる向きへ進み直す
 * - 入ってくる泡：端の壁を通り抜けて入ってくる（ほかの泡とは押し合う）
 * - 持っている泡：指に付いていき（帯の中だけ）、重くなって、ほかの泡を押しのける。離すと、その勢いのまま流れていく
 * - 止めた泡：動かない。ほかの泡はぶつかってはね返る
 * - 飛ばした泡：途中の泡にぶつかると、はじき飛ばす
 * 浮き上がる・はじける・消える泡は、ぶつからない（ほかの泡の手前を通る）
 */
export class MatterPhysics implements BubblePhysics {
  private engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, positionIterations: 8, velocityIterations: 6 })
  private entries = new Map<Sim, Entry>()
  private byBody = new Map<number, Entry>()
  private walls: Matter.Body[] = []
  private bounds = ''

  constructor(private sim: BubbleSim) {
    Events.on(this.engine, 'collisionStart', this.onStart)
  }

  dispose() {
    Events.off(this.engine, 'collisionStart', this.onStart)
    Composite.clear(this.engine.world, false)
    Engine.clear(this.engine)
    this.entries.clear()
    this.byBody.clear()
  }

  step(dt: number) {
    this.fitWalls()
    this.reconcile()
    // 1 回の計算は 1/60 秒以下に刻む（ヒットストップ中は、とても短い時間だけ進む）
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6))
    const h = dt / n
    for (let i = 0; i < n; i++) {
      this.steer(h)
      Engine.update(this.engine, h * 1000)
    }
    for (const e of this.entries.values()) {
      const v = Body.getVelocity(e.body)
      e.sim.x = e.body.position.x
      e.sim.y = e.body.position.y
      e.sim.vx = v.x * PER_SEC
      e.sim.vy = v.y * PER_SEC
    }
  }

  /** 漂う範囲（左右の端・帯の上下）に壁を立てる。大きさが変わったら立て直す */
  private fitWalls() {
    const { w, h, top } = this.sim
    const key = `${w}|${h}|${top}`
    if (key === this.bounds) return
    this.bounds = key
    if (this.walls.length) Composite.remove(this.engine.world, this.walls)
    const opts = { isStatic: true, restitution: 0.5, friction: 0, frictionStatic: 0, collisionFilter: { category: WALL, mask: BUBBLE } }
    const cy = (top + h) / 2
    const ch = h - top + WALL_T * 2
    this.walls = [
      Bodies.rectangle(INSET - WALL_T / 2, cy, WALL_T, ch, opts),
      Bodies.rectangle(w - INSET + WALL_T / 2, cy, WALL_T, ch, opts),
      Bodies.rectangle(w / 2, top + TOP_INSET - WALL_T / 2, w + WALL_T * 2, WALL_T, opts),
      Bodies.rectangle(w / 2, h - BOTTOM_INSET + WALL_T / 2, w + WALL_T * 2, WALL_T, opts),
    ]
    Composite.add(this.engine.world, this.walls)
  }

  /** 泡の状態に合わせて、体を足す・外す・性質を切り替える */
  private reconcile() {
    const alive = new Set(this.sim.sims)
    for (const e of [...this.entries.values()]) {
      if (!alive.has(e.sim) || modeOf(e.sim) === 'off') this.remove(e)
    }
    for (const s of this.sim.sims) {
      const mode = modeOf(s)
      if (mode === 'off') continue
      let e = this.entries.get(s)
      if (!e) {
        const body = Bodies.circle(s.x, s.y, s.r * CORE, { friction: 0, frictionStatic: 0, frictionAir: 0, slop: 0.5 }, 32)
        Body.setInertia(body, Infinity)
        Body.setVelocity(body, { x: s.vx / PER_SEC, y: s.vy / PER_SEC })
        e = { sim: s, body, mode: 'off', mass: body.mass }
        this.entries.set(s, e)
        this.byBody.set(body.id, e)
        Composite.add(this.engine.world, body)
      }
      if (e.mode !== mode) this.apply(e, mode)
    }
  }

  private apply(e: Entry, mode: Mode) {
    const { body, sim: s } = e
    if (body.isStatic && mode !== 'held') Body.setStatic(body, false)
    const filter = body.collisionFilter
    filter.category = BUBBLE
    switch (mode) {
      case 'float':
        filter.mask = BUBBLE | WALL
        Body.setMass(body, e.mass)
        body.restitution = 0.6
        // 指から離した泡は、指の速さで投げ出す
        if (s.toss) {
          Body.setVelocity(body, { x: s.toss.vx / PER_SEC, y: s.toss.vy / PER_SEC })
          s.toss = undefined
        }
        break
      case 'enter':
        filter.mask = BUBBLE
        Body.setMass(body, e.mass * 1.5)
        body.restitution = 0.6
        break
      case 'grab':
        // 指で押さえた泡は重く、ほかの泡に押し返されない
        filter.mask = BUBBLE
        Body.setMass(body, e.mass * 6)
        break
      case 'held':
        filter.mask = BUBBLE
        Body.setVelocity(body, { x: 0, y: 0 })
        Body.setStatic(body, true)
        break
      case 'fling':
        filter.mask = BUBBLE
        Body.setMass(body, e.mass * 2.5)
        body.restitution = 0.85
        Body.setVelocity(body, { x: s.vx / PER_SEC, y: s.vy / PER_SEC })
        break
    }
    e.mode = mode
  }

  private remove(e: Entry) {
    Composite.remove(this.engine.world, e.body)
    this.entries.delete(e.sim)
    this.byBody.delete(e.body.id)
  }

  /** 状態ごとの「行きたい速さ」へ寄せる（ぶつかった直後は、ゆっくり元の流れに戻る） */
  private steer(h: number) {
    const time = this.sim.time
    for (const e of this.entries.values()) {
      const { body, sim: s, mode } = e
      if (mode === 'held' || mode === 'fling') continue
      const v = Body.getVelocity(body)
      let vx = v.x * PER_SEC
      let vy = v.y * PER_SEC
      if (mode === 'grab') {
        vx = (s.gx - body.position.x) * 25
        vy = (s.gy - body.position.y) * 25
        // ほかの泡に押しつけている時に、速さだけが際限なくふくらまないように
        const sp = Math.hypot(vx, vy)
        if (sp > 1500) {
          vx *= 1500 / sp
          vy *= 1500 / sp
        }
      } else {
        const enter = mode === 'enter'
        // ゆらゆら：縦にゆっくり上下する
        const bob = 4.8 * Math.cos(time * 0.8 + s.phase)
        const tx = enter ? Math.sign(s.drift) * Math.max(170, Math.abs(s.drift) * 6) : s.drift
        const ty = enter ? Math.max(-60, Math.min(60, (s.baseY - body.position.y) * 3)) + bob : s.lift + bob
        const f = 1 - Math.exp(-(enter ? 8 : 1.6) * h)
        vx += (tx - vx) * f
        vy += (ty - vy) * f
        const sp = Math.hypot(vx, vy)
        if (sp > 700) {
          vx *= 700 / sp
          vy *= 700 / sp
        }
      }
      Body.setVelocity(body, { x: vx / PER_SEC, y: vy / PER_SEC })
    }
  }

  /** ぶつかった瞬間（押し返す計算の前）：近づく速さを測って、両方の泡に伝える */
  private onStart = (ev: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of ev.pairs) {
      const a = this.byBody.get(pair.bodyA.id)
      const b = this.byBody.get(pair.bodyB.id)
      if (!a && !b) continue
      // 泡どうしは中心を結ぶ向き、壁とは当たった面の向き（どちらも A → B）
      let nx: number
      let ny: number
      if (a && b) {
        const dx = pair.bodyB.position.x - pair.bodyA.position.x
        const dy = pair.bodyB.position.y - pair.bodyA.position.y
        const d = Math.hypot(dx, dy) || 1
        nx = dx / d
        ny = dy / d
      } else {
        nx = pair.collision.normal.x
        ny = pair.collision.normal.y
        const dx = pair.bodyB.position.x - pair.bodyA.position.x
        const dy = pair.bodyB.position.y - pair.bodyA.position.y
        if (nx * dx + ny * dy < 0) {
          nx = -nx
          ny = -ny
        }
      }
      const va = a && !pair.bodyA.isStatic ? Body.getVelocity(pair.bodyA) : { x: 0, y: 0 }
      const vb = b && !pair.bodyB.isStatic ? Body.getVelocity(pair.bodyB) : { x: 0, y: 0 }
      const closing = Math.max(0, ((va.x - vb.x) * nx + (va.y - vb.y) * ny) * PER_SEC)
      if (a) this.sim.impact(a.sim, nx, ny, closing)
      if (b) this.sim.impact(b.sim, -nx, -ny, closing)
    }
  }
}
