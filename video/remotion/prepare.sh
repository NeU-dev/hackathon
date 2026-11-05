#!/usr/bin/env bash
# Remotion 版の素材を用意する。
#   ../setup.sh        フォントと音声モデルを取得
#   ../tts.py          ナレーションを合成（build/tts/*.wav, timeline.json）
#   ../align.py        文字ごとの時刻（build/captions.json）
#   ../gen_bgm.py      仮の BGM（numpy が必要）
# を実行して、結果を public/ と src/data/ に置く。
set -euo pipefail
cd "$(dirname "$0")"
V=..
"$V/setup.sh"
python3 "$V/tts.py"
python3 "$V/align.py"
mkdir -p public/fonts public/narration src/data
cp "$V"/assets/fonts/*.ttf public/fonts/
cp "$V"/build/tts/n*.wav public/narration/
cp "$V"/build/captions.json src/data/
cp "$V"/assets/noise.png public/
if [ ! -f public/bgm/pad.wav ] || [ ! -f public/bgm/arp.wav ]; then
  python3 "$V/gen_bgm.py"
fi
echo "ok"
