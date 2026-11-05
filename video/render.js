// 使い方:
//   node render.js stills 3,12.5,30        … 指定秒の静止画を build/stills/ に書き出す
//   node render.js video                   … 3分の mp4 を build/ に書き出す（4並列）
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const BUILD = path.join(HERE, "build");
const URL = "file://" + path.join(HERE, "index.html");
const FPS = 30;
const DURATION = 180;
const WORKERS = parseInt(process.env.WORKERS || "4", 10);

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
  await page.goto(URL);
  await page.evaluate(() => window.ready);
  return page;
}

async function stills(times) {
  const dir = path.join(BUILD, "stills");
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser);
  for (const t of times) {
    await page.evaluate((t) => window.seek(t), t);
    const f = path.join(dir, `t${String(t.toFixed(2)).padStart(6, "0")}.png`);
    await page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log(f);
  }
  await browser.close();
}

async function chunk(browser, from, to, out) {
  const page = await openPage(browser);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c)))));
  for (let i = from; i < to; i++) {
    await page.evaluate((t) => window.seek(t), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((i - from) % 300 === 0) console.log(`frames ${from}-${to}: ${i - from}/${to - from}`);
  }
  ff.stdin.end();
  await done;
  await page.close();
}

async function video() {
  const total = DURATION * FPS;
  const per = Math.ceil(total / WORKERS);
  const browser = await chromium.launch();
  const parts = [];
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const from = w * per, to = Math.min(total, from + per);
    const out = path.join(BUILD, `part${w}.mp4`);
    parts.push(out);
    jobs.push(chunk(browser, from, to, out));
  }
  await Promise.all(jobs);
  await browser.close();
  const list = path.join(BUILD, "parts.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  const silent = path.join(BUILD, "video_silent.mp4");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);
  const out = path.join(BUILD, "hackathon_v4_draft.mp4");
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", path.join(BUILD, "narration.wav"),
    "-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ac", "2",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
  console.log(out);
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(cmd + " " + c))));
  });
}

const [mode, arg] = process.argv.slice(2);
if (mode === "stills") stills(arg.split(",").map(Number)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "video") video().catch((e) => { console.error(e); process.exit(1); });
else { console.log("usage: node render.js stills 1,2,3 | video"); process.exit(1); }
