import { usePapers } from '../store'

/**
 * 効果音。音はすべて「効果音バス → マスター（音量・リミッター）」を通す。
 * 同じ音でも毎回少しだけ高さと大きさを変えて、機械的に聞こえないようにする。
 */

let ctx: AudioContext | undefined
let master: GainNode | undefined
let sfx: GainNode | undefined
let noiseBuf: AudioBuffer | undefined
/** 同時に鳴っている音の数（重なりすぎて割れないように） */
let voices = 0
const MAX_VOICES = 6

const dbToGain = (db: number) => 10 ** (db / 20)
/** 音量スライダー 0〜1 → 聞こえ方に近い dB（二乗してから dB に） */
const sliderToDb = (v: number) => (v <= 0.001 ? -80 : 20 * Math.log10(v * v))
const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount

function graph(): { ac: AudioContext; out: GainNode } | undefined {
  const { sound, volume } = usePapers.getState().settings
  if (!sound) return undefined
  try {
    if (!ctx) {
      ctx = new AudioContext()
      // マスターの最後に、割れないためのリミッター（安全装置）
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -6
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.002
      limiter.release.value = 0.08
      master = ctx.createGain()
      sfx = ctx.createGain()
      sfx.gain.value = dbToGain(-3)
      sfx.connect(master).connect(limiter).connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    master!.gain.value = dbToGain(sliderToDb(volume))
    return { ac: ctx, out: sfx! }
  } catch {
    return undefined
  }
}

function voice(dur: number): boolean {
  if (voices >= MAX_VOICES) return false
  voices++
  setTimeout(() => voices--, dur * 1000 + 20)
  return true
}

function tone(freq: number, to: number, dur: number, db = -26, type: OscillatorType = 'sine', delay = 0) {
  const g0 = graph()
  if (!g0 || !voice(dur + delay)) return
  const { ac, out } = g0
  const o = ac.createOscillator()
  const g = ac.createGain()
  const t = ac.currentTime + delay
  const p = vary(0.06)
  o.type = type
  o.frequency.setValueAtTime(freq * p, t)
  o.frequency.exponentialRampToValueAtTime(to * p, t + dur)
  g.gain.setValueAtTime(dbToGain(db) * vary(0.2), t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur)
}

/** 短いノイズ（膜が破れる・金属が当たる） */
function noise(dur: number, freq: number, q: number, db: number) {
  const g0 = graph()
  if (!g0 || !voice(dur)) return
  const { ac, out } = g0
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ac.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = vary(0.08)
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq * vary(0.1)
  f.Q.value = q
  const g = ac.createGain()
  const t = ac.currentTime
  g.gain.setValueAtTime(dbToGain(db) * vary(0.2), t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 0.1)
  src.stop(t + dur)
}

export const sound = {
  /** 泡がはじける：ぷちっ */
  pop: () => {
    noise(0.06, 3200, 1.2, -15)
    tone(1400, 2600, 0.05, -28)
  },
  /** 泡どうしがぶつかる：ぽよん（強くぶつかるほど少し大きく、少し低く） */
  bump: (strength: number) => tone(460 - strength * 80, 300 - strength * 60, 0.08, -36 + strength * 8),
  /** 泡を飛ばす：ひゅっ */
  whoosh: () => noise(0.18, 900, 0.8, -24),
  /** インクのしずくが落ちる */
  land: () => tone(520, 340, 0.12, -28),
  /** 書けた */
  done: () => {
    tone(660, 660, 0.25, -30)
    tone(880, 880, 0.35, -30, 'sine', 0.12)
  },
  /** バインダーのクリップが閉じる：カチッ */
  clack: () => {
    noise(0.04, 2400, 3, -12)
    tone(180, 90, 0.08, -24, 'triangle')
  },
  /** 紙をバインダーにはさむ：カチ（重ねる時の「カチッ」より軽く） */
  clip: () => {
    noise(0.03, 2800, 3, -19)
    tone(220, 120, 0.05, -32, 'triangle')
  },
  /** 通知が届く */
  chime: () => {
    tone(1046, 1046, 0.3, -32)
    tone(1318, 1318, 0.4, -32, 'sine', 0.09)
  },
}
