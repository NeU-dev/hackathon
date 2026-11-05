# 発表動画 v4（3分）の仮動画

台本「ハッカソン発表原稿 v4（一つの困りごとを追う）」の修正版（動機を一本の線にした版）から作った、差し替え前提の仮動画（Vコンテ）です。
画面の動き・字幕・仮ナレーションが台本の時間割どおりに入っています。
v3 の台本で作った版は git の履歴（コミット 40943ee）に残っています。

- 出力: `build/hackathon_v4_draft.mp4`（1920×1080、30fps、3:00）
- 字幕ファイル: `build/subtitles.srt`（編集ソフトで使う場合）
- ナレーションだけ: `build/narration.wav`

## Remotion 版（完成度を上げた版）

`remotion/` は同じ台本を Remotion（React で動画を作る仕組み）で作り直したものです。Remotion 公式の Agent Skills（remotion-dev/skills）の書き方に沿っています。

| HTML 版との違い | 中身 |
| --- | --- |
| 音 | 効果音（タップ・通知・紙を置く音・スタンプ・できた音。Kenney の CC0 音源）と、仮の BGM（`gen_bgm.py` で合成）。BGM は話しているあいだ自動で下がり、止まる場面では分散和音が消え、動けた場面で一番濃くなる |
| 字幕 | 音素の時刻から文字ごとの読み上げ時刻を出し（`align.py`）、読まれた文字から白くなる。文節に近いまとまりで改行。データは @remotion/captions の Caption 形式 |
| 同期 | 画面の動きも同じ文字ごとの時刻に合わせた（これまでは文字数の比で推定） |
| 動き | Remotion の spring と Easing.bezier で作り直した。場面は TransitionSeries でつなぐ |
| 強調 | @remotion/rough-notation の手描き風マーカー（2週間／書いただけで終わった／当事者の私／5分以内／名前だけ／もう一度／本人／続きが書ける） |

```sh
cd remotion
npm i
./prepare.sh                         # 素材を用意（ナレーション合成・文字の時刻・BGM・フォント）
npx remotion studio                  # プレビュー（音つきで再生・コマ送りできる）
npx remotion render HackathonV4 out/video.mp4 --concurrency=4
```

この作業環境では Remotion 同梱ブラウザの配布元に届かないため、`remotion.config.ts` で入っている Chrome Headless Shell を指定しています。手元のパソコンで使うときは、その1行（`Config.setBrowserExecutable(...)`）を消してください。

## 作り直す（HTML 版）

```sh
./setup.sh                # フォントと音声モデルを取得（リポジトリには入れていない）
python3 tts.py            # ナレーション合成 → build/timeline.json, narration.wav, subtitles.srt
node render.js stills 12,45,100   # 指定秒の静止画を build/stills/ に
node render.js video      # 3分の mp4 を書き出し（4並列、数分）
```

ブラウザで `index.html?play` を開き、画面をクリックすると音声つきで再生できます（`&from=60` で途中から）。
`index.html?t=45` はその秒の1コマを表示します。

必要なもの: `open_jtalk`（`apt install open-jtalk open-jtalk-mecab-naist-jdic`）、ffmpeg、Node.js + Playwright。

## 文を直すとき

- ナレーションと字幕の文: `narration.py`（`text` が字幕、`tts` が読み）
- パートの時間枠: `narration.py` の `SECTIONS`
- 画面の動き: `scenes.js`（文の時刻に合わせて動くので、文を直しても大きくはずれません）

## 映像の作り（台本 v4 の「映像の直し方」への対応）

| 台本の指示 | 仮動画 |
| --- | --- |
| スマホ画面を大きくする | 画面の高さいっぱい（約1040px）。記録カード・下書き・場面の3か所でさらに寄る |
| 横の段階リストを残し、少し大きくする | 右の列に残し、文字を大きくした。寄っているあいだだけ消える |
| Claudeのラベルは動いている所に重ねる | 問いかける／これまでの紙を読む／あなたの言葉のまま、小さくする、をその画面の横に出す |
| 字幕を重ねすぎない | 引用・数字の字幕はなし。デモ中の字幕は右の列に出し、スマホに重ねない |
| ①と⑥は同じ書類を映す | ①は未開封の封筒、動けたあとと締めは、封をした返信用封筒 |

## 差し替えるもの（画面に札が出ています）

| 場所 | いまの中身 | 差し替え |
| --- | --- | --- |
| ① 困りごと | 描いた机と封筒 | 住所変更の書類（実物か、個人情報のない小道具）の撮影 |
| ③ 当事者にしか分からない | 描いた10枚のシート | 実物の10枚（職場・人名を塗りつぶし）の撮影 |
| ④ コンセプト・⑥ 締め | 【アプリ名】 | 決まったアプリ名 |
| ⑤ デモ | 仮のアプリ画面 | iPhoneの画面録画（入力・待ち時間は早送り） |
| ⑤ 動けた | 「名前を書いたら、そのまま最後まで書けました。」と封をした封筒 | 実際にやれた場合だけ使う。できていなければ「2回目は、ここから始まります」で終える |
| ⑥ 安全 | 仮の相談先画面・相談メモ | 実物の画面 |
| 全編 | 合成音声（Open JTalk） | 本人の声で録り直す。`build/subtitles.srt` の時刻が目安 |

## 時間割

台本 v4 の表どおりです（①0:00〜0:12、②0:12〜0:47、③0:47〜1:08、④1:08〜1:17、⑤1:17〜2:30、⑥2:30〜3:00）。
②③は文字数が多いため、合成音声は1.2倍速で読んでいます。本人の声で録るときは、ここが一番早口になります。

## 素材のライセンス

- 音声: HTS voice tohoku-f01（東北大学 伊藤・能勢研究室、CC BY 4.0）`assets/voices/tohoku-f01-COPYRIGHT.txt`。この音声を本番で使う場合はクレジットを入れる
- フォント: Zen Maru Gothic、Klee One（SIL Open Font License）
- 効果音: Kenney（www.kenney.nl）の Interface Sounds・Casino Audio・Impact Sounds（CC0）。soundcn 経由で取得。`remotion/public/sfx/`
- BGM: `gen_bgm.py` で合成した仮の曲（差し替え推奨）
