"""Make small flat world maps (pictures) for the website, one per time step.

Run after lightning.py and nightlights.py:  python3 tools/maps.py
Output: out/maps/nightlights/<year>.jpg and out/maps/lightning/<yyyy-mm>.jpg

Every map is 1024x512, equirectangular: the left edge is 180 W, the top is 90 N.
So a place is at x = (lon + 180) / 360 * 1024, y = (90 - lat) / 180 * 512.
The pictures are NASA SVS movie frames, only cut, moved and made smaller.
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lightning as L      # noqa: E402
import nightlights as N    # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "out" / "maps"
SIZE = (1024, 512)
QUALITY = 80


def save(pixels, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).resize(SIZE, Image.LANCZOS).save(path, quality=QUALITY, optimize=True)


def nightlights():
    frames = N.read_frames(N.YEAR_FRAMES.values())
    shift = round((N.LON_LEFT + 180) / 360 * N.COPY_W)   # 120 px: move 180 W to the left edge
    for year, i in N.YEAR_FRAMES.items():
        world = np.roll(N.one_world(frames[i]), shift, axis=1)
        save(world, OUT / "nightlights" / f"{year}.jpg")
    print("night lights:", len(N.YEAR_FRAMES), "maps")


def lightning():
    dates = L.read_labels()
    stamps = np.array([d.timestamp() for d in dates])
    picks = {}
    for (y, m), targets in L.month_targets():
        j = int(np.abs(stamps - targets[0].timestamp()).argmin())
        if abs(dates[j] - targets[0]) <= L.MAX_DATE_MISS:
            picks[j] = f"{y}-{m:02d}"
    sel = "+".join(f"eq(n\\,{i})" for i in sorted(picks))
    w, h = 2048, 1024
    cmd = ["ffmpeg", "-v", "error", "-i", str(L.MOVIE), "-vf", f"select='{sel}',scale={w}:{h}",
           "-vsync", "vfr", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    for frame, i in zip(frames, sorted(picks)):
        save(frame, OUT / "lightning" / f"{picks[i]}.jpg")
    print("lightning:", len(picks), "maps")


if __name__ == "__main__":
    nightlights()
    lightning()
