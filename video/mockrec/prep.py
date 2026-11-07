# -*- coding: utf-8 -*-
"""録画（public/mockrec/A|B/rec.json）に「そのコマで画面が動いたか」を足して、src/data/mockrecA|B.json に書く。
動いていないコマは動画の側で縮めたり伸ばしたりしても見た目が変わらないので、動きは等速のまま、止まっている所で時間を合わせられる。
使い方: python3 prep.py [A B]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "remotion", "public", "mockrec")
DATA = os.path.join(HERE, "..", "remotion", "src", "data")


def load(path):
    return np.asarray(Image.open(path).convert("L").resize((390, 790)), dtype=np.int16)


def main(which):
    for s in which:
        rec = json.load(open(os.path.join(PUB, s, "rec.json")))
        n = rec["frames"]
        counts = [0]
        prev = load(os.path.join(PUB, s, "m00000.jpg"))
        for i in range(1, n):
            im = load(os.path.join(PUB, s, "m%05d.jpg" % i))
            counts.append(int(np.count_nonzero(np.abs(im - prev) > 10)))
            prev = im
        # 20 画素より多く変わったら「動いた」（カーソルの点滅は数画素で、ここには入らない）
        act = "".join("1" if c > 20 else "0" for c in counts)
        rec["act"] = act
        rec["meta"] = "".join(str(m["kb"]) for m in rec["meta"])
        json.dump(rec, open(os.path.join(DATA, "mockrec%s.json" % s), "w"), ensure_ascii=False)
        print(s, n, "frames,", act.count("1"), "moving")


if __name__ == "__main__":
    main(sys.argv[1:] or ["A", "B"])
