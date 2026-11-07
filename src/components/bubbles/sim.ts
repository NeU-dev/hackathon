import { MAX_PHRASE_EM, emWidth, phrases } from '../Phrases'

export interface BubbleQ {
  id: string
  text: string
}

type BState = 'enter' | 'float' | 'grab' | 'held' | 'rise' | 'pop' | 'fling' | 'fade'

export interface Sim {
  id: string
  x: number
  y: number
  /** 入ってくる時に通る高さ */
  baseY: number
  /** 実際の速さ（px/秒）。漂う・掴む・飛ばす間は物理エンジンが書き戻す */
  vx: number
  vy: number
  /** 漂う時の横の速さ（向きつき）。ぶつかると、ぶつかった相手から離れる向きに変わる */
  drift: number
  /** 漂う時の縦の速さ（向きつき） */
  lift: number
  r: number
  phase: number
  state: BState
  t: number
  /** ばねでゆれる大きさ（ぷるんとした感じ） */
  scale: number
  sv: number
  /** ぶつかった時のゆれ：つぶれる向き（メッシュの座標の角度）と、つぶれ具合のばね */
  ja: number
  jq: number
  jv: number
  alpha: number
  gx: number
  gy: number
  /** 見かけの速さ（形の伸び縮みに使う） */
  px: number
  py: number
  wvx: number
  wvy: number
  trailT: number
  /** rise：浮き上がる前の位置と、浮き上がる先 */
  rx0: number
  ry0: number
  rtx: number
  rty: number
  burst: boolean
  /** 中の不透明さ（浮き上がる間だけ紙の色で満たして、後ろの文字を隠す） */
  solid: number
  /** 指から離した時の速さ（px/秒）。物理エンジンが漂いに戻す時に一度だけ使う */
  toss?: { vx: number; vy: number }
  slot: number
  dead: boolean
}

/** 物理エンジン（3D の部品といっしょに後から読み込む） */
export interface BubblePhysics {
  /** 漂う・掴む・止める・飛ばす泡を動かして、位置と速さを Sim に書き戻す */
  step(dt: number): void
  dispose(): void
}

/** 押し合った所を平らにする平面（メッシュの座標：フィールドの中心が原点、上が +y）。n の向きへ c より先をつぶす */
export interface PressPlane {
  nx: number
  ny: number
  c: number
  /** 角の丸み（px）。ごく小さく（大きいと、壁の両端にすき間ができる） */
  k: number
}

export const MAX_SLOTS = 8

/** はじける前に、ぷにっとつぶれる時間 */
export const POP_SQUASH = 0.08
/** タップした泡が、はじける場所まで浮き上がる時間 */
export const RISE = 0.26
/**
 * 当たり判定の半径は、見た目より少し小さい。
 * 触れ合った泡どうしは見た目が少し重なり、その重なりを平らにつぶして「押し合っている」形にする
 */
export const CORE = 0.92
/** 漂う範囲の左右の端（つぶれた分が外へはみ出しても、描く面で切れないように少し内側） */
export const INSET = 6
/** 漂う範囲の上下の端（帯の上端・下端から内側へ） */
export const TOP_INSET = 2
export const BOTTOM_INSET = 5

/** 押し合う形になる状態（浮き上がる・はじける・消える泡は、ほかの泡の手前を通るだけ） */
const pressable = (s: Sim) =>
  (s.state === 'float' || s.state === 'enter' || s.state === 'grab' || s.state === 'held' || s.state === 'fling') && s.alpha > 0.25

/**
 * 泡の動き（px 座標、フィールド左上が原点）。
 * 3D の球と、その上に重ねる HTML（文字のボタン・紙に落ちる影）の両方がこの位置を使う。
 * ぶつかり合い（押し合う・はね返る・押しのける）は物理エンジン（physics.ts）が受け持つ。
 */
export class BubbleSim {
  w = 320
  h = 180
  /** 泡が漂う範囲の上端。上の余白は、飛ばした泡が抜けていくための空 */
  top = 0
  time = 0
  /** 時間の流れ（はじけた瞬間だけ止める：ヒットストップ） */
  timeScale = 1
  private stopId = 0
  /** 文字の大きさの設定に合わせて、泡も大きくする */
  fontScale = 1
  sims: Sim[] = []
  els = new Map<string, HTMLElement>()
  shadowEls = new Map<number, HTMLElement>()
  physics?: BubblePhysics
  /** はじけた瞬間（膜が破れる時） */
  onBurst?: (s: Sim) => void
  /** 飛ばした泡が、しずくをこぼす時 */
  onTrail?: (s: Sim) => void
  /** 泡が強めにぶつかった時（strength は 0〜1） */
  onBump?: (strength: number) => void

