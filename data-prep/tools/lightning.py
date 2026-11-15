"""Turn NASA SVS 5011 (ISS lightning, Science On a Sphere flat movie) into numbers.

Input:  raw/iss_lightning_sos_yearly_07312023_2048p60.mp4  (4096x2048, equirectangular)
        raw/labels.txt                                      (one date per movie frame)
Output: out/lightning.json, out/lightning_per_frame.csv

How it works
1. ffmpeg decodes every frame, scaled to 2160x1080, and pipes the pixels to Python.
2. A pixel is "lightning" when it is yellow: red and green high, blue low.
   The grey map, the dashed tropic lines and the text are never yellow.
3. The SVS page says "10-day roving window", but measuring the movie shows that a
   dot stays on screen for about 30 days: the overlap between a frame and the
   frame N days later falls from 97% (1 day) to 80% (10 days), 41% (20 days) and
   11% (30 days). After the data ends, the map takes about a month to go dark.
   So one frame shows roughly the last month of lightning, and for every month we
   use the frame whose date is closest to the last day of that month.
4. Yellow pixels are counted in 10 degree cells (36 columns x 18 rows).
   The ISS only sees between about 55 N and 55 S, so cells outside are null.

The numbers are relative: "how many yellow pixels", not "how many flashes".
Dense storms overlap on the map, so very busy cells are undercounted a little.
"""

import json
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import calendar

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MOVIE = ROOT / "raw" / "iss_lightning_sos_yearly_07312023_2048p60.mp4"
LABELS = ROOT / "raw" / "labels.txt"
OUT = ROOT / "out"

W, H = 2160, 1080      # 60 px per 10 degree cell
COLS, ROWS = 36, 18
COVERAGE_LAT = 55          # ISS lightning sensor sees roughly 55 N to 55 S
FIRST_MONTH = (2017, 3)
LAST_MONTH = (2023, 7)     # movie ends 31 Jul 2023 (the last frames fade out)
MAX_DATE_MISS = timedelta(days=3)


def read_labels():
    dates = []
    for line in LABELS.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        d = datetime.strptime(line, "%d %b %Y %H:%M")
        if d.year == 2003:  # typo in labels.txt: the 2023 frames are labelled 2003
            d = d.replace(year=2023)
        dates.append(d)
    return dates


