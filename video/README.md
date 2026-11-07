# 発表動画（3分）の仮動画

台本「ハッカソン発表原稿 v5（上司に相談できない／紙の問題）」から作った、差し替え前提の仮動画です（初見で分かりにくい所を直した最新版の台本に合わせています）。
画面の動き・字幕・仮ナレーション・効果音・仮の BGM が、台本の時間割どおりに入っています。

本体は `remotion/`（Remotion で作った版）です。Remotion 公式の Agent Skills（remotion-dev/skills）の書き方に沿っています。
`index.html`・`scenes.js`・`render.js` は台本 v4 のころの HTML 版で、いまは更新していません（ナレーション定義が v5 になったため、そのままでは動きません。v4 の HTML 版はコミット 9f7ffd3 にあります）。

## 作り直す

```sh
cd remotion
npm i
./prepare.sh                         # 素材を用意（ナレーション合成・文字の時刻・BGM・フォント）
blender -b -P ../blender/wall_scene.py -- render   # 壁の場面（3D）のコマを描く（1時間ほど。描いたコマは飛ばす）
npx remotion studio                  # プレビュー（音つきで再生・コマ送りできる）
npx remotion render HackathonV4 out/video.mp4 --concurrency=4
```

書き出したあと、音量をそろえる場合:

```sh
ffmpeg -i out/video.mp4 -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k out/video_final.mp4
```

この作業環境では Remotion 同梱ブラウザの配布元に届かないため、`remotion.config.ts` で入っている Chrome Headless Shell を指定しています。手元のパソコンで使うときは、その1行（`Config.setBrowserExecutable(...)`）を消してください。

必要なもの: `open_jtalk`（`apt install open-jtalk open-jtalk-mecab-naist-jdic`）、ffmpeg、Node.js、Python（BGM の合成に numpy）、Blender 4.x（壁の場面。画面のない Linux では EEVEE のために Mesa の EGL も要る）。
Blender を使わない場合は `src/Video.tsx` の `WALL_3D` を `false` にすると、壁の場面が2Dの図（`World.tsx`）に戻ります。

## しくみ

| 部分 | 中身 |
| --- | --- |
| ナレーション | `narration.py` の文を `tts.py` が Open JTalk で合成し、台本の時間枠に並べる（`text` が字幕、`tts` が読み） |
| 文字ごとの時刻 | `align.py` が音素の時刻から、字幕の文字ごとの読み上げ時刻を出す（`build/captions.json`）。字幕と画面の動きはこれに合わせる |
| 字幕 | 読まれた所から白くなる。文節に近いまとまりで改行。データは @remotion/captions の Caption 形式 |
| 場面 | `remotion/src/scenes/`。TransitionSeries でつなぐ。動きは spring と Easing.bezier |
| 壁の場面（3D） | ②動機と③の「重さ」。②の終わりは日常の側から壁を見上げ、困りごとの札・壁の貼り紙（受けられる場所が限られる／順番待ち）・扉の前の列・「？」を重ねる。`blender/wall_scene.py` が壁・扉・人・紙のシートを組み、3D の中で動きがあるコマだけを EEVEE で描く（`remotion/public/wall3d/`）。止まっているコマは直前の絵を使い、Remotion 側でゆっくり寄る。紙のシートの四隅の画面上の位置を `src/data/wall3d.json` に書き出し、手順の図は `Wall3D.tsx` が遠近を合わせて（matrix3d）紙に重ねる |
| 強調 | @remotion/rough-notation の手描き風マーカー |
| 音 | 効果音（Kenney の CC0 音源）と仮の BGM（`gen_bgm.py` で合成。D メジャー・100BPM の明るい曲で、和音・粒の音・軽いリズムの3本）。BGM は話しているあいだ下がり、③の「重さ」と⑤の「止まる」で少し引き、意思の文・④・動けた場面で一番濃くなる |

## 文を直すとき

- ナレーションと字幕の文: `narration.py` を直して `./remotion/prepare.sh`（または `python3 tts.py && python3 align.py` のあと、`build/tts/*.wav` と `build/captions.json` を remotion にコピー）
- パートの時間枠: `narration.py` の `SECTIONS`
- 画面の動き: `remotion/src/scenes/*.tsx`。言葉の時刻は `at("n28", "締切")` のように、文の ID と言葉で引く
- ②③の文の時刻が変わったとき: 壁の場面のコマも描き直す（`blender -b -P blender/wall_scene.py -- render force`）。見た目だけ確かめるときは `-- look 27,31,50` で、その秒の静止画を `build/wall_look/` に出す

## 差し替えるもの（画面に札が出ています）

| 場所 | いまの中身 | 差し替え |
| --- | --- | --- |
| ③ 紙の問題 | 描いた10枚のシート | 実物の10枚（職場・人名を塗りつぶし）の撮影 |
| ④ コンセプト・⑤ 通知・⑥ 締め | 【アプリ名】 | 決まったアプリ名 |
| ⑤ デモ | 仮のアプリ画面（台本の「画面録画で入力する内容」どおり） | iPhone の画面録画 |
| 全編 | 合成音声（Open JTalk） | 本人の声で録り直す。`build/subtitles.srt` の時刻が目安 |

①のチャット画面と、⑤の最後の「送れた」チャットは、実在の名前を出さない作り物です。

## 時間割

台本 v5 の表をもとにしています（①0:00〜0:15、②〜1:01、③〜1:34、④〜1:43.5、⑤〜2:41、⑥〜3:00）。③の最後に応募者としての意思の二文（誰にでも届けたい／向き合うハードルを低くしたい）を入れ、そのぶん②の「認知行動療法の一つ、」を削り、③の最初の二文を一文にまとめました。
④にアプリの一言が入ったので、④を約 2.5 秒延ばしました。②③の余りと⑤の間（ま）を少しずつ詰めて、そのぶんを作っています。
⑤は文字数が多く、合成音声は 1.25〜1.28 倍速です。本人の声で録るときは、⑤が一番早口になります。⑥の安全の文は声に出さず、画面の小さな注記だけにしています。

## 素材のライセンス

- 音声: HTS voice tohoku-f01（東北大学 伊藤・能勢研究室、CC BY 4.0）`assets/voices/tohoku-f01-COPYRIGHT.txt`。この音声を本番で使う場合はクレジットを入れる
- フォント: Zen Maru Gothic、Klee One（SIL Open Font License）
- 効果音: Kenney（www.kenney.nl）の Interface Sounds・Casino Audio・Impact Sounds（CC0）。soundcn 経由で取得。`remotion/public/sfx/`
- BGM: `gen_bgm.py` で合成した仮の曲（差し替え推奨）
