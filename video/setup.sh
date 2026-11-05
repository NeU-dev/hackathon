#!/usr/bin/env bash
# フォントと音声モデルを取ってくる（リポジトリには入れていない大きいファイル）
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/fonts assets/voices
GF=https://raw.githubusercontent.com/google/fonts/main/ofl
[ -f assets/fonts/ZenMaruGothic-Medium.ttf ] || curl -fsSL -o assets/fonts/ZenMaruGothic-Medium.ttf "$GF/zenmarugothic/ZenMaruGothic-Medium.ttf"
[ -f assets/fonts/ZenMaruGothic-Bold.ttf ]   || curl -fsSL -o assets/fonts/ZenMaruGothic-Bold.ttf   "$GF/zenmarugothic/ZenMaruGothic-Bold.ttf"
[ -f assets/fonts/KleeOne-SemiBold.ttf ]     || curl -fsSL -o assets/fonts/KleeOne-SemiBold.ttf     "$GF/kleeone/KleeOne-SemiBold.ttf"
VO=https://raw.githubusercontent.com/icn-lab/htsvoice-tohoku-f01/master
[ -f assets/voices/tohoku-f01-neutral.htsvoice ] || curl -fsSL -o assets/voices/tohoku-f01-neutral.htsvoice "$VO/tohoku-f01-neutral.htsvoice"
[ -f assets/voices/tohoku-f01-COPYRIGHT.txt ]    || curl -fsSL -o assets/voices/tohoku-f01-COPYRIGHT.txt    "$VO/COPYRIGHT.txt"
echo "ok"
