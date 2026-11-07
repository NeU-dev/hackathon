// 台本⑤の画面録画（モック）を撮る。A = 白紙から①②を書く、B = できた紙で 決める→止まる→もう一度→動けた
// 使い方: node record_demo.cjs <出力先> [A|B]
const { chromium } = require('playwright');
const path = require('path');
const { Recorder, W, SCREEN_H } = require('./recorder.cjs');
const BASE = process.env.MOCK_URL || 'http://localhost:4173/';

async function open(url, startISO) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: SCREEN_H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
  await Recorder.setup(ctx, startISO);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { b, page };
}

/** なめらかにスクロール（ease-in-out） */
async function scroll(r, total, ms) {
  const n = Math.round(ms / (1000 / 30));
  r.taps.push({ f: r.frame, f1: r.frame + n, x: 250, y: 560, dy: total, kind: 'swipe' });
  let done = 0;
  for (let i = 1; i <= n; i++) {
    const p = i / n;
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const to = Math.round(total * e);
    if (to !== done) await r.page.mouse.wheel(0, to - done);
    done = to;
    await r.tick(1);
  }
}

async function sessionA(out) {
  const { b, page } = await open(BASE + '?full&rec', '2026-11-12T20:15:00+09:00');
  const r = new Recorder(page, out);
  await page.mouse.move(195, 400);
  await r.wait(1000); r.mark('start');
  await r.tapButton('新しい紙'); r.mark('new_tap');
  await r.wait(2600); r.mark('paper_ready');
  await r.tapText('いま困っていること'); r.mark('f1_tap');
  await r.wait(1300);
  await r.tapText('頭の中にあることを、そのまま書く');
  await r.waitForEditor(); await r.wait(150); await r.keyboard(true); await r.wait(300); r.mark('type1');
  await r.type('企画書が進まない', 9); await r.wait(300);
  await r.tapButton('追加'); await r.keyboard(false); r.mark('added1');
  await r.wait(1600);
  await r.tapButton('書けた'); await r.wait(1800); r.mark('cands');
  await r.wait(500);
  await r.tapText('企画書が進まない', { exact: true }); r.mark('pick');
  await r.wait(2200);
  await r.tapText('どんな場面か'); r.mark('f2_tap');
  await r.wait(1500); r.mark('bubbles');
  await r.wait(900);
  await r.tapButton('何が一番困ってる？'); r.mark('b1');
  await r.waitForEditor(); await r.wait(150); await r.keyboard(true); await r.wait(300);
  await r.type('何を書けばいいか分からない', 11); await r.wait(200);
  await r.tapButton('追加'); await r.keyboard(false); r.mark('ans1');
  await r.wait(1500);
  await r.tapButton('どこで手が止まる？'); r.mark('b2');
  await r.waitForEditor(); await r.wait(150); await r.keyboard(true); await r.wait(300);
  await r.type('最初の1行', 8); await r.wait(200);
  await r.tapButton('追加'); await r.keyboard(false); r.mark('ans2');
  await r.wait(2400); r.mark('scene');
  await r.wait(1200); r.mark('end');
  r.save(); await b.close();
}

async function sessionB(out) {
  const { b, page } = await open(BASE + '?full&rec&demo=kikaku', '2026-11-12T20:40:00+09:00');
  const r = new Recorder(page, out);
  await page.mouse.move(195, 400);
  await r.wait(800); r.mark('start');
  await r.tapText('企画書が進まない'); r.mark('open_tap');
  await r.wait(2600); r.mark('paper');
  await r.wait(300);
  await scroll(r, 560, 1500); r.mark('ideas');
  await r.wait(500);
  await scroll(r, 420, 1200); r.mark('step');
  await r.wait(900); r.mark('decided');
  // 土曜の朝
  await page.clock.setSystemTime(new Date('2026-11-14T10:00:00+09:00'));
  await r.wait(500);
  await page.keyboard.press('n'); r.mark('notify');
  await r.wait(1300);
  await r.tapText('今、どう？'); r.mark('checkin_tap');
  await r.wait(1300); r.mark('checkin');
  await r.wait(600);
  await r.tapText('できなかった', { exact: true }); r.mark('cannot');
  await r.tick(3);
  // Claude が記録を読むあいだ（本物の通信くらいの長さ）。読み込み中の表示は 1.6 秒で一巡するので 3 巡分撮る
  r.mark('loading'); await r.hold(4800); r.mark('loading_end');
  await r.wait(1400); r.mark('record');
  await r.wait(2500); r.mark('record_hold');
  await r.tapText('これで、もう一度'); r.mark('again');
  await r.wait(1200); r.mark('reasons');
  await r.wait(500);
  await r.tapText('手がつけられなかった'); r.mark('reason');
  await r.wait(1400); r.mark('stack');
  await r.wait(1800); r.mark('shrink');
  await r.wait(2000);
  await r.tapButton('書けた'); r.mark('kakeda');
  await r.wait(2200); r.mark('paper2');
  // 日曜の朝（2枚目の紙の予定どおり）
  await page.clock.setSystemTime(new Date('2026-11-15T08:50:00+09:00'));
  await page.keyboard.press('n'); r.mark('notify2');
  await r.wait(1300);
  await r.tapText('今、どう？'); await r.wait(1300); r.mark('checkin2');
  await r.wait(400);
  await r.tapText('やった', { exact: true }); r.mark('did');
  await r.wait(3200); r.mark('stamp');
  await r.wait(1500); r.mark('end');
  r.save(); await b.close();
}

(async () => {
  const out = process.argv[2];
  const which = process.argv[3] || 'AB';
  const t0 = Date.now();
  if (which.includes('A')) await sessionA(path.join(out, 'A'));
  if (which.includes('B')) await sessionB(path.join(out, 'B'));
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's');
})();
