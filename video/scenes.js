/* 発表動画 v3 のシーン。window.seek(t) で t 秒目の1コマを描く。
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
  /** a〜b のあいだ 1、前後 f 秒でフェード */
  const win = (t, a, b, f = 0.3) => Math.min(P(t, a, a + f, E.lin), 1 - P(t, b - f, b, E.lin));
  function tf(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o } = {}) {
    el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${(sx ?? s).toFixed(4)},${(sy ?? s).toFixed(4)})`;
    if (o !== undefined) el.style.opacity = clamp(o).toFixed(3);
  }
  const op = (el, o) => { el.style.opacity = clamp(o).toFixed(3); };
  const setText = (el, s) => { if (el._t !== s) { el.textContent = s; el._t = s; } };
  const typeIn = (el, str, p) => setText(el, str.slice(0, Math.round(str.length * clamp(p))));
  const draw = (path, p) => { path.style.strokeDasharray = "1"; path.style.strokeDashoffset = (1 - clamp(p)).toFixed(4); };
  const pop = (t, a, d = 0.35) => P(t, a, a + d, E.back);   // 0→1（少し行き過ぎる）
  const fadeUp = (el, t, a, d = 0.4, dy = 18) => { const p = P(t, a, a + d, E.out); tf(el, { y: dy * (1 - p), o: p }); return p; };
  const mixHex = (a, b, p) => {
    const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
    const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(p)))).join(",")})`;
  };

  /* ------------------------------------------------------------------ */
  /* ① つかみ                                                            */
  /* ------------------------------------------------------------------ */
  const SHEETS = [
    ["10/03", "役所の書類が出せない", "期限までに出す", "・今週やる ・朝やる", "朝やる", "書類を全部書く", "土曜 9:00", "やらなかった"],
    ["10/05", "朝、起きられない", "7時に起きる", "・アラーム2個 ・カーテン", "カーテンを開けて寝る", "夜、カーテンを開ける", "毎晩", "3日できた"],
    ["10/08", "メールの返信がたまる", "今週中に0にする", "・まとめて ・1通ずつ", "まとめて返す", "全部返す", "日曜の夜", "やらなかった"],
    ["10/10", "部屋が片づかない", "床が見える", "・1か所だけ ・袋を置く", "机の上だけ", "机の上を5分", "帰ってすぐ", "できた"],
    ["10/12", "洗濯物がたまる", "週2回まわす", "・夜にまわす ・予約", "予約する", "夜に予約ボタン", "火・金", "できた"],
    ["10/14", "病院の予約ができない", "今月中に予約", "・電話 ・ネット予約", "電話する", "電話してぜんぶ聞く", "平日の昼", "やらなかった"],
    ["10/17", "締め切りに間に合わない", "前日に終える", "・先にやる ・分ける", "分ける", "全部の流れを考える", "週末", "やらなかった"],
    ["10/19", "■■さんに連絡できない", "お礼を伝える", "・LINE ・手紙", "LINEで一言", "一言だけ送る", "夜9時", "できた"],
    ["10/21", "家計簿が続かない", "1か月つける", "・アプリ ・レシート", "レシートを箱へ", "箱を玄関に置く", "毎日", "できた"],
    ["10/24", "■■の資料が終わらない", "金曜に出す", "・朝やる ・カフェ", "カフェでやる", "全部しあげる", "土曜", "やらなかった"],
  ];
  const DONE = [1, 3, 4, 7, 8];
  const ROT_A = [-2.2, 1.4, -0.8, 2.0, -1.5, 1.1, -2.4, 0.7, 1.8, -1.0];
  const sheetEls = [];
  function buildSheets() {
    const desk = $("#desk");
    SHEETS.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "sheet";
      const fill = (s) => s.replace(/■■/g, '<span class="redact" style="width:2.2em"></span>');
      el.innerHTML =
        `<div class="sh-head"><span class="sh-title">問題解決シート</span><span class="sh-date hand">${d[0]}</span></div>` +
        d.slice(1, 7).concat([`見直す日 ${d[0].slice(0, 3)}${String(+d[0].slice(3) + 7).padStart(2, "0")}`]).map((s, k) => `<div class="sh-row"><i>${k + 1}</i><div class="hand">${fill(s)}${k === 0 && i === 5 ? ' <span class="redact" style="width:3em"></span>' : ""}</div></div>`).join("") +
        `<div class="stamp">できた</div><div class="num">${i + 1}</div>`;
      desk.appendChild(el);
      sheetEls.push(el);
    });
  }
  // 並べ方 A（10枚）と B（分けたあと）
  const W = 250, H = 354;
  const posA = (i) => { const c = i % 5, r = Math.floor(i / 5); return { x: 243 + c * (W + 46), y: 168 + r * (H + 40), r: ROT_A[i], s: 1 }; };
  const DONE_B = [[250, 470], [480, 470], [710, 470], [365, 765], [595, 765]];
  const NOT_B = [[1300, 500, -9], [1520, 470, 7], [1380, 690, -4], [1600, 720, 11], [1470, 590, 3]];
  const posB = (i) => {
    const di = DONE.indexOf(i);
    if (di >= 0) { const [cx, cy] = DONE_B[di]; return { x: cx - W / 2, y: cy - H / 2, r: ROT_A[i] * 0.5, s: 0.78 }; }
    const ni = [0, 2, 5, 6, 9].indexOf(i);
    const [cx, cy, r] = NOT_B[ni];
    return { x: cx - W / 2, y: cy - H / 2, r, s: 0.78 };
  };
  function r1(t) {
    const tNum = at("n1", "10枚");
    const tStamp = at("n3", "5枚") - 0.45;
    const tSplit = at("n4", "5枚") - 0.25;
    tf($("#desk"), { s: 1 + 0.03 * P(t, 0, tSplit, E.lin) - 0.03 * P(t, tSplit, tSplit + 1, E.io) });
    sheetEls.forEach((el, i) => {
      const a = posA(i), b = posB(i);
      const k = i * 0.07;
      const pin = P(t, 0.05 + k, 0.65 + k, E.out);
      const pm = P(t, tSplit + i * 0.06, tSplit + 1.0 + i * 0.06, E.io);
      const done = DONE.includes(i);
      el.style.left = "0px"; el.style.top = "0px";
      tf(el, {
        x: lerp(a.x, b.x, pm) + (b.s < 1 ? 0 : 0),
        y: lerp(a.y, b.y, pm) - 26 * (1 - pin),
        r: lerp(a.r, b.r, pm),
        s: lerp(1, b.s, pm) * lerp(1.05, 1, pin),
        o: pin,
      });
      el.style.filter = !done && pm > 0 ? `saturate(${1 - 0.7 * pm}) brightness(${1 - 0.06 * pm})` : "none";
      const num = el.querySelector(".num");
      const pn = pop(t, tNum - 0.4 + i * 0.09, 0.3);
      tf(num, { s: pn, o: Math.min(1, pn * 2) * (1 - P(t, tSplit - 0.3, tSplit + 0.1, E.lin)) });
      const st = el.querySelector(".stamp");
      if (done) {
        const di = DONE.indexOf(i);
        const ps = P(t, tStamp + di * 0.13, tStamp + di * 0.13 + 0.28, E.out);
        tf(st, { s: lerp(1.8, 1, ps), r: -12, o: ps });
      }
    });
    const gl = P(t, tSplit + 1.0, tSplit + 1.5, E.out);
    tf($("#gl-done"), { y: 12 * (1 - gl), o: gl });
    tf($("#gl-not"), { y: 12 * (1 - gl), o: gl });
    fadeUp($("#hook-head"), t, En("n4") - 1.3, 0.5, -16);
    op($("#tag1"), P(t, 0.6, 1.2));
  }

  /* ------------------------------------------------------------------ */
  /* ② 壁                                                                */
  /* ------------------------------------------------------------------ */
  const CROWD = [[110, 640], [205, 760], [300, 610], [655, 690], [760, 770], [830, 620], [150, 480], [720, 480], [250, 790], [560, 770], [405, 760], [70, 770], [345, 690], [610, 560], [820, 800], [480, 820]];
  const INSIDE = [[1100, 770], [1210, 795], [1320, 770], [1580, 790], [1690, 770], [1800, 795]];
  const INSIDE_PICK = [2, 4];
  const crowdEls = [], insideEls = [];
  function buildWorld() {
    const mk = (parent, x, y, s, color) => {
      const el = document.createElement("div");
      el.className = "person";
      el.innerHTML = '<div class="hd"></div><div class="bd"></div>';
      el.style.left = x + "px"; el.style.top = y + "px";
      el.dataset.s = s;
      if (color) el.style.color = color;
      parent.appendChild(el);
      return el;
    };
    CROWD.forEach(([x, y]) => crowdEls.push(mk($("#crowd"), x, y, 0.7)));
    INSIDE.forEach(([x, y]) => insideEls.push(mk($("#inside"), x, y, 0.7)));
    $("#w-right").style.width = "1500px";
  }
  const CAM = [
    [15.0, 960, 540, 1.0], [25.1, 960, 540, 1.0], [26.7, 1460, 590, 1.5], [36.7, 1460, 590, 1.5],
    [38.0, 960, 540, 1.0], [40.0, 960, 540, 1.0], [42.6, 955, 545, 1.1], [47.9, 955, 545, 1.1],
    [49.3, 1460, 600, 1.45], [56, 1460, 600, 1.45],
  ];
  function cam(t) {
    let k = 0;
    while (k < CAM.length - 2 && t > CAM[k + 1][0]) k++;
    const [t0, x0, y0, s0] = CAM[k], [t1, x1, y1, s1] = CAM[k + 1];
    const p = P(t, t0, t1, E.io);
    // ズームの補間は対数で（等速に見えるように）
    const s = Math.exp(lerp(Math.log(s0), Math.log(s1), p));
    return { cx: lerp(x0, x1, p), cy: lerp(y0, y1, p), s };
  }
  function r2(t) {
    const c = cam(t);
    $("#world").style.transform = `translate(${(960 - c.cx * c.s).toFixed(2)}px,${(540 - c.cy * c.s).toFixed(2)}px) scale(${c.s.toFixed(4)})`;

    // 壁の外にいた自分
    const wallUp = P(t, 15.3, 16.5, E.out);
    const wallTall = P(t, at("n9", "身につく"), at("n9", "身につく") + 1.4, E.io);
    tf($("#wall"), { sy: wallUp * (1 + 0.13 * wallTall) });
    $("#wall").style.filter = `brightness(${1 - 0.12 * wallTall})`;
    const n1o = win(t, at("n10", "その中でさえ"), 48.3, 0.35);
    const n2o = win(t, at("n11", "もう一度") - 0.4, 55.4, 0.35);
    const lbl = 1 - Math.max(n1o, n2o);
    tf($("#lb-left"), { x: -0, o: P(t, 15.9, 16.5) * lbl });
    tf($("#lb-right"), { o: P(t, 16.2, 16.8) * lbl });
    $("#lb-left").style.transform = "translateX(-50%)";
    $("#lb-right").style.transform = "translateX(-50%)";
    const pm = pop(t, 16.5, 0.45);
    tf($("#me"), { s: 1.5 * pm, o: Math.min(1, pm * 2) });
    const tTrouble = at("n5", "困っていても");
    const tWhat = at("n5", "何から");
    const fadeAway = 1 - P(t, 25.0, 25.5, E.lin);
    draw($("#tangle-path"), P(t, tTrouble - 0.4, tWhat + 0.8, E.io));
    op($("#tangle"), fadeAway);
    const q1 = pop(t, tWhat, 0.35), q2 = pop(t, tWhat + 0.3, 0.35);
    tf($("#q1"), { s: q1, r: -10, o: Math.min(1, q1 * 2) * fadeAway });
    tf($("#q2"), { s: q2, r: 12, o: Math.min(1, q2 * 2) * fadeAway });
    const th = P(t, tWhat + 0.3, tWhat + 0.8, E.out);
    tf($("#me-think"), { y: 10 * (1 - th), o: th * fadeAway });

    // 壁の高さを見せるあいだは、手順の図を小さくして右の場に収める
    const shrink = P(t, 37.0, 38.4, E.io) * (1 - P(t, 47.9, 49.3, E.io));
    const proc = $("#proc");
    proc.style.transformOrigin = "1460px 520px";
    proc.style.transform = `scale(${(1 - 0.24 * shrink).toFixed(4)})`;
    // 壁の中にあったもの：問題解決技法の手順
    fadeUp($("#proc-title"), t, at("n6", "この問題解決技法") - 0.3, 0.45);
    $("#proc-title").style.transform += " translateX(-50%)";
    const tSteps = [at("n7", "具体的に"), at("n7", "案を出し"), at("n7", "計画して"), at("n7", "やってみる")];
    const tRed = at("n11", "もう一度") - 0.25;
    const dim = 1 - 0.68 * P(t, S("n11") + 0.3, S("n11") + 1.0);
    $$(".step").forEach((el, k) => {
      const p = pop(t, tSteps[k] - 0.05, 0.4);
      tf(el, { y: 14 * (1 - Math.min(p, 1)), s: lerp(0.88, 1, p), o: Math.min(1, p * 2) * dim });
    });
    $$(".sarrow").forEach((el, k) => {
      const p = P(t, tSteps[k + 1] - 0.2, tSteps[k + 1] + 0.1, E.out);
      draw(el, p);
      el.setAttribute("marker-end", p > 0.9 ? "url(#ah)" : "none");
      el.style.opacity = (p > 0 ? dim : 0).toFixed(3);
    });
    const loop = $("#loop");
    const lp = P(t, at("n8", "うまくいかなければ") - 0.1, at("n8", "もう一度") + 0.35, E.io);
    draw(loop, lp);
    loop.style.opacity = lp > 0 ? 1 : 0;
    const red = P(t, tRed, tRed + 0.4, E.lin);
    const pulse = red > 0 ? 0.5 + 0.5 * Math.sin((t - tRed) * 5.2) : 0;
    loop.setAttribute("stroke", red > 0.5 ? "#DE5440" : "#2E7672");
    loop.setAttribute("marker-end", lp < 0.94 ? "none" : red > 0.5 ? "url(#ah-red)" : "url(#ah)");
    loop.setAttribute("stroke-width", (5 + 4 * red).toFixed(2));
    loop.style.filter = red > 0 ? `drop-shadow(0 0 ${(6 + 10 * pulse) * red}px rgba(222,84,64,${0.55 * red}))` : "none";
    const ll = P(t, at("n8", "直して") - 0.2, at("n8", "直して") + 0.3, E.out);
    tf($("#loop-label"), { y: 8 * (1 - ll), o: ll });
    $("#loop-label").style.transform += " translateX(-50%)";
    $("#loop-label").style.color = red > 0.5 ? "#DE5440" : "#2E7672";
    const hv = P(t, at("n11", "一番重い") - 0.2, at("n11", "一番重い") + 0.3, E.out);
    tf($("#heavy-label"), { y: 8 * (1 - hv), o: hv });
    $("#heavy-label").style.transform += " translateX(-50%)";
    const m2 = pop(t, at("n11", "一人だと") - 0.1, 0.4);
    const me2 = $("#me2");
    me2.style.left = "1735px"; me2.style.top = "745px";
    tf(me2, { s: 0.75 * m2, o: Math.min(1, m2 * 2) });

    // 壁の高さ：誰の日常にも／医療の中だけ／一部
    const tAll = at("n9", "誰の日常");
    crowdEls.forEach((el, k) => {
      const p = pop(t, tAll + k * 0.07, 0.35);
      tf(el, { s: 0.7 * p, o: Math.min(1, p * 2) * (1 - P(t, 48.0, 48.6, E.lin)) });
    });
    const tIn = at("n9", "医療の中だけ") - 0.2;
    const tFew = at("n10", "一部") - 0.5;
    const few = P(t, tFew, tFew + 0.5, E.out);
    insideEls.forEach((el, k) => {
      const p = pop(t, tIn + k * 0.09, 0.35);
      const picked = INSIDE_PICK.includes(k);
      el.style.color = picked ? mixHex("#B4AA9A", "#2E7672", few) : "#B4AA9A";
      tf(el, { s: 0.7 * p * (picked ? 1 + 0.18 * few : 1), o: Math.min(1, p * 2) * (picked ? 1 : 1 - 0.55 * few) * (1 - P(t, 48.0, 48.6, E.lin)) });
    });
    tf($("#note1"), { o: n1o, y: -10 * (1 - P(t, at("n10", "その中でさえ"), at("n10", "その中でさえ") + 0.4, E.out)) });
    $("#note1").style.transform += " translateX(-50%)";
    tf($("#note2"), { o: n2o, y: -10 * (1 - P(t, at("n11", "もう一度") - 0.4, at("n11", "もう一度"), E.out)) });
    $("#note2").style.transform += " translateX(-50%)";
  }

  /* ------------------------------------------------------------------ */
  /* ③ コンセプト                                                        */
  /* ------------------------------------------------------------------ */
  function r3(t) {
    const tMake = at("n12", "作りました") + 0.1;
    const lift = P(t, S("n13") - 0.6, S("n13") + 0.1, E.io);
    const pl = pop(t, tMake, 0.5);
    tf($("#logo"), { s: lerp(0.6, 1, pl), y: -175 * lift, o: Math.min(1, pl * 2) });
    draw($("#logo-loop"), P(t, tMake + 0.35, tMake + 0.95, E.io));
    op($("#logo-loop-head"), P(t, tMake + 0.85, tMake + 1.0, E.lin));
    const pn = P(t, En("n12") + 0.05, En("n12") + 0.5, E.out);
    tf($("#app-name"), { y: 18 * (1 - pn) - 175 * lift, o: pn });
    const c1 = fadeUp($("#cl1"), t, S("n13") - 0.1, 0.45);
    const c2 = fadeUp($("#cl2"), t, S("n14") - 0.1, 0.45);
    $("#hd1 b").style.top = lerp(6, 34, P(t, S("n13") + 0.5, S("n13") + 1.3, E.io) * (c1 > 0 ? 1 : 0)).toFixed(1) + "px";
    $("#hd2 b").style.top = lerp(6, 46, P(t, at("n14", "もっと") - 0.3, at("n14", "もっと") + 0.6, E.io) * (c2 > 0 ? 1 : 0)).toFixed(1) + "px";
    op($("#tag3"), P(t, En("n12"), En("n12") + 0.5));
  }

  /* ------------------------------------------------------------------ */
  /* ④ デモ                                                              */
  /* ------------------------------------------------------------------ */
  const FR = ["困っていること（場面）", "目標", "案を出す", "一歩を決める", "いつ・どこで", "最初の2分", "やってみた"];
  const PAPER1 = [
    "住所変更の書類が、机の上に2週間。見るたびにスマホへ。",
    "住所変更の書類を出す",
    "全部書く／封筒で玄関へ／窓口を予約",
    "書類を全部書く（30分）",
    "明日 8:00 ・ リビングの机",
    "書類とペンを出す",
    "",
  ];
  const PAPER2 = [
    PAPER1[0], PAPER1[1], PAPER1[2],
    "書類を机に出して、名前だけ書く（2分）",
    "今日 21:00 ・ リビングの机",
    "封筒から書類を出す",
    "やった。名前を書いたら、住所まで書けた",
  ];
  function buildPaper(el, contents) {
    el.innerHTML = FR.map((label, i) =>
      `<div class="frame"><div class="fn">${i + 1}</div><div style="flex:1;min-width:0"><div class="fl">${label}</div><div class="fc">${contents[i] || ""}</div></div><div class="empty"></div></div>`
    ).join("");
    return $$(".frame", el);
  }
  /** 枠の埋まり具合を p（0〜1）で描く */
  function fillFrame(fr, p) {
    const fc = fr.querySelector(".fc"), em = fr.querySelector(".empty");
    op(fc, p);
    op(em, 1 - p);
    fr.classList.toggle("on", p > 0.5);
  }
  let P1, P2, PB;
  function buildDemo() {
    P1 = buildPaper($("#paper1"), PAPER1);
    PB = buildPaper($("#paper-back"), PAPER1);
    P2 = buildPaper($("#paper2"), PAPER2);
    PB.forEach((f, i) => fillFrame(f, i < 6 ? 1 : 0));
    const mp = $("#mini-papers");
    for (let i = 0; i < 10; i++) mp.appendChild(document.createElement("i"));
  }
  const DUMP = "やらなきゃいけないことが多すぎる。役所の書類もずっと出せてないし、部屋もちらかってる。週末はいつも寝て終わって、また自己嫌悪…";
  const SCENE0 = "役所の住所変更の書類が出せていない。";
  const SCENE1 = "机の上に、2週間置いたまま。";
  const SCENE2 = "見るたびに目をそらして、スマホへ逃げる。";
  const A1 = "机の上。2週間 置いたまま";
  const A2 = "目をそらして、スマホを見てしまう";
  const IDEAS = [["書類を全部書く（30分）", 82.5, 83.3], ["封筒に入れて玄関に置く", 84.1, 84.65], ["窓口を予約する", 85.3, 85.65]];
  const TYPING = [[68.3, 71.0], [74.4, 75.15], [76.5, 77.25], [82.45, 85.7]];
  const SB_TIME = [[0, "20:15"], [88.9, ""], [91.9, "8:00"], [118.0, "21:00"]];

  const STAGES = [[65.0, 82.0], [82.0, 89.0], [89.0, 109.4], [109.4, 125.0], [125.0, 135.4]];
  const STAGE_COLOR = ["#2E7672", "#2E7672", "#DE5440", "#DE5440", "#2E7672"];

  function screen(el, t, a, b, f = 0.3) {
    const o = win(t, a, b, f);
    el.style.display = o > 0 ? "block" : "none";
    op(el, o);
    return o;
  }
  function tapAt(t, list) {
    const el = $("#tap4");
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

  const TAP_EV = () => S("n24") + 1.15;
  function r4(t) {
    // 右の列
    STAGES.forEach(([a, b], k) => {
      const it = $("#st" + (k + 1));
      const act = win(t, k === 0 ? 60 : a, k === 4 ? 200 : b, 0.35);
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
    const tAnswer = S("n19") - 0.2;
    tf($("#rn1"), { o: win(t, tAnswer, 82.0, 0.3), y: 10 * (1 - P(t, tAnswer, tAnswer + 0.4, E.out)) });
    op($("#rn2"), 0);
    const tNo = at("n22", "反省") - 0.9;
    tf($("#rn3"), { o: win(t, tNo, 97.6, 0.3) });
    $("#rn3 s").style.textDecoration = t > tNo + 0.7 ? "line-through" : "none";
    tf($("#rn4"), { o: win(t, at("n27", "白紙には") - 0.1, 124.9, 0.3) });
    tf($("#rn5"), { o: win(t, 127.0, 140, 0.3) });
    op($("#tag4"), P(t, 65.5, 66.0));
    op($("#ff"), Math.max(...TYPING.map(([a, b]) => win(t, a - 0.1, b + 0.25, 0.15))));

    // スマホの入り
    const pin = P(t, 64.95, 65.7, E.out);
    tf($("#phone4"), { y: 40 * (1 - pin) });
    let sbt = "20:15";
    for (const [tt, s] of SB_TIME) if (t >= tt) sbt = s;
    setText($("#sb4-time"), sbt);

    // 白紙の紙 → 埋まった紙
    const sp = screen($("#scr-paper"), t, 64.9, 89.15, 0.3);
    if (sp > 0) {
      const blankPhase = t < 80;
      op($("#scr-paper"), blankPhase ? 1 - P(t, 67.6, 68.1, E.lin) : win(t, 88.1, 89.15, 0.25));
      $("#scr-paper").style.display = (blankPhase && t < 68.1) || (!blankPhase && t > 88.1) ? "block" : "none";
      setText($("#paper-pill"), "1枚目");
      P1.forEach((fr, i) => {
        if (blankPhase) fillFrame(fr, 0);
        else fillFrame(fr, i === 0 ? 1 : i < 6 ? P(t, 88.3 + (i - 1) * 0.1, 88.5 + (i - 1) * 0.1, E.lin) : 0);
      });
      const pulse = blankPhase ? win(t, 66.4, 67.8, 0.3) * (0.5 + 0.5 * Math.sin((t - 66.4) * 7)) : 0;
      P1[0].querySelector(".empty").style.borderColor = mixHex("#E1D9CB", "#3F8F8A", pulse);
      P1[0].querySelector(".fn").style.borderColor = mixHex("#C9C0B0", "#3F8F8A", pulse);
    }

    // 1 困っていること
    const sd = screen($("#scr-dump"), t, 67.6, 82.2, 0.35);
    if (sd > 0) {
      const z = P(t, 67.6, 68.15, E.out);
      $("#scr-dump").style.transformOrigin = "198px 185px";
      tf($("#scr-dump"), { s: lerp(0.3, 1, z), o: sd });
      typeIn($("#dump-txt"), DUMP, P(t, 68.3, 71.0, E.lin));
      const cand = $("#cand");
      const away = P(t, 73.0, 73.45, E.io);
      op(cand, P(t, 71.2, 71.5, E.lin) * (1 - away));
      ["#chip1", "#chip2", "#chip3"].forEach((s, k) => {
        const p = pop(t, 71.35 + k * 0.22, 0.3);
        tf($(s), { s: p, o: Math.min(1, p * 2) });
      });
      $("#chip1").classList.toggle("sel", t > 72.65);
      tf($("#dump-card"), { y: -20 * away, o: 1 - away });
      tf($("#cand"), { y: -20 * away, o: P(t, 71.2, 71.5, E.lin) * (1 - away) });
      const sc = P(t, 73.25, 73.7, E.out);
      tf($("#scene-card"), { y: 16 * (1 - sc), o: sc });
      let s = SCENE0;
      if (t > 75.35) s += SCENE1.slice(0, Math.round(SCENE1.length * P(t, 75.35, 75.85, E.lin)));
      if (t > 77.45) s += SCENE2.slice(0, Math.round(SCENE2.length * P(t, 77.45, 78.0, E.lin)));
      setText($("#scene-txt"), s);
      const bub = (el, a, b, dx) => {
        const pu = P(t, a, a + 0.7, E.out), pp = P(t, b, b + 0.3, E.out);
        tf(el, { x: dx * Math.sin((t - a) * 1.3), y: 120 * (1 - pu) + 6 * Math.sin((t - a) * 2.1), s: 1 + 0.15 * pp, o: pu * (1 - pp) });
      };
      bub($("#bq1"), 73.55, 75.3, 6);
      bub($("#bq2"), 75.7, 77.4, 8);
      const inp = $("#dump-input");
      op(inp, P(t, 73.6, 73.9, E.lin) * (1 - P(t, 79.6, 79.9, E.lin)));
      let txt = "";
      if (t < 75.3) txt = A1.slice(0, Math.round(A1.length * P(t, 74.4, 75.1, E.lin)));
      else if (t < 77.4) txt = A2.slice(0, Math.round(A2.length * P(t, 76.5, 77.2, E.lin)));
      setText(inp, txt);
      const bg = P(t, 79.9, 80.3, E.out);
      tf($("#btn-goal"), { y: 20 * (1 - bg), s: t > 80.85 && t < 81.15 ? 0.96 : 1, o: bg });
    }

    // 3 案を出す
    const si = screen($("#scr-ideas"), t, 81.9, 88.35, 0.3);
    if (si > 0) {
      tf($("#scr-ideas"), { x: 40 * (1 - P(t, 81.9, 82.3, E.out)), o: si });
      ["#bi1", "#bi2", "#bi3"].forEach((s, k) => {
        const po = P(t, 82.2 + k * 0.3, 82.7 + k * 0.3, E.out);
        const u = t - 82;
        tf($(s), { x: 10 * Math.sin(u * 0.7 + k), y: -16 * Math.sin(u * 0.9 + k * 1.7) - u * 5, o: po });
      });
      const inp = $("#idea-input");
      let txt = "";
      for (const [s, a, b] of IDEAS) if (t >= a - 0.05 && t < b + 0.15) txt = s.slice(0, Math.round(s.length * P(t, a, b, E.lin)));
      setText(inp, txt);
      const ball = $("#ball");
      let shown = false;
      IDEAS.forEach(([, , b], k) => {
        const f0 = b + 0.15, f1 = f0 + 0.5;
        const li = $("#li" + (k + 1));
        const pl = pop(t, f1, 0.3);
        tf(li, { s: lerp(0.9, 1, pl), o: Math.min(1, pl * 2) });
        if (t >= f0 && t <= f1) {
          const p = P(t, f0, f1, E.io);
          const x0 = 330, y0 = 788, x1 = 40, y1 = 251 + k * 60;
          tf(ball, { x: lerp(x0, x1, p) - 17, y: lerp(y0, y1, p) - 150 * Math.sin(Math.PI * p) - 17, o: 1 });
          shown = true;
        }
      });
      if (!shown) op(ball, 0);
      $("#li1").classList.toggle("sel", t > 86.65);
      const ps = P(t, 86.85, 87.25, E.out);
      tf($("#plan-sheet"), { y: 400 * (1 - ps) });
      typeIn($("#pl1v"), "明日 8:00", P(t, 87.2, 87.45, E.lin));
      typeIn($("#pl2v"), "リビングの机", P(t, 87.45, 87.7, E.lin));
      typeIn($("#pl3v"), "書類とペンを出す", P(t, 87.7, 88.0, E.lin));
    }

    // ロック画面と通知
    const sl = screen($("#scr-lock"), t, 88.9, 92.2, 0.3);
    if (sl > 0) {
      const pn = P(t, 90.2, 90.65, E.out);
      tf($("#notif"), { y: -140 * (1 - pn), s: t > 91.55 && t < 91.8 ? 0.97 : 1, o: pn });
    }
    // 今、どう？
    const sc = screen($("#scr-check"), t, 91.9, 95.0, 0.3);
    if (sc > 0) {
      const pressed = t > 93.75;
      $("#ck3").style.background = pressed ? "#ECE6DB" : "#fff";
      $("#ck3").style.borderColor = pressed ? "#9A9284" : "#D9D0C0";
    }
    // あなたの記録
    const sr = screen($("#scr-record"), t, 94.8, 110.9, 0.3);
    if (sr > 0) {
      tf($("#scr-record"), { y: 30 * (1 - P(t, 94.8, 95.3, E.out)), o: sr });
      const r0 = at("n23", "これまでの紙") - 0.2, r1_ = at("n23", "あなたが") - 0.3;
      $$("#mini-papers i").forEach((el, k) => el.classList.toggle("on", t > lerp(r0, r1_, k / 9)));
      setText($("#rc-read-lbl"), t > r1_ ? "AIが、これまでの紙 10枚を全部読みました" : "AIが、これまでの紙を読んでいます");
      fadeUp($("#rc-main"), t, at("n23", "あなたが") - 0.2, 0.4);
      fadeUp($("#insight"), t, S("n24") - 0.15, 0.45, 10);
      op($("#ev-link"), P(t, S("n24") + 0.5, S("n24") + 0.8, E.lin));
      const te = TAP_EV();
      const ev = P(t, te + 0.2, te + 0.6, E.out) * (1 - P(t, 108.25, 108.7, E.io));
      tf($("#ev-sheet"), { y: 600 * (1 - ev) });
      $$("#ev-sheet .ev").forEach((el, k) => op(el, P(t, te + 0.5 + k * 0.15, te + 0.75 + k * 0.15, E.lin)));
      const ba = P(t, 108.75, 109.15, E.out);
      const pulse = win(t, 109.3, 110.1, 0.2) * Math.sin((t - 109.3) * 8);
      tf($("#btn-again"), { y: 20 * (1 - ba), s: (1 + 0.025 * pulse) * (t > 110.2 && t < 110.45 ? 0.96 : 1), o: ba });
    }
    // もう一度（下書き）
    const sa = screen($("#scr-again"), t, 110.55, 118.4, 0.3);
    if (sa > 0) {
      tf($("#scr-again"), { x: 40 * (1 - P(t, 110.55, 110.95, E.out)), o: sa });
      fadeUp($("#ag1"), t, at("n26", "自分が書いた目標") - 0.1);
      fadeUp($("#ag2"), t, at("n26", "前回の一歩") - 0.1);
      const tA = at("n26", "自分の言葉") - 0.25;
      const pa = P(t, tA, tA + 0.35, E.out);
      $("#ag-arrow").style.height = (40 * pa).toFixed(1) + "px";
      op($("#ag-arrow"), Math.min(1, pa * 3));
      const tD = at("n26", "小さくした") - 0.3;
      const pd = pop(t, tD, 0.4);
      tf($("#ag3"), { s: lerp(0.92, 1, pd), o: Math.min(1, pd * 2) });
      const kw = t > tD + 0.5;
      $$(".kw2, .kw3").forEach((el) => el.classList.toggle("kw", kw));
      op($("#ag-note"), P(t, tD + 0.6, tD + 1.0, E.lin));
      const pg = P(t, 117.1, 117.45, E.out);
      tf($("#btn-go"), { y: 20 * (1 - pg), s: t > 117.7 && t < 117.95 ? 0.96 : 1, o: pg });
    }
    // 重なる紙 → 動けた
    const ss = screen($("#scr-stack"), t, 118.1, 140, 0.3);
    if (ss > 0) {
      const back = $("#paper-back");
      tf(back, { x: 14, y: -20, r: 2.6 });
      const pf = P(t, 118.55, 119.6, E.out);
      tf($("#paper2"), { y: lerp(-760, 8, pf), r: lerp(-4, 0, pf) });
      const tCarry = at("n27", "前の紙の上に") - 0.2;
      P2.forEach((fr, i) => {
        if (i < 3) { fillFrame(fr, 1); fr.classList.toggle("carry", t > tCarry); }
        else if (i < 6) { fillFrame(fr, 1); fr.classList.toggle("new", i === 3); }
        else fillFrame(fr, P(t, 126.9, 127.3, E.lin));
      });
      const p7 = P2[6].querySelector(".fc");
      typeIn(p7, PAPER2[6], P(t, 126.9, 127.5, E.lin));
      const pc = pop(t, at("n27", "2回目の紙") - 0.1, 0.4);
      tf($("#pill2"), { s: pc, o: Math.min(1, pc * 2) });
      op($("#back-tab"), P(t, 118.3, 118.7, E.lin));
      const ck = P(t, 125.1, 125.5, E.out) * (1 - P(t, 126.4, 126.8, E.io));
      tf($("#check2"), { y: 320 * (1 - ck) });
      $("#ck2-yes").style.transform = t > 126.05 && t < 126.3 ? "scale(.96)" : "none";
      const glow = P(t, 127.2, 128.4, E.io);
      $("#paper2").style.background = mixHex("FFFFFF", "FFF4DA", glow);
      $("#paper2").style.boxShadow = `0 0 0 ${(5 * glow).toFixed(1)}px rgba(240,190,94,${(0.6 * glow).toFixed(2)}), 0 6px 20px rgba(60,40,10,.14), 0 0 ${(40 * glow).toFixed(0)}px rgba(240,190,94,${(0.45 * glow).toFixed(2)})`;
    }

    tapAt(t, [
      [72.6, 120, 410], [80.9, 198, 803], [86.6, 120, 251], [91.6, 198, 330],
      [93.7, 198, 607], [TAP_EV(), 84, 402], [110.25, 198, 551], [117.75, 198, 771], [126.1, 198, 690],
    ]);
  }

  /* ------------------------------------------------------------------ */
  /* ⑤ Claudeにさせていること                                             */
  /* ------------------------------------------------------------------ */
  function r5(t) {
    const tB = S("n34") - 0.35;
    const pb = P(t, tB, tB + 0.8, E.io);
    tf($("#roles"), { x: lerp(280, -80, pb), y: 20 * pb, s: lerp(1, 0.8, pb) });
    const pf = pop(t, at("n29", "5つ") - 0.1, 0.4);
    tf($("#five"), { s: pf, o: Math.min(1, pf * 2) });
    const tr = [S("n30"), at("n30", "具体的か"), S("n31"), S("n32"), S("n33")];
    $$("#roles .role").forEach((el, k) => {
      const p = P(t, tr[k] - 0.15, tr[k] + 0.3, E.out);
      tf(el, { x: -30 * (1 - p), o: p });
    });
    const p1 = P(t, S("n34") - 0.05, S("n34") + 0.4, E.out);
    tf($("#principle .p1"), { y: 20 * (1 - p1), o: p1 });
    fadeUp($("#principle .p2"), t, at("n34", "決めるのは") - 0.1);
    fadeUp($("#chk"), t, S("n35") - 0.1);
    $$("#chk .nochip").forEach((el, k) => {
      const p = pop(t, at("n35", ["病名", "点数", "助言"][k]) - 0.05, 0.3);
      tf(el, { s: p, o: Math.min(1, p * 2) });
    });
    fadeUp($("#res"), t, at("n35", "出力も") + 0.3);
  }

  /* ------------------------------------------------------------------ */
  /* ⑥ 安全と、医療とのつながり                                            */
  /* ------------------------------------------------------------------ */
  const W6 = "もう何もかもつらい。眠れない日が、ずっと続いている";
  function r6(t) {
    fadeUp($("#safe-head"), t, S("n36") - 0.1);
    const ph = P(t, 158.0, 158.6, E.out);
    const side = P(t, S("n38") - 0.5, S("n38") + 0.35, E.io);   // 相談メモが出るとき左へ寄せる
    $("#phone6").style.transform = `translate(${(370 * (1 - side)).toFixed(1)}px,${(30 * (1 - ph)).toFixed(1)}px) scale(.86)`;
    op($("#phone6"), ph);
    typeIn($("#w6-txt"), W6, P(t, 158.6, 160.5, E.lin));
    const ts = at("n37", "深刻な内容") - 0.1;
    const sw = P(t, ts, ts + 0.45, E.io);
    op($("#scr-write6"), 1 - sw);
    tf($("#scr-safe"), { s: lerp(1.05, 1, sw), o: sw });
    const pm = P(t, S("n38") - 0.15, S("n38") + 0.45, E.out);
    tf($("#memo"), { x: 80 * (1 - pm), r: 2 * (1 - pm), o: pm });
    const sel = P(t, at("n38", "本人が選べば") - 0.1, at("n38", "本人が選べば") + 0.4, E.lin);
    $("#memo .m-sel").style.background = mixHex("F6F2EA", "D9ECE9", sel);
    op($("#tag6"), P(t, 158.5, 159.0));
  }

  /* ------------------------------------------------------------------ */
  /* ⑦ 締め                                                              */
  /* ------------------------------------------------------------------ */
  function buildEnd() {
    ["#ep1", "#ep2", "#ep2b"].forEach((s) => {
      $(s).innerHTML = Array.from({ length: 10 }, (_, i) => `<div class="ln${i % 3 === 2 ? " s" : ""}"></div>`).join("");
    });
  }
  function r7(t) {
    const out = P(t, 173.75, 174.3, E.io);
    const a = P(t, 170.05, 170.6, E.out), b = P(t, 170.35, 170.9, E.out);
    tf($("#ep1"), { y: 20 * (1 - a) - 30 * out, r: -2, o: a * (1 - out) });
    tf($("#ep2"), { y: 20 * (1 - b) - 30 * out, o: b * (1 - out) });
    tf($("#ep2b"), { x: 0, y: 20 * (1 - b) - 30 * out, r: 4, o: b * (1 - out) });
    $("#el1").style.transform = "translateX(-50%)";
    $("#el2").style.transform = "translateX(-50%)";
    op($("#el1"), P(t, 170.6, 171.0) * (1 - out));
    op($("#el2"), P(t, 170.9, 171.3) * (1 - out));
    const pa = P(t, at("n39", "続きが") - 0.4, at("n39", "続きが") + 0.4, E.io);
    draw($("#end-arrow-p"), pa);
    op($("#end-arrow-h"), P(t, at("n39", "続きが") + 0.25, at("n39", "続きが") + 0.4, E.lin));
    op($("#end-arrow"), Math.min(1, pa * 4) * (1 - out));
    tf($("#end-head"), { y: 16 * (1 - P(t, S("n39") - 0.1, S("n39") + 0.4, E.out)) - 30 * out, o: P(t, S("n39") - 0.1, S("n39") + 0.4, E.out) * (1 - out) });
    fadeUp($("#end-name"), t, S("n40") - 0.4);
    fadeUp($("#end-l1"), t, S("n40") - 0.1);
    fadeUp($("#end-l2"), t, S("n41") - 0.1);
    op($("#thanks"), P(t, En("n41") - 0.4, En("n41") + 0.2));
  }

  /* ------------------------------------------------------------------ */
  const SCENES = [
    ["#sc1", -1, 15.25, r1],
    ["#sc2", 14.95, 55.25, r2],
    ["#sc3", 54.95, 65.25, r3],
    ["#sc4", 64.95, 135.25, r4],
    ["#sc5", 134.95, 158.25, r5],
    ["#sc6", 157.95, 170.25, r6],
    ["#sc7", 169.95, 999, r7],
  ];

  // 字幕：ナレーションと同じ文。画面に同じ文が大きく出る所は出さない。
  const NOSUB = new Set(["n13", "n14", "n36", "n39", "n40", "n41"]);
  const CUES = [];
  TL.lines.forEach((l) => { if (!NOSUB.has(l.id)) l.subs.forEach((c) => CUES.push({ ...c })); });
  CUES.push({ start: En("n20") + 0.1, end: 88.7, text: "（いつ・どこで・最初の2分）", cls: "note" });
  CUES.sort((a, b) => a.start - b.start);
  CUES.forEach((c, i) => { const nx = CUES[i + 1]; c.show = Math.min(c.end + 0.4, nx ? nx.start - 0.02 : c.end + 0.4); });
  function rSub(t) {
    const c = CUES.find((c) => t >= c.start - 0.05 && t < c.show);
    const box = $("#sub"), span = box.querySelector("span");
    if (!c) { box.style.display = "none"; return; }
    box.style.display = "block";
    setText(span, c.text);
    span.className = c.cls || "";
  }

  function seek(t) {
    for (const [sel, a, b, fn] of SCENES) {
      const el = $(sel);
      const o = win(t, a, b, 0.3);
      if (o <= 0) { el.style.display = "none"; continue; }
      el.style.display = "block";
      op(el, o);
      fn(t);
    }
    rSub(t);
  }

  buildSheets();
  buildWorld();
  buildDemo();
  buildEnd();
  $("#cl1").style.top = "560px";
  $("#cl2").style.top = "660px";
  [["#gl-done", 480, 262], ["#gl-not", 1460, 262]].forEach(([s, cx, y]) => {
    const el = $(s); el.style.left = cx - 300 + "px"; el.style.top = y + "px"; el.style.width = "600px"; el.style.textAlign = "center";
  });

  window.seek = seek;
  window.ready = document.fonts.ready.then(() => { seek(0); return true; });

  // ブラウザで開いたときのプレビュー：?t=秒 でその場面、?play で音声つき再生
  const q = new URLSearchParams(location.search);
  if (q.has("t")) window.ready.then(() => seek(parseFloat(q.get("t"))));
  if (q.has("play")) {
    const audio = new Audio("build/narration.wav");
    const fit = () => { const s = Math.min(innerWidth / 1920, innerHeight / 1080); $("#stage").style.transform = `scale(${s})`; $("#stage").style.transformOrigin = "0 0"; };
    fit(); addEventListener("resize", fit);
    document.body.addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
    const loop = () => { seek(audio.currentTime + (parseFloat(q.get("from")) || 0) * 0); requestAnimationFrame(loop); };
    window.ready.then(() => { if (q.get("from")) audio.currentTime = parseFloat(q.get("from")); loop(); });
  }
})();