def yellow_mask(frame):
    r = frame[..., 0].astype(np.int16)
    g = frame[..., 1].astype(np.int16)
    b = frame[..., 2].astype(np.int16)
    return (r > 110) & (g > 90) & ((r + g) // 2 - b > 60)


def frame_counts():
    """Yield (frame index, 18x36 yellow pixel counts) for every frame."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(MOVIE), "-vf", f"scale={W}:{H}",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    size = W * H * 3
    with subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=size * 2) as p:
        i = 0
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            mask = yellow_mask(frame)
            counts = mask.reshape(ROWS, H // ROWS, COLS, W // COLS).sum(axis=(1, 3))
            yield i, counts
            i += 1


def month_targets():
    y, m = FIRST_MONTH
    while (y, m) <= LAST_MONTH:
        last = calendar.monthrange(y, m)[1]
        yield (y, m), [datetime(y, m, last, 23, 59)]
        m += 1
        if m == 13:
            y, m = y + 1, 1


def row_lat(row):
    return 90 - (row + 0.5) * 180 / ROWS


def main():
    OUT.mkdir(exist_ok=True)
    dates = read_labels()

    # Which frame is closest to each target time?
    wanted = {}
    plan = {}
    stamps = np.array([d.timestamp() for d in dates])
    for month, targets in month_targets():
        picks = []
        for t in targets:
            j = int(np.abs(stamps - t.timestamp()).argmin())
            ok = abs(dates[j] - t) <= MAX_DATE_MISS
            picks.append(j if ok else None)
            if ok:
                wanted[j] = None
        plan[month] = picks

    per_frame = []
    for i, counts in frame_counts():
        if i < len(dates):
            per_frame.append((i, dates[i], int(counts.sum())))
        if i in wanted:
            wanted[i] = counts
    print(f"decoded {len(per_frame)} frames")

    covered = np.array([abs(row_lat(r)) <= COVERAGE_LAT for r in range(ROWS)])
    months, grids, totals, missing = [], [], [], []
    for (y, m), picks in plan.items():
        good = [wanted[j] for j in picks if j is not None and wanted.get(j) is not None]
        label = f"{y}-{m:02d}"
        months.append(label)
        if len(good) < len(picks):
            missing.append(label)
        if not good:
            grids.append(None)
            totals.append(None)
            continue
        g = good[0].astype(float)
        grid = [[(round(float(g[r, c]), 1) if covered[r] else None) for c in range(COLS)]
                for r in range(ROWS)]
        grids.append(grid)
        totals.append(round(float(g[covered].sum()), 1))

    # Relative scale 0..1 so the sound engine does not need to know pixel counts
    peak_cell = max(v for grid in grids if grid for row in grid for v in row if v is not None)
    peak_total = max(t for t in totals if t is not None)
    norm_grids = [None if grid is None else
                  [[None if v is None else round(v / peak_cell, 4) for v in row] for row in grid]
                  for grid in grids]
    norm_totals = [None if t is None else round(t / peak_total, 4) for t in totals]

    # Average year: which months have the most lightning?
    by_cal_month = defaultdict(list)
    for label, t in zip(months, norm_totals):
        if t is not None and label not in missing:
            by_cal_month[int(label[5:])].append(t)
    seasonal = {calendar.month_name[k]: round(float(np.mean(v)), 3)
                for k, v in sorted(by_cal_month.items())}

    # Long-term map: mean over all complete months
    stack = np.array([[[np.nan if v is None else v for v in row] for row in grid]
                      for grid, label in zip(grids, months) if grid and label not in missing])
    mean_map = np.nanmean(stack, axis=0)
    mean_map = mean_map / np.nanmax(mean_map)
    mean_grid = [[None if np.isnan(v) else round(float(v), 4) for v in row] for row in mean_map]

    data = {
        "id": "lightning",
        "title": "Lightning seen from the International Space Station, 2017-2023",
        "whatHighMeans": "more lightning",
        "units": "relative: 1 is the busiest cell in any month, 0 is no lightning seen",
        "times": months,
        "timeStep": "month",
        "grid": {"cellDegrees": 10, "rows": ROWS, "cols": COLS,
                 "row0": "90N to 80N", "col0": "180W to 170W",
                 "nullMeans": "outside the area the sensor can see (beyond about 55N or 55S), or no data"},
        "timeNote": "each month is the movie frame at the end of that month; dots stay on screen about 30 days, so it is roughly that month's lightning",
        "values": norm_grids,
        "summary": {"description": "all lightning in the visible area each month, 1 is the busiest month",
                    "values": norm_totals},
        "averageMap": {"description": "average over all months, 1 is the stormiest cell",
                       "values": mean_grid},
        "averageYear": {"description": "average of each calendar month, same scale as summary",
                        "values": seasonal},
        "incompleteMonths": missing,
        "source": {
            "visualization": "NASA Scientific Visualization Studio 5011, Lightning Events Detected from the ISS 2017-2023",
            "url": "https://svs.gsfc.nasa.gov/5011/",
            "data": "Quality Controlled Lightning Imaging Sensor (LIS) on ISS Science Data, NASA GHRC DAAC",
        },
        "method": __doc__.strip(),
    }
    (OUT / "lightning.json").write_text(json.dumps(data, separators=(",", ":")))

    with open(OUT / "lightning_per_frame.csv", "w") as f:
        f.write("frame,date,yellow_pixels\n")
        for i, d, n in per_frame:
            f.write(f"{i},{d:%Y-%m-%d %H:%M},{n}\n")

    print("months", len(months), "incomplete", missing)


if __name__ == "__main__":
    main()
