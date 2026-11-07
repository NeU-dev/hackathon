// モックを「実機の画面録画」らしく撮る：時計を止めて 1 コマずつ進め、2 倍の解像度で保存する。
// JS の時刻（Date・setTimeout・requestAnimationFrame・performance.now）は Playwright の時計で、
// CSS アニメーション・トランジション・WAAPI（motion）は document.getAnimations() で、同じ仮想時刻に合わせる。
const fs = require('fs');
const path = require('path');

const FPS = 30;
const DT = 1000 / FPS;
const W = 390;              // iPhone 14/15 の幅（CSS px）
const SCREEN_H = 844;       // iPhone 14/15 の高さ。上の 54 はステータスバーの分（アプリは --safe-top で避ける。時刻などは動画の側で描く）
const KB_H = 336;           // 日本語キーボード（予測変換の帯とホームバーの分を含む）

// ページに入れる：アニメーションを仮想時刻で動かす
const DRIVER = `
(() => {
  const seen = new WeakMap();
  window.__drive = (vnow) => {
    for (const a of document.getAnimations()) {
      if (a.playState === 'idle') continue;
      let r = seen.get(a);
      if (!r) {
        if (a.playState === 'paused') continue;        // アプリが止めたものはさわらない
        // 見つけた時から始まる扱いにする。motion は自分の時計で開始時刻を決めるので、
        // currentTime がマイナス（＝少し先に始まる予定）になっていることがあり、そのまま使うと遅れる
        const ct = Math.min(Math.max(Number(a.currentTime) || 0, 0), 34);
        r = { t0: vnow - ct, rate: a.playbackRate || 1 };
        seen.set(a, r);
        try { a.playbackRate = r.rate * 0.0005; } catch (e) {}
      }
      try { a.currentTime = (vnow - r.t0) * r.rate; } catch (e) {}
    }
  };
})();
`;

class Recorder {
  constructor(page, outDir) {
    this.page = page;
    this.out = outDir;
    this.frame = 0;
    this.vnow = 0;
    this.kb = 0;              // キーボード（0 = なし, 1 = 出ている）
    this.meta = [];           // コマごと：{ h: ページの高さ, kb }
    this.marks = {};
    this.taps = [];           // { f, x, y, kind }
    this.keys = [];           // キーを押したコマ（キーボードの光る演出に使う）
    fs.mkdirSync(outDir, { recursive: true });
  }

  static async setup(context, startISO) {
    await context.addInitScript(DRIVER);
    await context.addInitScript(`(() => {
      const s = document.createElement('style');
      s.textContent = ':root{--safe-top:54px !important;--safe-bottom:34px !important}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    })();`);
    await context.clock.install({ time: new Date(startISO) });
    // install だけだと時計は実時間でも進んでしまう。止めて、runFor の分だけ進むようにする
    await context.clock.pauseAt(new Date(new Date(startISO).getTime() + 1000));
  }

  get h() { return SCREEN_H; }

  async snap() {
    // 入力欄のカーソルは実時間で点滅するので、撮るたびに点け直す（コマ送りで点滅がちらつかないように。iPhone も打っている間は点いたまま）
    await this.page.evaluate(() => {
      const a = document.activeElement;
      if (!a || !/^(TEXTAREA|INPUT)$/.test(a.tagName) || a.selectionStart == null) return;
      const s = a.selectionStart, e = a.selectionEnd;
      a.setSelectionRange(s > 0 ? s - 1 : s + 1, s > 0 ? s - 1 : s + 1);
      a.setSelectionRange(s, e);
    });
    const f = String(this.frame).padStart(5, '0');
    await this.page.screenshot({ path: path.join(this.out, `m${f}.jpg`), type: 'jpeg', quality: 86, caret: 'initial' });
    this.meta.push({ h: this.h, kb: this.kb });
    this.frame++;
  }

  /** n コマ進める（毎コマ：時計を進め、アニメーションを合わせ、撮る） */
  async tick(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.page.clock.runFor(DT);
      this.vnow += DT;
      await this.page.evaluate((v) => window.__drive && window.__drive(v), this.vnow);
      await this.snap();
    }
  }

  async wait(ms) { await this.tick(Math.max(1, Math.round(ms / DT))); }

  /** JS の時計を止めたまま、CSS のアニメーションだけ進めて撮る（読み込み中の表示を、実際の通信くらいの長さにする） */
  async hold(ms) {
    const n = Math.max(1, Math.round(ms / DT));
    for (let i = 0; i < n; i++) {
      this.vnow += DT;
      await this.page.evaluate((v) => window.__drive && window.__drive(v), this.vnow);
      await this.snap();
    }
  }

  mark(name) { this.marks[name] = this.frame; console.log('mark', name, this.frame); }

  /** タップ：指が触れて離れるまでを 3 コマで（ちょっと押してから離す） */
  async tap(x, y, kind = 'tap') {
    this.taps.push({ f: this.frame, x, y, kind });
    await this.page.touchscreen.tap(x, y);
    await this.tick(1);
  }

  async tapButton(name, opts = {}) {
    const loc = this.page.getByRole('button', { name, exact: opts.exact !== false }).last();
    const box = await loc.boundingBox();
    if (!box) throw new Error('no button: ' + name);
    await this.tap(box.x + box.width / 2 + (opts.dx || 0), box.y + box.height / 2 + (opts.dy || 0));
  }

  async tapText(text, opts = {}) {
    const loc = this.page.getByText(text, { exact: !!opts.exact });
    const n = await loc.count();
    for (let i = n - 1; i >= 0; i--) {
      const box = await loc.nth(i).boundingBox();
      if (!box || box.width === 0) continue;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (y < 0 || y > this.h) continue;
      const ok = await this.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y), [x, y]);
      if (ok) return this.tap(x, y);
    }
    throw new Error('no text: ' + text);
  }

  /** キーボードを出す／しまう。画面の高さは変えず、動画の側で下にキーボードを重ねる
   * （高さを変えると、泡が「キーボードより上」まで長く浮き上がり、コマ送りとかみ合わないため） */
  async keyboard(on) {
    this.kb = on ? 1 : 0;
  }

  /** 見えている入力欄にフォーカスが移るまで待つ（最大 ms） */
  async waitForEditor(ms = 2000) {
    for (let t = 0; t < ms; t += 1000 / 30) {
      const ok = await this.page.evaluate(() => {
        const a = document.activeElement;
        if (!a || !/^(TEXTAREA|INPUT)$/.test(a.tagName)) return false;
        const r = a.getBoundingClientRect();
        const st = getComputedStyle(a);
        return r.height > 12 && r.width > 40 && st.opacity !== '0' && st.visibility !== 'hidden';
      });
      if (ok) return true;
      await this.tick(1);
    }
    throw new Error('editor did not open');
  }

  /** 1 文字ずつ打つ（cps = 1 秒あたりの文字数） */
  async type(text, cps = 7) {
    const per = Math.max(1, Math.round(FPS / cps));
    for (const ch of Array.from(text)) {
      this.keys.push({ f: this.frame, ch });
      await this.page.keyboard.insertText(ch);
      await this.tick(per);
    }
  }

  save() {
    fs.writeFileSync(path.join(this.out, 'rec.json'), JSON.stringify({ fps: FPS, w: W, screenH: SCREEN_H, kbH: KB_H, frames: this.frame, meta: this.meta, marks: this.marks, taps: this.taps, keys: this.keys }));
  }
}

module.exports = { Recorder, FPS, DT, W, SCREEN_H, KB_H };