  setSize(w: number, h: number, top = 0) {
    this.w = w
    this.h = h
    this.top = top
  }

  /**
   * 動いていても読めるよう、文字 14px が 3 行におさまる大きさにする（長い問いほど少し大きく）。
   * いちばん長い文節が1行に入る大きさは必ずとる（「はじいてみ／て」「30秒だけなら／？」と切れないように）。
   * 文字の両側の余白は 8px ずつ（Bubble の px-2）
   */
  radiusFor(text: string) {
    const longest = Math.min(MAX_PHRASE_EM, Math.max(...phrases(text, true).map(emWidth)))
    const need = Math.max(40 + Math.min(text.length, 18) * 1.3, (longest * 14 + 18) / 2)
    return Math.max(34, Math.min((this.h - this.top) / 2 - 4, need * this.fontScale))
  }

  /**
   * 泡の字の大きさの倍率。帯が低くて泡を大きくできず、いちばん長い文節が1行に入らない時だけ、少し小さくする
   */
  labelScale(text: string) {
    const room = 2 * this.radiusFor(text) - 16 * this.fontScale
    const longest = Math.max(...phrases(text, true).map(emWidth)) * 14 * this.fontScale
    return Math.max(0.8, Math.min(1, room / longest))
  }

  /**
   * 帯に無理なく浮かべられる泡の数（2〜4）。泡の面積の合計が帯の 6 割ほどまで。
   * 文字を大きくした小さい画面では減らす（入りきらない泡が、端で切れたまま止まらないように）
   */
  capacity() {
    const band = Math.max(1, this.w - 2 * INSET) * Math.max(1, this.h - this.top - TOP_INSET - BOTTOM_INSET)
    const rc = this.radiusFor('今週できる範囲だと？') * CORE
    return Math.max(2, Math.min(4, Math.floor((0.6 * band) / (Math.PI * rc * rc))))
  }

  get(id: string) {
    return this.sims.find((s) => s.id === id && !s.dead)
  }

  /** 指で触れる泡（浮き上がっている・はじけた・飛んでいった・消えていく泡は、もう触れない） */
  private touchable(id: string) {
    const s = this.get(id)
    return s && (s.state === 'enter' || s.state === 'float' || s.state === 'grab' || s.state === 'held') ? s : undefined
  }

  bySlot(slot: number) {
    return this.sims.find((s) => s.slot === slot && !s.dead)
  }

  /** 表示したい問いの一覧に合わせる。新しい問いは端から、ふくらみながら入ってくる */
  sync(qs: BubbleQ[]) {
    const ids = new Set(qs.map((q) => q.id))
    for (const s of this.sims) {
      if (!ids.has(s.id) && (s.state === 'enter' || s.state === 'float' || s.state === 'grab' || s.state === 'held')) {
        s.state = 'fade'
        s.t = 0
      }
    }
    let stagger = 0
    for (const q of qs) {
      if (!this.get(q.id)) this.add(q, stagger++)
    }
  }

