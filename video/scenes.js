/* 発表動画 v4（一つの困りごとを追う）のシーン。window.seek(t) で t 秒目の1コマを描く。
 * 時刻は build/timeline.js（tts.py が作る、ナレーションの文ごとの開始・終了）に合わせる。 */
(() => {
  const TL = window.TIMELINE;
  const LINE = Object.fromEntries(TL.lines.map((l) => [l.id, l]));
  const $ = (s) => document.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: (p) => p,
    io: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    back: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  };
  const P = (t, a, b, e = E.io) => e(clamp((t - a) / (b - a)));
  const S = (id) => LINE[id].start;
  const En = (id) => LINE[id].end;
  /** その文の中で、ある言葉が話し始められる時刻（文字数の比で近似） */
  const at = (id, phrase) => {
    const l = LINE[id];
    const i = l.text.indexOf(phrase);
    if (i < 0) throw new Error(`phrase not found: ${id} ${phrase}`);
    return l.start + ((l.end - l.start) * i) / l.text.length;
  };
  const win = (t, a, b, f = 0.3) => Math.min(P(t, a, a + f, E.lin), 1 - P(t, b - f, b, E.lin));
  function tf(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o } = {}, extra = "") {
    el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${(sx ?? s).toFixed(4)},${(sy ?? s).toFixed(4)})${extra}`;
    if (o !== undefined) el.style.opacity = clamp(o).toFixed(3);
  }
  const op = (el, o) => { el.style.opacity = clamp(o).toFixed(3); };
  const setText = (el, s) => { if (el._t !== s) { el.textContent = s; el._t = s; } };
  const typeIn = (el, str, p) => setText(el, str.slice(0, Math.round(str.length * clamp(p))));
  const draw = (path, p) => { path.style.strokeDasharray = "1"; path.style.strokeDashoffset = (1 - clamp(p)).toFixed(4); };
  const pop = (t, a, d = 0.35) => P(t, a, a + d, E.back);
  const fadeUp = (el, t, a, d = 0.4, dy = 18, extra = "") => { const p = P(t, a, a + d, E.out); tf(el, { y: dy * (1 - p), o: p }, extra); return p; };
  const mixHex = (a, b, p) => {
    const pa = a.replace("#", "").match(/\w\w/g).map((h) => parseInt(h, 16));
    const pb = b.replace("#", "").match(/\w\w/g).map((h) => parseInt(h, 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(p)))).join(",")})`;
  };
  /** 複数のキーフレーム [t, ...値] をなめらかにつなぐ */
  function keyed(keys, t) {
    let k = 0;
    while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1];
    const p = P(t, a[0], b[0], E.io);
    return a.slice(1).map((v, i) => (i === a.length - 2 ? Math.exp(lerp(Math.log(v), Math.log(b[i + 1]), p)) : lerp(v, b[i + 1], p)));
  }

  /* ------------------------------------------------------------------ */
  /* 机の上の書類（① 困りごと／⑤ 動けた／⑥ 締め）                          */
  /* ------------------------------------------------------------------ */
  const WD = ["木", "金", "土", "日", "月", "火", "水"];   // 10/15 は木曜
  function rD(t) {
    const state = t < 20 ? "before" : t < 160 ? "done" : "end";
    const before = state === "before";
    const desk = $("#deskD");
    if (before) tf(desk, { s: 1 + 0.06 * P(t, 0, 13.5, E.lin) });
    else tf(desk, { s: 1.05 - 0.05 * P(t, state === "done" ? 144.6 : 169.9, state === "done" ? 150.3 : 174, E.out) });
    const day = before ? 15 + Math.round(14 * P(t, S("n2") - 0.1, En("n2") + 0.5, E.lin)) : 31;
    $("#d-cal-day").textContent = String(day);
    $("#d-cal-wd").textContent = WD[(day - 15) % 7];
    $$("#d-clutter .cl").forEach((el, k) => {
      const p = before ? P(t, S("n2") + k * 0.75, S("n2") + 0.3 + k * 0.75, E.out) : k < 2 ? 1 : 0;
      el.style.opacity = p.toFixed(3);
    });
    op($("#d-envA"), before ? 1 : 0);
    op($("#d-note1"), before ? 1 : 0);
    op($("#d-note2"), before ? P(t, at("n3", "分かってる") - 0.3, at("n3", "分かってる"), E.lin) : 0);
    op($("#d-envA-open"), before ? 0 : 1);
    op($("#d-envB"), before ? 0 : 1);
    op($("#d-done"), before ? 0 : 1);
    fadeUp($("#hlD1"), t, before ? S("n2") : 999, 0.45, -14);
    fadeUp($("#hlD2"), t, state === "end" ? S("n37") - 0.15 : 999, 0.45, -14);
    op($("#tagD1"), before ? P(t, 0.6, 1.1) : 0);
    op($("#tagD2"), before ? 0 : 1);
  }

  /* ------------------------------------------------------------------ */
  /* ② 方法はある、でも届かない ／ ③ 戻るのは重い                            */
  /* ------------------------------------------------------------------ */
  const CROWD = [[110, 640], [205, 760], [300, 610], [655, 690], [760, 770], [830, 620], [150, 480], [720, 480], [250, 790], [560, 770], [405, 760], [70, 770], [345, 690], [610, 560], [820, 800], [480, 820]];
  const crowdEls = [];
  function buildWorld() {
    CROWD.forEach(([x, y]) => {
      const el = document.createElement("div");
      el.className = "person";
      el.innerHTML = '<div class="hd"></div><div class="bd"></div>';
      el.style.left = x + "px"; el.style.top = y + "px";
      $("#crowd").appendChild(el);
      crowdEls.push(el);
    });
  }
  const CAM2 = () => [
    [13.5, 1460, 570, 1.45], [27.6, 1460, 570, 1.45], [29.4, 960, 540, 1.0], [44.4, 960, 540, 1.0],
    [44.5, 1460, 600, 1.45], [60, 1460, 600, 1.45],
  ];
  // わたしの歩く道（person の左上の座標）
  const ME_OUT = [452, 560], ME_DOOR = [922, 700], ME_IN = [1010, 740], ME_BACK = [600, 640];
  function walk(t, a, pts, d) {
    const p = P(t, a, a + d, E.io);
    const seg = p < 0.5 ? 0 : 1, q = p < 0.5 ? p * 2 : (p - 0.5) * 2;
    const [x0, y0] = pts[seg], [x1, y1] = pts[seg + 1];
    const bob = p > 0 && p < 1 ? -7 * Math.abs(Math.sin(p * Math.PI * 6)) : 0;
    return [lerp(x0, x1, q), lerp(y0, y1, q) + bob];
  }
  function r2(t) {
    const [cx, cy, s] = keyed(CAM2(), t);
    $("#world").style.transform = `translate(${(960 - cx * s).toFixed(2)}px,${(540 - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    const phaseD = t > 44.45;
    $("#w-left").style.background = mixHex("#E7EFEC", "#F4EEE3", P(t, 27.6, 29.0, E.lin) * (phaseD ? 0 : 1) + (phaseD ? 1 : 0));

    // 手順の図
    fadeUp($("#proc-title"), t, at("n5", "問題解決技法") - 0.3, 0.45, 18, " translateX(-50%)");
    const tSteps = [at("n6", "具体的に"), at("n6", "案を出し"), at("n6", "計画して"), at("n6", "やってみる")];
    const dim = phaseD ? 1 - 0.68 * P(t, 52.6, 53.2) : 1;
    $$(".step").forEach((el, k) => {
      const p = pop(t, tSteps[k] - 0.05, 0.4);
      tf(el, { y: 14 * (1 - Math.min(p, 1)), s: lerp(0.88, 1, p), o: Math.min(1, p * 2) * dim });
    });
    $$(".ex").forEach((el, k) => {
      const p = P(t, tSteps[k] + 0.25, tSteps[k] + 0.6, E.out);
      tf(el, { y: 8 * (1 - p), o: p * dim });
    });
    $$(".sarrow").forEach((el, k) => {
      const p = P(t, tSteps[k + 1] - 0.2, tSteps[k + 1] + 0.1, E.out);
      draw(el, p);
      el.setAttribute("marker-end", p > 0.9 ? "url(#ah)" : "none");
      el.style.opacity = (p > 0 ? dim : 0).toFixed(3);
    });
    const loop = $("#loop");
    const lp = P(t, S("n7") - 0.1, at("n7", "もう一度") + 0.35, E.io);
    draw(loop, lp);
    loop.style.opacity = lp > 0 ? 1 : 0;
    const red = phaseD ? P(t, 52.7, 53.2, E.lin) : 0;
    const pulse = red > 0 ? 0.5 + 0.5 * Math.sin((t - 52.7) * 5.2) : 0;
    loop.setAttribute("stroke", red > 0.5 ? "#DE5440" : "#2E7672");
    loop.setAttribute("marker-end", lp < 0.94 ? "none" : red > 0.5 ? "url(#ah-red)" : "url(#ah)");
    loop.setAttribute("stroke-width", (5 + 4 * red).toFixed(2));
    loop.style.filter = red > 0 ? `drop-shadow(0 0 ${(6 + 10 * pulse) * red}px rgba(222,84,64,${0.55 * red}))` : "none";
    const ll = P(t, at("n7", "直して") - 0.2, at("n7", "直して") + 0.3, E.out);
    tf($("#loop-label"), { y: 8 * (1 - ll), o: ll }, " translateX(-50%)");
    $("#loop-label").style.color = red > 0.5 ? "#DE5440" : "#2E7672";
    const m2 = phaseD ? pop(t, at("n13", "戻る") - 0.4, 0.4) : 0;
    tf($("#me2"), { s: 0.75 * m2, o: Math.min(1, m2 * 2) });

    // 壁と人
    const tWall = at("n8", "身につく");
    const wall = P(t, 27.9, 29.0, E.out) * (1 + 0.1 * P(t, tWall, tWall + 1.2, E.io));
    tf($("#wall"), { sy: phaseD ? 1.1 : wall });
    $("#wall").style.filter = `brightness(${1 - 0.12 * P(t, tWall, tWall + 1.2)})`;
    const lbl = phaseD ? 0 : P(t, 28.8, 29.4);
    tf($("#lb-left"), { o: lbl }, " translateX(-50%)");
    tf($("#lb-right"), { o: lbl }, " translateX(-50%)");
    const tAll = at("n8", "誰の日常");
    const alone = P(t, S("n10") - 0.2, S("n10") + 0.5, E.lin);
    crowdEls.forEach((el, k) => {
      const p = pop(t, tAll + k * 0.06, 0.35);
      tf(el, { s: 0.7 * p, o: Math.min(1, p * 2) * (1 - alone) });
    });
    const tDoor = at("n9", "医療につながって") - 0.6;
    const pd = P(t, tDoor, tDoor + 0.5, E.out);
    tf($("#door"), { sy: phaseD ? 1 : pd, o: phaseD ? 1 : pd });
    const glow = Math.max(0.5 * win(t, at("n8", "ほぼ医療") - 0.2, 41.6, 0.4), win(t, at("n9", "初めて") - 0.2, 41.6, 0.4));
    op($("#proc-glow"), phaseD ? 0 : glow);

    // わたし：群れの中 → 医療の中へ → 一人で外へ
    const me = $("#me");
    let pos = ME_OUT;
    const tIn = at("n9", "医療につながって");
    const tOut = S("n10") - 0.1;
    if (t >= tOut) pos = walk(t, tOut, [ME_IN, ME_DOOR, ME_BACK], 1.7);
    else if (t >= tIn) pos = walk(t, tIn, [ME_OUT, ME_DOOR, ME_IN], 1.8);
    me.style.left = pos[0].toFixed(1) + "px"; me.style.top = pos[1].toFixed(1) + "px";
    const pm = pop(t, tAll, 0.4);
    const hi = P(t, at("n9", "私は") - 0.1, at("n9", "私は") + 0.4, E.out);
    tf(me, { s: (0.7 + 0.5 * hi) * pm, o: phaseD ? 0 : Math.min(1, pm * 2) });
    const dots = $("#me-dots");
    dots.style.left = (pos[0] + 6).toFixed(1) + "px"; dots.style.top = (pos[1] - 72).toFixed(1) + "px";
    op(dots, phaseD ? 0 : P(t, at("n10", "止まります") - 0.1, at("n10", "止まります") + 0.3, E.lin));
  }

  /* ------------------------------------------------------------------ */
  /* ③ 一人だと止まる（10枚）                                             */
  /* ------------------------------------------------------------------ */
  const SHEETS = [
    ["10/03", "役所の書類が出せない", "期限までに出す", "・今週やる ・朝やる", "朝やる", "書類を全部書く", "土曜 9:00"],
    ["10/05", "朝、起きられない", "7時に起きる", "・アラーム2個 ・カーテン", "カーテンを開けて寝る", "夜、カーテンを開ける", "毎晩"],
    ["10/08", "メールの返信がたまる", "今週中に0にする", "・まとめて ・1通ずつ", "まとめて返す", "全部返す", "日曜の夜"],
    ["10/10", "部屋が片づかない", "床が見える", "・1か所だけ ・袋を置く", "机の上だけ", "机の上を5分", "帰ってすぐ"],
    ["10/12", "洗濯物がたまる", "週2回まわす", "・夜にまわす ・予約", "予約する", "夜に予約ボタン", "火・金"],
    ["10/14", "病院の予約ができない", "今月中に予約", "・電話 ・ネット予約", "電話する", "電話してぜんぶ聞く", "平日の昼"],
    ["10/17", "締め切りに間に合わない", "前日に終える", "・先にやる ・分ける", "分ける", "全部の流れを考える", "週末"],
    ["10/19", "■■さんに連絡できない", "お礼を伝える", "・LINE ・手紙", "LINEで一言", "一言だけ送る", "夜9時"],
    ["10/21", "家計簿が続かない", "1か月つける", "・アプリ ・レシート", "レシートを箱へ", "箱を玄関に置く", "毎日"],
    ["10/24", "■■の資料が終わらない", "金曜に出す", "・朝やる ・カフェ", "カフェでやる", "全部しあげる", "土曜"],
  ];
  const DONE = [1, 3, 4, 7, 8];
  const ROT_A = [-2.2, 1.4, -0.8, 2.0, -1.5, 1.1, -2.4, 0.7, 1.8, -1.0];
  const sheetEls = [];
  function buildSheets() {
    SHEETS.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "sheet";
      const fill = (s) => s.replace(/■■/g, '<span class="redact" style="width:2.2em"></span>');
      const rows = d.slice(1).concat([`見直す日 ${d[0].slice(0, 3)}${String(+d[0].slice(3) + 7).padStart(2, "0")}`]);
      el.innerHTML = `<div class="sh-head"><span class="sh-title">問題解決シート</span><span class="sh-date hand">${d[0]}</span></div>` +
        rows.map((s, k) => `<div class="sh-row"><i>${k + 1}</i><div class="hand">${fill(s)}</div></div>`).join("") +
        `<div class="stamp">できた</div><div class="num">${i + 1}</div>`;
      $("#desk3").appendChild(el);
      sheetEls.push(el);
    });
    [["#gl-done", 480, 262], ["#gl-not", 1460, 262]].forEach(([s, cx, y]) => { const el = $(s); el.style.left = cx - 300 + "px"; el.style.top = y + "px"; });
  }
  const W = 250, H = 354;
  const posA = (i) => { const c = i % 5, r = Math.floor(i / 5); return { x: 243 + c * (W + 46), y: 168 + r * (H + 40), r: ROT_A[i] }; };
  const DONE_B = [[250, 470], [480, 470], [710, 470], [365, 765], [595, 765]];
  const NOT_B = [[1300, 500, -9], [1520, 470, 7], [1380, 690, -4], [1600, 720, 11], [1470, 590, 3]];
  const posB = (i) => {
    const di = DONE.indexOf(i);
    if (di >= 0) { const [cx, cy] = DONE_B[di]; return { x: cx - W / 2, y: cy - H / 2, r: ROT_A[i] * 0.5 }; }
    const [cx, cy, r] = NOT_B[[0, 2, 5, 6, 9].indexOf(i)];
    return { x: cx - W / 2, y: cy - H / 2, r };
  };
  function r3(t) {
    const t0 = S("n11") - 0.4;
    const tNum = at("n11", "10枚");
    const tStamp = at("n12", "5枚") - 0.55;
    const tSplit = at("n12", "5枚") + 0.1;
    sheetEls.forEach((el, i) => {
      const a = posA(i), b = posB(i);
      const pin = P(t, t0 + i * 0.05, t0 + 0.5 + i * 0.05, E.out);
      const pm = P(t, tSplit + i * 0.05, tSplit + 0.9 + i * 0.05, E.io);
      const done = DONE.includes(i);
      tf(el, { x: lerp(a.x, b.x, pm), y: lerp(a.y, b.y, pm) - 26 * (1 - pin), r: lerp(a.r, b.r, pm), s: lerp(1, 0.78, pm) * lerp(1.05, 1, pin), o: pin });
      el.style.filter = !done && pm > 0 ? `saturate(${1 - 0.7 * pm}) brightness(${1 - 0.06 * pm})` : "none";
      const pn = pop(t, tNum - 0.3 + i * 0.07, 0.3);
      tf(el.querySelector(".num"), { s: pn, o: Math.min(1, pn * 2) * (1 - P(t, tSplit - 0.3, tSplit, E.lin)) });
      if (done) {
        const di = DONE.indexOf(i);
        const ps = P(t, tStamp + di * 0.1, tStamp + di * 0.1 + 0.25, E.out);
        tf(el.querySelector(".stamp"), { s: lerp(1.8, 1, ps), r: -12, o: ps });
      }
    });
    const gl = P(t, tSplit + 0.9, tSplit + 1.3, E.out);
    tf($("#gl-done"), { y: 12 * (1 - gl), o: gl });
    tf($("#gl-not"), { y: 12 * (1 - gl), o: gl });
    fadeUp($("#hl3"), t, at("n12", "書いただけ") - 0.2, 0.45, -14);
    op($("#tag3"), P(t, t0 + 0.3, t0 + 0.7));
  }

  /* ------------------------------------------------------------------ */
  /* ④ コンセプト                                                        */
  /* ------------------------------------------------------------------ */
  function r4(t) {
    const tMake = at("n14", "作りました") + 0.1;
    const lift = P(t, S("n15") - 0.6, S("n15") + 0.1, E.io);
    const pl = pop(t, tMake, 0.5);
    tf($("#logo"), { s: lerp(0.6, 1, pl), y: -175 * lift, o: Math.min(1, pl * 2) });
    draw($("#logo-loop"), P(t, tMake + 0.35, tMake + 0.95, E.io));
    op($("#logo-loop-head"), P(t, tMake + 0.85, tMake + 1.0, E.lin));
    const pn = P(t, En("n14") + 0.05, En("n14") + 0.5, E.out);
    tf($("#app-name"), { y: 18 * (1 - pn) - 175 * lift, o: pn });
    const c1 = fadeUp($("#cl1"), t, S("n15") - 0.1, 0.45);
    const c2 = fadeUp($("#cl2"), t, S("n16") - 0.1, 0.45);
    $("#hd1 b").style.top = lerp(6, 34, c1 > 0 ? P(t, S("n15") + 0.5, S("n15") + 1.3, E.io) : 0).toFixed(1) + "px";
    $("#hd2 b").style.top = lerp(6, 46, c2 > 0 ? P(t, at("n16", "もっと") - 0.3, at("n16", "もっと") + 0.6, E.io) : 0).toFixed(1) + "px";
    op($("#tag4"), P(t, En("n14"), En("n14") + 0.5));
  }

  /* ------------------------------------------------------------------ */
  /* ⑤ デモ：同じ困りごとを最後まで                                        */
  /* ------------------------------------------------------------------ */
  const FR = ["いま困っていること", "目標", "案を出す", "一歩を決める", "いつ・どこで", "最初の2分", "やってみた"];
  const PAPER1 = ["封筒を開けるところで止まる。全部いっぺんに書こうとする。", "住所変更の書類を出す", "全部書く／封筒だけ出す／窓口で書く",
    "週末に、書類を全部書く（30分）", "土曜 10:00 ・ リビングの机", "封筒を開ける", ""];
  const PAPER2 = [PAPER1[0], PAPER1[1], PAPER1[2], "書類を机に出して、名前だけ書く（2分）", "今日 21:00 ・ リビングの机", "封筒を開ける",
    "名前を書いたら、そのまま最後まで書けた"];
  const DUMP = "住所変更の書類が出せない。もう2週間。";
  const SC1 = "封筒を開けるところで止まる。";
  const SC2 = "全部いっぺんに書こうとして、手が止まる。";
  const A1 = "封筒を開けるところ。中を見るのがしんどい";
  const A2 = "全部いっぺんに書かなきゃと思う";
  const GOAL = "住所変更の書類を出す";
  const IDEAS = [["週末に、書類を全部書く（30分）", 87.8, 88.6], ["封筒だけ机に出す", 89.35, 89.85], ["窓口でいっしょに書いてもらう", 90.5, 91.0]];
  const TYPING = [[70.3, 72.6], [75.6, 76.8], [78.6, 79.6], [83.5, 84.6], [87.8, 91.0]];
  const STAGES = [[60, 87.1], [87.1, 100.0], [100.0, 120.4], [120.4, 138.2], [138.2, 200]];
  const STAGE_COLOR = ["#2E7672", "#2E7672", "#DE5440", "#DE5440", "#2E7672"];
  // スマホの画面座標 → ステージ座標（phone5 は left 260, top 20, ×1.18）
  const PX = (sx) => 260 + 1.18 * (12 + sx), PY = (sy) => 20 + 1.18 * (12 + sy);
  const REST = [560, 520, 1];
  const CAM5 = [
    [66.9, ...REST], [76.7, ...REST], [77.6, 508, 430, 1.3], [80.7, 508, 430, 1.3], [81.5, ...REST],
    [112.3, ...REST], [113.0, 508, 400, 1.5], [116.0, 508, 400, 1.5], [116.6, ...REST],
    [126.8, ...REST], [127.5, 508, 560, 1.45], [130.0, 508, 560, 1.45], [130.6, ...REST], [150, ...REST],
  ];
  let P1, P2;
  function buildPaper(el, contents) {
    el.innerHTML = FR.map((label, i) =>
      `<div class="frame"><div class="fn">${i + 1}</div><div style="flex:1;min-width:0"><div class="fl">${label}</div><div class="fc">${contents[i] || ""}</div></div><div class="empty"></div></div>`).join("");
    return $$(".frame", el);
  }
  function fillFrame(fr, p) {
    op(fr.querySelector(".fc"), p);
    op(fr.querySelector(".empty"), 1 - p);
    fr.classList.toggle("on", p > 0.5);
  }
  function buildDemo() {
    P1 = buildPaper($("#paper1"), PAPER1);
    const PB = buildPaper($("#paper-back"), PAPER1);
    PB.forEach((f, i) => fillFrame(f, i < 6 ? 1 : 0));
    P2 = buildPaper($("#paper2"), PAPER2);
    for (let i = 0; i < 10; i++) $("#mini-papers").appendChild(document.createElement("i"));
    $("#cl-ask").style.top = PY(480) - 40 + "px";
    $("#cl-read").style.top = PY(160) - 40 + "px";
    $("#cl-small").style.top = PY(470) - 40 + "px";
  }
  function screen(el, t, wins, f = 0.25) {
    const o = Math.max(...wins.map(([a, b]) => win(t, a, b, f)));
    el.style.display = o > 0 ? "block" : "none";
    op(el, o);
    return o;
  }
  function tapAt(t, list) {
    const el = $("#tap5");
    for (const [tt, x, y] of list) {
      if (t >= tt - 0.25 && t <= tt + 0.45) {
        const p1 = P(t, tt - 0.25, tt, E.out), p2 = P(t, tt, tt + 0.45, E.out);
        el.style.left = x + "px"; el.style.top = y + "px";
        tf(el, { s: lerp(1.35, 1, p1) * lerp(1, 1.5, p2), o: p1 * (1 - p2) });
        return;
      }
    }
    op(el, 0);
  }
  function r5(t) {
    // カメラ（大事な所に寄る）
    const [fx, fy, s] = keyed(CAM5, t);
    $("#cam5").style.transform = `translate(${(560 - fx * s).toFixed(2)}px,${(520 - fy * s).toFixed(2)}px) scale(${s.toFixed(4)})`;
    const zoom = clamp((s - 1) / 0.25);
    const pin = P(t, 66.9, 67.6, E.out);
    tf($("#phone5"), { y: 40 * (1 - pin), s: 1.18 });

    // 右の列
    op($("#rail"), 1 - zoom);
    STAGES.forEach(([a, b], k) => {
      const it = $("#st" + (k + 1));
      const act = win(t, a, b, 0.35);
      const done = t > b;
      op(it.querySelector(".bg"), act);
      op(it.querySelector(".dd"), act);
      const tt = it.querySelector(".tt"), ix = it.querySelector(".ix");
      tt.style.color = act > 0.5 ? STAGE_COLOR[k] : done ? "#5E584E" : "#A79F92";
      tt.style.transformOrigin = "0 50%";
      tf(tt, { s: 1 + 0.12 * act });
      ix.style.borderColor = act > 0.5 ? STAGE_COLOR[k] : done ? "#2E7672" : "#C9C0B0";
      ix.style.background = done ? "#2E7672" : act > 0.5 ? "#fff" : "transparent";
      ix.style.color = done ? "#fff" : act > 0.5 ? STAGE_COLOR[k] : "#8C8476";
      setText(ix, done ? "✓" : String(k + 1));
    });
    tf($("#rn-only"), { o: win(t, 140.1, 145, 0.3) * (1 - zoom) });
    op($("#tag5"), P(t, 67.4, 67.9));
    op($("#ff"), Math.max(...TYPING.map(([a, b]) => win(t, a - 0.1, b + 0.25, 0.15))));
    setText($("#sb5"), t < 98.9 ? "20:15" : t < 100.9 ? "" : t < 120.4 ? "10:00" : "21:00");

    // Claude のラベル
    const lab = (el, a, b) => { const p = P(t, a, a + 0.35, E.out); tf(el, { x: -16 * (1 - p), o: win(t, a, b, 0.3) }); };
    lab($("#cl-ask"), S("n19") - 0.1, 82.6);
    lab($("#cl-read"), at("n25", "Claudeが") - 0.1, 119.6);
    lab($("#cl-small"), at("n28", "自分の言葉") - 0.25, 130.4);

    // 紙（白紙／目標まで／一歩まで／止まった）
    const sp = screen($("#scr-paper"), t, [[66.9, 69.95], [85.5, 87.3], [93.8, 99.1], [103.3, 106.0]]);
    if (sp > 0) {
      let n = 0;
      if (t > 85 && t < 88) n = 2; else if (t > 93 && t < 107) n = 6;
      P1.forEach((fr, i) => {
        let p = i < n ? 1 : 0;
        if (t > 93 && t < 100 && i >= 2 && i < 6) p = P(t, 94.0 + (i - 2) * 0.15, 94.2 + (i - 2) * 0.15, E.lin);
        if (t > 85 && t < 88 && i === 1) p = P(t, 85.8, 86.1, E.lin);
        fillFrame(fr, p);
      });
      const stopped = t > 103 ? P(t, at("n24", "ここで") - 0.4, at("n24", "ここで"), E.lin) : 0;
      $("#paper1").style.filter = stopped > 0 ? `saturate(${1 - 0.8 * stopped}) brightness(${1 - 0.08 * stopped})` : "none";
      const ps = pop(t, at("n24", "ここで") - 0.2, 0.35);
      tf($("#stopped"), { s: t > 103 ? ps : 0, o: t > 103 ? Math.min(1, ps * 2) : 0 }, " translate(-50%,-50%) rotate(-8deg)");
      const pulse = t < 70 ? win(t, 68.4, 69.8, 0.3) * (0.5 + 0.5 * Math.sin((t - 68.4) * 7)) : 0;
      P1[0].querySelector(".empty").style.borderColor = mixHex("#E1D9CB", "#3F8F8A", pulse);
    }

    // 1 いま困っていること
    const sd = screen($("#scr-dump"), t, [[69.5, 85.8]]);
    if (sd > 0) {
      const z = P(t, 69.5, 70.05, E.out);
      $("#scr-dump").style.transformOrigin = "198px 185px";
      tf($("#scr-dump"), { s: lerp(0.3, 1, z), o: sd });
      let txt = DUMP.slice(0, Math.round(DUMP.length * P(t, 70.3, 72.6, E.lin)));
      if (t > 76.95) txt = DUMP + SC1.slice(0, Math.round(SC1.length * P(t, 76.95, 77.5, E.lin)));
      if (t > 79.75) txt = DUMP + SC1 + SC2.slice(0, Math.round(SC2.length * P(t, 79.75, 80.4, E.lin)));
      setText($("#dump-txt"), txt);
      setText($("#dump-lbl"), t > 76.95 ? "場面" : "そのまま書いて大丈夫");
      const bub = (el, a, b, dx) => {
        const pu = P(t, a, a + 0.7, E.out), pp = P(t, b, b + 0.3, E.out);
        tf(el, { x: dx * Math.sin((t - a) * 1.3), y: 120 * (1 - pu) + 6 * Math.sin((t - a) * 2.1), s: 1 + 0.15 * pp, o: pu * (1 - pp) });
      };
      bub($("#bq1"), S("n19") + 0.1, 76.95, 6);
      bub($("#bq2"), 77.6, 79.75, 8);
      const inp = $("#dump-input");
      op(inp, P(t, 74.6, 74.9, E.lin) * (1 - P(t, 81.2, 81.5, E.lin)));
      let a = "";
      if (t < 76.95) a = A1.slice(0, Math.round(A1.length * P(t, 75.6, 76.8, E.lin)));
      else if (t < 79.75) a = A2.slice(0, Math.round(A2.length * P(t, 78.6, 79.6, E.lin)));
      setText(inp, a);
      const bg = P(t, 81.6, 82.0, E.out);
      tf($("#btn-goal"), { y: 20 * (1 - bg), s: t > 82.65 && t < 82.9 ? 0.96 : 1, o: bg });
      const gs = P(t, 83.0, 83.4, E.out) * (1 - P(t, 85.0, 85.4, E.io));
      tf($("#goal-sheet"), { y: 320 * (1 - gs) });
      typeIn($("#goal-input"), GOAL, P(t, 83.5, 84.6, E.lin));
    }

    // 3 案を出す
    const si = screen($("#scr-ideas"), t, [[87.1, 94.0]]);
    if (si > 0) {
      tf($("#scr-ideas"), { x: 40 * (1 - P(t, 87.1, 87.5, E.out)), o: si });
      ["#bi1", "#bi2", "#bi3"].forEach((sel, k) => {
        const po = P(t, 87.3 + k * 0.3, 87.8 + k * 0.3, E.out), u = t - 87;
        tf($(sel), { x: 10 * Math.sin(u * 0.7 + k), y: -16 * Math.sin(u * 0.9 + k * 1.7) - u * 5, o: po });
      });
      let txt = "";
      for (const [str, a, b] of IDEAS) if (t >= a - 0.05 && t < b + 0.15) txt = str.slice(0, Math.round(str.length * P(t, a, b, E.lin)));
      setText($("#idea-input"), txt);
      let shown = false;
      IDEAS.forEach(([, , b], k) => {
        const f0 = b + 0.15, f1 = f0 + 0.45;
        const pl = pop(t, f1, 0.3);
        tf($("#li" + (k + 1)), { s: lerp(0.9, 1, pl), o: Math.min(1, pl * 2) });
        if (t >= f0 && t <= f1) {
          const p = P(t, f0, f1, E.io);
          tf($("#ball"), { x: lerp(330, 40, p) - 17, y: lerp(788, 251 + k * 60, p) - 150 * Math.sin(Math.PI * p) - 17, o: 1 });
          shown = true;
        }
      });
      if (!shown) op($("#ball"), 0);
      $("#li1").classList.toggle("sel", t > 91.85);
      const ps = P(t, 92.1, 92.5, E.out);
      tf($("#plan-sheet"), { y: 400 * (1 - ps) });
      typeIn($("#pl1v"), "土曜 10:00", P(t, 92.5, 92.75, E.lin));
      typeIn($("#pl2v"), "リビングの机", P(t, 92.75, 93.0, E.lin));
      typeIn($("#pl3v"), "封筒を開ける", P(t, 93.0, 93.3, E.lin));
    }

    // ロック画面・今、どう？
    if (screen($("#scr-lock"), t, [[98.9, 101.2]]) > 0) {
      const pn = P(t, 99.6, 100.05, E.out);
      tf($("#notif"), { y: -140 * (1 - pn), s: t > 100.65 && t < 100.9 ? 0.97 : 1, o: pn });
    }
    if (screen($("#scr-check"), t, [[100.9, 103.5]]) > 0) {
      const pressed = t > 102.45;
      $("#ck3").style.background = pressed ? "#ECE6DB" : "#fff";
      $("#ck3").style.borderColor = pressed ? "#9A9284" : "#D9D0C0";
    }

    // あなたの記録
    const sr = screen($("#scr-record"), t, [[105.8, 121.4]]);
    if (sr > 0) {
      tf($("#scr-record"), { y: 30 * (1 - P(t, 105.8, 106.3, E.out)), o: sr });
      const r0 = at("n25", "これまでの紙") - 0.2, r1 = at("n25", "動けた時") - 0.3;
      $$("#mini-papers i").forEach((el, k) => el.classList.toggle("on", t > lerp(r0, r1, k / 9)));
      setText($("#rc-read-lbl"), t > r1 ? "これまでの紙 10枚を読みました" : "これまでの紙を読んでいます");
      fadeUp($("#rc-main"), t, at("n25", "動けた時") - 0.2, 0.4);
      fadeUp($("#insight"), t, S("n26") - 0.15, 0.45, 10);
      op($("#ev-link"), P(t, 114.2, 114.5, E.lin));
      const ev = P(t, 116.9, 117.3, E.out) * (1 - P(t, 119.6, 120.0, E.io));
      tf($("#ev-sheet"), { y: 600 * (1 - ev) });
      $$("#ev-sheet .ev").forEach((el, k) => op(el, P(t, 117.2 + k * 0.15, 117.45 + k * 0.15, E.lin)));
      const ba = P(t, 120.0, 120.35, E.out);
      tf($("#btn-again"), { y: 20 * (1 - ba), s: t > 120.95 && t < 121.2 ? 0.96 : 1, o: ba });
    }

    // もう一度（下書き）
    const sa = screen($("#scr-again"), t, [[121.3, 130.6]]);
    if (sa > 0) {
      tf($("#scr-again"), { x: 40 * (1 - P(t, 121.3, 121.7, E.out)), o: sa });
      fadeUp($("#ag1"), t, 121.6);
      fadeUp($("#ag2"), t, S("n28") - 0.1);
      const tA = at("n28", "小さくした") - 0.3;
      const pa = P(t, tA, tA + 0.35, E.out);
      $("#ag-arrow").style.height = (40 * pa).toFixed(1) + "px";
      op($("#ag-arrow"), Math.min(1, pa * 3));
      const tD = at("n28", "下書き") - 0.25;
      const pd = pop(t, tD, 0.4);
      tf($("#ag3"), { s: lerp(0.92, 1, pd), o: Math.min(1, pd * 2) });
      const kw = t > S("n29");
      $$(".kw2, .kw3").forEach((el) => el.classList.toggle("kw", kw));
      const pg = P(t, 129.4, 129.75, E.out);
      tf($("#btn-go"), { y: 20 * (1 - pg), s: t > 130.05 && t < 130.3 ? 0.96 : 1, o: pg });
    }

    // 重なる紙 → 動けた
    const ss = screen($("#scr-stack"), t, [[130.4, 146]]);
    if (ss > 0) {
      tf($("#paper-back"), { x: 14, y: -20, r: 2.6 });
      const pf = P(t, 130.6, 131.6, E.out);
      tf($("#paper2"), { y: lerp(-760, 8, pf), r: lerp(-4, 0, pf) });
      const tCarry = at("n30", "前の紙") - 0.2;
      P2.forEach((fr, i) => {
        if (i < 3) { fillFrame(fr, 1); fr.classList.toggle("carry", t > tCarry); }
        else if (i < 6) { fillFrame(fr, 1); fr.classList.toggle("new", i === 3); }
        else fillFrame(fr, P(t, 140.1, 140.5, E.lin));
      });
      typeIn(P2[6].querySelector(".fc"), PAPER2[6], P(t, 140.1, 140.8, E.lin));
      const pc = pop(t, at("n30", "重なります") - 0.15, 0.4);
      tf($("#pill2"), { s: pc, o: Math.min(1, pc * 2) });
      op($("#back-tab"), P(t, 130.5, 130.9, E.lin));
      const ck = P(t, 138.3, 138.7, E.out) * (1 - P(t, 139.6, 140.0, E.io));
      tf($("#check2"), { y: 320 * (1 - ck) });
      $("#ck2-yes").style.transform = t > 139.25 && t < 139.5 ? "scale(.96)" : "none";
      const glow = P(t, 140.3, 141.5, E.io);
      $("#paper2").style.background = mixHex("FFFFFF", "FFF4DA", glow);
      $("#paper2").style.boxShadow = `0 0 0 ${(5 * glow).toFixed(1)}px rgba(240,190,94,${(0.6 * glow).toFixed(2)}), 0 6px 20px rgba(60,40,10,.14), 0 0 ${(40 * glow).toFixed(0)}px rgba(240,190,94,${(0.45 * glow).toFixed(2)})`;
    }

    tapAt(t, [[82.7, 198, 803], [91.8, 120, 251], [100.7, 198, 330], [102.4, 198, 607], [116.7, 84, 401],
      [121.0, 198, 551], [130.1, 198, 771], [139.3, 198, 686]]);
  }

  /* ------------------------------------------------------------------ */
  /* ⑥ 締め                                                              */
  /* ------------------------------------------------------------------ */
  function r6a(t) {
    const ts = [at("n32", "問いかけて"), at("n32", "読んで"), at("n32", "小さく")];
    ["#r6a", "#r6b", "#r6c"].forEach((s, k) => {
      const p = pop(t, ts[k] - 0.15, 0.4);
      tf($(s), { s: lerp(0.85, 1, p), o: Math.min(1, p * 2) });
    });
    fadeUp($("#r6p1"), t, S("n33") - 0.1);
    fadeUp($("#r6p2"), t, at("n33", "決めるのは") - 0.1);
  }
  function r6b(t) {
    fadeUp($("#safe-head"), t, S("n34") - 0.15);
    const ph = P(t, 160.0, 160.6, E.out);
    const side = P(t, S("n36") - 0.5, S("n36") + 0.35, E.io);
    $("#phone6").style.transform = `translate(${(370 * (1 - side)).toFixed(1)}px,${(30 * (1 - ph)).toFixed(1)}px) scale(.86)`;
    op($("#phone6"), ph);
    const pm = P(t, S("n36") - 0.2, S("n36") + 0.4, E.out);
    tf($("#memo"), { x: 80 * (1 - pm), r: 2 * (1 - pm), o: pm });
    $("#memo .m-sel").style.background = mixHex("F6F2EA", "D9ECE9", P(t, at("n36", "医療に") - 0.2, at("n36", "医療に") + 0.3, E.lin));
    op($("#tag6"), P(t, 160.3, 160.8));
  }
  function r6c(t) {
    fadeUp($("#end-name"), t, S("n38") - 0.4);
    fadeUp($("#end-l1"), t, S("n38") - 0.1);
    fadeUp($("#end-l2"), t, S("n39") - 0.1);
    op($("#thanks"), P(t, En("n39") - 0.4, En("n39") + 0.2));
  }

  /* ------------------------------------------------------------------ */
  const SCENES = [
    ["#scD", [[-1, 13.8], [144.6, 150.3], [169.95, 174.0]], rD],
    ["#sc2", [[13.5, S("n11") - 0.1], [En("n12") + 0.3, 57.8]], r2],
    ["#sc3", [[S("n11") - 0.4, En("n12") + 0.6]], r3],
    ["#sc4", [[57.5, 67.2]], r4],
    ["#sc5", [[66.9, 144.9]], r5],
    ["#sc6a", [[150.0, 160.25]], r6a],
    ["#sc6b", [[159.95, 170.25]], r6b],
    ["#sc6c", [[173.7, 999]], r6c],
  ];

  // 字幕：ナレーションと同じ文。画面に同じ文が大きく出る所は出さない。デモ中は右の列に出す。
  const NOSUB = new Set(["n15", "n16", "n33", "n34", "n37", "n38", "n39"]);
  const CUES = [];
  TL.lines.forEach((l) => { if (!NOSUB.has(l.id)) l.subs.forEach((c) => CUES.push({ ...c })); });
  CUES.sort((a, b) => a.start - b.start);
  CUES.forEach((c, i) => { const nx = CUES[i + 1]; c.show = Math.min(c.end + 0.4, nx ? nx.start - 0.02 : c.end + 0.4); });
  function rSub(t) {
    const c = CUES.find((c) => t >= c.start - 0.05 && t < c.show);
    const box = $("#sub");
    if (!c) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.className = t > 66.9 && t < 144.9 ? "side" : "";
    setText(box.querySelector("span"), c.text);
  }

  function seek(t) {
    for (const [sel, wins, fn] of SCENES) {
      const el = $(sel);
      const o = Math.max(...wins.map(([a, b]) => win(t, a, b, 0.3)));
      if (o <= 0) { el.style.display = "none"; continue; }
      el.style.display = "block";
      op(el, o);
      fn(t);
    }
    rSub(t);
  }

  buildWorld();
  buildSheets();
  buildDemo();

  window.seek = seek;
  window.ready = document.fonts.ready.then(() => { seek(0); return true; });

  // ブラウザで開いたときのプレビュー：?t=秒 でその場面、?play で音声つき再生（クリックで再生・停止）
  const q = new URLSearchParams(location.search);
  if (q.has("t")) window.ready.then(() => seek(parseFloat(q.get("t"))));
  if (q.has("play")) {
    const audio = new Audio("build/narration.wav");
    const fit = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); $("#stage").style.transform = `scale(${k})`; $("#stage").style.transformOrigin = "0 0"; };
    fit(); addEventListener("resize", fit);
    document.body.addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
    const loop = () => { seek(audio.currentTime); requestAnimationFrame(loop); };
    window.ready.then(() => { if (q.get("from")) audio.currentTime = parseFloat(q.get("from")); loop(); });
  }
})();