  private add(q: BubbleQ, stagger: number) {
    const used = new Set(this.sims.filter((s) => !s.dead).map((s) => s.slot))
    let slot = -1
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (!used.has(i)) {
        slot = i
        break
      }
    }
    if (slot < 0) return
    const r = this.radiusFor(q.text)
    // 泡の少ない側から入る
    const live = this.sims.filter((s) => !s.dead)
    const left = live.filter((s) => s.x < this.w / 2).length
    const fromLeft = left * 2 === live.length ? Math.random() < 0.5 : left * 2 < live.length
    // 1個が画面を横切るのに 12〜17 秒（仕様は 8 秒以上）
    const speed = this.w / (12 + Math.random() * 5)
    const span = Math.max(0, this.h - this.top - 2 * r - 8)
    const baseY = this.top + r + 4 + Math.random() * span
    // 端のすぐ外から入ってくる（遠くから来ると、半分だけ見えた泡が端に長く止まって見える）
    const x = fromLeft ? -r * 0.7 - stagger * 30 : this.w + r * 0.7 + stagger * 30
    const dir = fromLeft ? 1 : -1
    this.sims.push({
      id: q.id,
      x,
      y: baseY,
      baseY,
      vx: dir * Math.max(170, speed * 6),
      vy: 0,
      drift: dir * speed,
      lift: (Math.random() - 0.5) * 8,
      r,
      phase: Math.random() * Math.PI * 2,
      state: 'enter',
      t: 0,
      scale: 0.35,
      sv: 0,
      ja: 0,
      jq: 0,
      jv: 0,
      alpha: 0,
      gx: 0,
      gy: 0,
      px: x,
      py: baseY,
      wvx: 0,
      wvy: 0,
      trailT: 0,
      rx0: 0,
      ry0: 0,
      rtx: 0,
      rty: 0,
      burst: false,
      solid: 0,
      slot,
      dead: false,
    })
  }

  grab(id: string, x: number, y: number) {
    const s = this.touchable(id)
    if (!s) return
    s.state = 'grab'
    s.t = 0
    this.aim(s, x, y)
    s.sv += 2.5
  }

  moveGrab(id: string, x: number, y: number) {
    const s = this.get(id)
    if (!s || s.state !== 'grab') return
    this.aim(s, x, y)
  }

  /** 持っている泡は、漂う帯の中だけを動く（壁の外まで持っていくと、離した時に壁から強く押し戻される） */
  private aim(s: Sim, x: number, y: number) {
    const r = s.r * CORE
    s.gx = Math.min(Math.max(x, INSET + r), this.w - INSET - r)
    s.gy = Math.min(Math.max(y, this.top + TOP_INSET + r), this.h - BOTTOM_INSET - r)
  }

  /** 掴んで離した泡を、その場で少し止めておく（× で外せるように）。止まっている間も、ほかの泡はぶつかってはね返る */
  hold(id: string) {
    const s = this.touchable(id)
    if (!s) return
    s.state = 'held'
    s.t = 0
  }

  /**
   * 漂いに戻す。vx, vy は離した時の指の速さ（px/秒）。泡はその速さで投げ出され、同じ向きへ流れていく。
   * （持っている間の泡の速さは、ほかの泡に押しつけていると大きくふくらむので使わない）
   */
  release(id: string, vx = 0, vy = 0) {
    const s = this.touchable(id)
    if (!s) return
    const held = s.state === 'grab'
    s.state = 'float'
    if (held) {
      const sp = Math.hypot(vx, vy)
      const k = sp > 600 ? 600 / sp : 1
      s.toss = { vx: vx * k, vy: vy * k }
    }
    if (Math.abs(vx) > 40) s.drift = Math.sign(vx) * Math.abs(s.drift)
    if (Math.abs(vy) > 40) s.lift = Math.sign(vy) * Math.abs(s.lift)
    s.sv -= 1.5
  }

  /** はじける前に、ふわっと浮き上がる（キーボードに隠れない高さまで） */
  rise(id: string, tx: number, ty: number) {
    const s = this.get(id)
    if (!s) return
    s.state = 'rise'
    s.t = 0
    s.rx0 = s.x
    s.ry0 = s.y
    s.rtx = tx
    s.rty = ty
    s.sv += 3
  }

  /** 浮き上がっている・はじけている泡があるか（その間はほかの泡を押せないようにする） */
  busy() {
    return this.sims.some((s) => s.state === 'rise' || (s.state === 'pop' && !s.burst))
  }

  pop(id: string) {
    const s = this.get(id)
    if (!s) return
    s.state = 'pop'
    s.t = 0
  }

  /** 飛ばす。飛んでいく途中の泡にぶつかると、その泡を押しのける。飛ばせたら true */
  fling(id: string, vx: number, vy: number) {
    const s = this.touchable(id)
    if (!s) return false
    s.state = 'fling'
    s.t = 0
    s.vx = vx
    s.vy = vy
    return true
  }

  /**
   * ぶつかった（物理エンジンから呼ぶ）。nx, ny はこの泡から見た相手の向き、speed は近づく速さ（px/秒）。
   * 当たった向きにぷにっとつぶれてゆれ、漂っている泡は相手から離れる向きへ進み直す
   */
  impact(s: Sim, nx: number, ny: number, speed: number) {
    s.ja = Math.atan2(-ny, nx)
    s.jv -= Math.min(1, Math.max(0.15, speed / 700)) * 4.5
    if (s.state === 'float') {
      if (Math.abs(nx) > 0.25) s.drift = -Math.sign(nx) * Math.abs(s.drift)
      if (Math.abs(ny) > 0.25) s.lift = -Math.sign(ny) * Math.abs(s.lift)
    }
    if (speed > 220) this.onBump?.(Math.min(1, (speed - 220) / 700))
  }

  /** 止める（メモ用紙を開いている間など） */
  paused = false

  /** ヒットストップ：ほかの泡の動きを一瞬だけ止めて、はじけた手ごたえを出す。時間は実時間で数える */
  hitStop(ms: number) {
    const id = ++this.stopId
    this.timeScale = 0.04
    setTimeout(() => {
      // 新しいヒットストップが始まっていたら、そちらに任せる
      if (id === this.stopId) this.timeScale = 1
    }, ms)
  }

  step(rawDt: number) {
    const dt = this.paused ? 0 : rawDt * this.timeScale
    if (dt <= 0) return
    // 時間は一定の範囲で回す（スマホのシェーダーで精度が落ちてちらつかないように）
    this.time = (this.time + dt) % 600
    const { w, h } = this
    for (const s of this.sims) {
      s.t += dt
      let target = 1
      switch (s.state) {
        case 'enter':
          s.alpha = Math.min(1, s.alpha + dt * 1.6)
          // 当たり判定がすっかり端の内側に入ったら、漂いはじめる（ここから端の壁に当たる）
          if (s.x - s.r * CORE >= INSET && s.x + s.r * CORE <= w - INSET) s.state = 'float'
          break
        case 'float':
          s.alpha = Math.min(1, s.alpha + dt * 2)
          break
        case 'grab':
          target = 1.12
          break
        case 'held':
          target = 1.06
          s.alpha = 1
          break
        case 'rise': {
          // 速く出て、ゆっくり着く。着いたら、ぷにっとつぶれてはじける
          const p = Math.min(1, s.t / RISE)
          const e = 1 - (1 - p) ** 3
          s.x = s.rx0 + (s.rtx - s.rx0) * e
          s.y = s.ry0 + (s.rty - s.ry0) * e
          s.alpha = 1
          target = 1.22
          if (p >= 1) {
            s.state = 'pop'
            s.t = 0
          }
          break
        }
        case 'pop': {
          // ぷにっとつぶれてから、膜が破れる
          if (s.t >= POP_SQUASH && !s.burst) {
            s.burst = true
            this.onBurst?.(s)
          }
          s.alpha = s.t < POP_SQUASH ? 1 : Math.max(0, 1 - (s.t - POP_SQUASH) / 0.05)
          if (s.t > POP_SQUASH + 0.05) s.dead = true
          break
        }
        case 'fling':
          s.alpha = Math.max(0, 1 - s.t / 0.5)
          s.trailT += dt
          if (s.trailT > 0.03) {
            s.trailT = 0
            this.onTrail?.(s)
          }
          if (s.alpha <= 0 || s.x < -s.r * 2 || s.x > w + s.r * 2 || s.y < -s.r * 2 || s.y > h + s.r * 2) s.dead = true
          break
        case 'fade':
          s.alpha -= dt * 3
          if (s.alpha <= 0) s.dead = true
          break
      }
      // 浮き上がる泡だけ中を満たす（リストの上を通る時に、後ろの文字が透けて読みにくくならないように）
      const solidTarget = s.state === 'rise' || s.state === 'pop' ? 1 : 0
      s.solid += (solidTarget - s.solid) * Math.min(1, dt * 14)
      // 大きさはばねで追いかける（入ってくる時・掴んだ時・離した時に、ぷるんとゆれる）
      if (s.state !== 'pop' && s.state !== 'fling') {
        s.sv += ((target - s.scale) * 170 - s.sv * 11) * dt
        s.scale += s.sv * dt
      }
      // ぶつかった時のつぶれは、やわらかいばねで何度かゆれて戻る
      s.jv += (-s.jq * 400 - s.jv * 9) * dt
      s.jq = Math.min(0.3, Math.max(-0.3, s.jq + s.jv * dt))
    }

    this.sims = this.sims.filter((s) => !s.dead)

    if (this.physics) this.physics.step(dt)
    else this.drift(dt)

    for (const s of this.sims) {
      // 見かけの速さ（なめらかに）
      const ivx = (s.x - s.px) / dt
      const ivy = (s.y - s.py) / dt
      s.wvx += (ivx - s.wvx) * Math.min(1, dt * 12)
      s.wvy += (ivy - s.wvy) * Math.min(1, dt * 12)
      s.px = s.x
      s.py = s.y
    }
  }

  /** 物理エンジンを読み込むまでの間だけ使う、ぶつからない動き */
  private drift(dt: number) {
    for (const s of this.sims) {
      if (s.state === 'grab') {
        const k = Math.min(1, dt * 25)
        s.x += (s.gx - s.x) * k
        s.y += (s.gy - s.y) * k
      } else if (s.state === 'enter' || s.state === 'fling') {
        s.x += s.vx * dt
        s.y += s.vy * dt
      } else if (s.state === 'float') {
        s.x += s.drift * dt
      }
    }
  }

  /**
   * 押し合っている所を平らにする平面（深い順に3枚まで）。
   * 同じ平面を両方の泡に渡すので、2つの泡のあいだに1枚の膜の壁ができる。
   * 大きい泡ほど内圧が低いので、大きい方が多くつぶれる
   */
  pressPlanes(s: Sim): PressPlane[] {
    if (!pressable(s)) return []
    const ra = s.r * s.scale
    const ax = s.x - this.w / 2
    const ay = this.h / 2 - s.y
    const out: (PressPlane & { o: number })[] = []
    for (const b of this.sims) {
      if (b === s || !pressable(b)) continue
      const rb = b.r * b.scale
      const dx = b.x - s.x
      const dy = b.y - s.y
      const d = Math.hypot(dx, dy)
      if (d < 0.01) continue
      // 重なりは削らずにそのまま使う（片方だけ削ると、2つの泡の平面がずれて、あいだにすき間や二重の線ができる）
      const o = ra + rb - d
      if (o <= 0) continue
      const nx = dx / d
      const ny = -dy / d
      const depth = (o * ra) / (ra + rb)
      // 角はほとんど丸めない（丸めると壁の両端が内側へ引っこみ、泡と泡のあいだに切れこみができる）
      out.push({ nx, ny, c: ax * nx + ay * ny + ra - depth, k: 1.5, o })
    }
    return out.sort((p, q) => q.o - p.o).slice(0, 3)
  }

  /**
   * 伸び縮み：速く動くほど進む向きに伸び、ぶつかった向きにはつぶれてゆれ、いつもは少しだけぷるぷるする。
   * 向きの違う伸び縮みを足し合わせてから、1つの楕円（2つの軸の長さと傾き）に直す
   */
  deform(s: Sim): { sx: number; sy: number; rot: number } {
    if (s.state === 'pop') {
      const q = Math.min(1, s.t / POP_SQUASH)
      return { sx: 1 + 0.16 * q, sy: 1 - 0.18 * q, rot: 0 }
    }
    // 対称な 2×2 行列 [a b; b c]
    let a = 1
    let b = 0
    let c = 1
    // ang の向きに (1 + q)、横に (1 - 0.6q)
    const add = (ang: number, q: number) => {
      const ux = Math.cos(ang)
      const uy = Math.sin(ang)
      const across = -0.6 * q
      a += across + (q - across) * ux * ux
      c += across + (q - across) * uy * uy
      b += (q - across) * ux * uy
    }
    const sp = Math.hypot(s.wvx, s.wvy)
    if (sp > 30) add(Math.atan2(-s.wvy, s.wvx), Math.min(0.3, sp / 2000))
    add(s.ja, s.jq)
    const wob = 0.035
    a += wob * Math.sin(this.time * 2.3 + s.phase)
    c += wob * Math.sin(this.time * 2.3 + s.phase + 1.7)
    const mid = (a + c) / 2
    const rad = Math.hypot((a - c) / 2, b)
    return { sx: mid + rad, sy: mid - rad, rot: 0.5 * Math.atan2(2 * b, a - c) }
  }

  /** HTML のボタンと、紙に落ちる影を球の位置に合わせる */
  applyDom() {
    for (const s of this.sims) {
      const el = this.els.get(s.id)
      if (el) {
        const size = `${Math.round(s.r * 2)}px`
        if (el.style.width !== size) {
          el.style.width = size
          el.style.height = size
        }
        el.style.transform = `translate3d(${s.x - s.r}px, ${s.y - s.r}px, 0) scale(${s.scale})`
        // 文字は、膜が破れる瞬間まで泡といっしょに見せる
        el.style.opacity = String((s.state === 'pop' && s.burst) || s.state === 'fling' ? 0 : s.alpha)
      }
    }
    for (const [slot, el] of this.shadowEls) {
      const s = this.bySlot(slot)
      if (!s) {
        el.style.opacity = '0'
        continue
      }
      // 光は左上から。影は右下に、地面（紙）へ落ちる
      const r = s.r * s.scale
      el.style.width = `${r * 1.7}px`
      el.style.height = `${r * 0.62}px`
      el.style.transform = `translate3d(${s.x - r * 0.62}px, ${s.y + r * 0.62}px, 0)`
      // 浮き上がる泡は紙から離れるので、影は消える（リストの文字の上に影が落ちないように）
      el.style.opacity = String((s.state === 'fling' ? s.alpha * 0.5 : s.alpha) * (1 - s.solid))
    }
  }
}
