"""Turn NASA SVS 5313 (Change in Night Lights 2012-2023, EIC version) into numbers.

Input:  raw/nightlights_eic.mp4   (7680x2160, 30 fps, the EIC video wall version)
Output: out/nightlights.json

What is in the movie
- Frames 0-285: one map per year, 2012 to 2023, with the year written in the middle.
  The year label changes at frames 15, 33, 51, 69, 86, 104, 122, 139, 157, 175, 193.
  We use the middle frame of each year.
- From about frame 300: the change map, 2012 to 2023. Orange means "lights out",
  white "no change", purple "new lights". Frame 450 is used (before the zoom boxes).
- Later frames add zoom boxes (India, Ukraine, Western Europe, Eastern Mediterranean);
  they are not used.

Map geometry
- The 7680 px wide frame holds the same world map twice, side by side (3840 px each).
- Each copy is a flat latitude/longitude map covering 90 N to 90 S, stretched from 2:1
  to 3840x2160 (10.67 px per degree across, 12 px per degree down). The left edge is
  168.75 W. Found by locating the lights of 26 cities (Sydney, Cape Town, Moscow,
  Anchorage, ...) and fitting straight lines: most cities land within 0.3 degrees
  (Singapore 1.2, where nearby cities pull the bright spot).
- The year label and the color bar sit in the middle of the frame, so for the right
  part of the left copy (x >= 3400) we read the same place from the right copy instead.

From colors to numbers
- Yearly maps: the base map (land, ice) is never brighter than about 35, while lights go
  up to 255. Per pixel, "base" is the darkest it gets in any year, capped at 40, and
  "light" is brightness minus base. Each 10 degree cell adds up the light of its pixels.
- Change map: a lit pixel's color is a color bar color made darker. We compare its
  normalized color (divided by its brightest channel) to the color bar and get a score
  from -1 (lights out) to +1 (new lights). A cell's score is the average weighted by
  how bright each pixel is.

All values are relative. They tell "brighter or darker", not watts or people.
"""

import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MOVIE = ROOT / "raw" / "nightlights_eic.mp4"
OUT = ROOT / "out"

FRAME_W, FRAME_H = 7680, 2160
COPY_W = 3840
SWAP_X = 3400                  # use the right copy from here on, to skip the text
LON_LEFT, LAT_TOP, LAT_BOTTOM = -168.75, 90.0, -90.0
YEAR_FRAMES = {2012: 7, 2013: 24, 2014: 42, 2015: 60, 2016: 77, 2017: 95,
               2018: 113, 2019: 130, 2020: 148, 2021: 166, 2022: 184, 2023: 240}
CHANGE_FRAME = 450
BAR_Y, BAR_X0, BAR_X1 = 1231, 3766, 4367
COLS, ROWS = 36, 18
BASE_CAP = 40
LIT = 20                        # light above base that counts as "lit" for the change map
BOX = 0.75                      # half size of a place box, in degrees

# Places for quizzes and stories. Several match NASA's zoom boxes in the movie.
PLACES = [
    ("Kyiv, Ukraine", 50.45, 30.52), ("Kharkiv, Ukraine", 49.99, 36.23),
    ("Mariupol, Ukraine", 47.10, 37.55), ("Moscow, Russia", 55.76, 37.62),
    ("Paris, France", 48.86, 2.35), ("London, UK", 51.51, -0.13),
    ("Madrid, Spain", 40.42, -3.70), ("Milan, Italy", 45.46, 9.19),
    ("Delhi, India", 28.61, 77.21), ("Mumbai, India", 19.08, 72.88),
    ("Bengaluru, India", 12.97, 77.59), ("Patna, India", 25.59, 85.14),
    ("Cairo, Egypt", 30.04, 31.24), ("Aleppo, Syria", 36.20, 37.13),
    ("Damascus, Syria", 33.51, 36.28), ("Beirut, Lebanon", 33.89, 35.50),
    ("Tel Aviv, Israel", 32.09, 34.78),
    ("Taipei, Taiwan", 25.03, 121.57), ("Kaohsiung, Taiwan", 22.63, 120.30),
    ("Tokyo, Japan", 35.68, 139.69), ("Shanghai, China", 31.23, 121.47),
    ("Lagos, Nigeria", 6.52, 3.38), ("Nairobi, Kenya", -1.29, 36.82),
    ("New York, USA", 40.71, -74.01), ("Houston, USA", 29.76, -95.37),
    ("Sao Paulo, Brazil", -23.55, -46.63), ("Sydney, Australia", -33.87, 151.21),
]


def read_frames(indices):
    sel = "+".join(f"eq(n\\,{i})" for i in sorted(indices))
    cmd = ["ffmpeg", "-v", "error", "-i", str(MOVIE), "-vf", f"select='{sel}'",
           "-vsync", "vfr", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, FRAME_H, FRAME_W, 3)
    return dict(zip(sorted(indices), frames))


def one_world(frame):
    world = frame[:, :COPY_W].copy()
    world[:, SWAP_X:] = frame[:, COPY_W + SWAP_X:]
    return world


def cell_index():
    """Cell number (row * COLS + col) for every pixel of one world copy."""
    y = np.arange(FRAME_H) + 0.5
    x = np.arange(COPY_W) + 0.5
    lat = LAT_TOP - y / FRAME_H * (LAT_TOP - LAT_BOTTOM)
    lon = (LON_LEFT + x / COPY_W * 360 + 180) % 360 - 180
    row = np.clip(((90 - lat) // 10).astype(int), 0, ROWS - 1)
    col = np.clip(((lon + 180) // 10).astype(int), 0, COLS - 1)
    return (row[:, None] * COLS + col[None, :]).ravel()


def box_pixels(lat, lon):
    """Row and column numbers of one world copy inside a box around (lat, lon)."""
    def y_of(la):
        return int((LAT_TOP - la) / (LAT_TOP - LAT_BOTTOM) * FRAME_H)
    def x_of(lo):
        return int(((lo - LON_LEFT) % 360) / 360 * COPY_W)
    ys = np.arange(max(y_of(lat + BOX), 0), min(y_of(lat - BOX), FRAME_H - 1) + 1)
    xs = np.arange(x_of(lon - BOX), x_of(lon + BOX) + 1) % COPY_W
    return ys, xs


def per_cell(values, cells):
    return np.bincount(cells, weights=values.ravel(), minlength=ROWS * COLS).reshape(ROWS, COLS)


def to_list(grid, digits=4):
    return [[None if np.isnan(v) else round(float(v), digits) for v in row] for row in grid]


def main():
    OUT.mkdir(exist_ok=True)
    frames = read_frames(list(YEAR_FRAMES.values()) + [CHANGE_FRAME])
    cells = cell_index()

    # ---- yearly light ----
    lum = {y: one_world(frames[i]).astype(np.float32).mean(axis=2) for y, i in YEAR_FRAMES.items()}
    base = np.minimum(np.min(np.stack(list(lum.values())), axis=0), BASE_CAP)
    light = {y: np.clip(l - base, 0, None) for y, l in lum.items()}
    grids = {y: per_cell(l, cells) for y, l in light.items()}
    peak = max(g.max() for g in grids.values())
    years = sorted(grids)
    values = [to_list(grids[y] / peak) for y in years]
    totals = np.array([grids[y].sum() for y in years])

    # ---- change map ----
    bar = frames[CHANGE_FRAME][BAR_Y, BAR_X0:BAR_X1 + 1].astype(np.float32)
    bar_norm = bar / bar.max(axis=1, keepdims=True)
    bar_score = np.linspace(-1, 1, len(bar))
    world = one_world(frames[CHANGE_FRAME]).astype(np.float32)
    clum = world.mean(axis=2)
    lit = (clum - base) > LIT
    px = world[lit]
    px_norm = px / px.max(axis=1, keepdims=True)
    # nearest color bar entry, in chunks to save memory
    score = np.empty(len(px_norm), np.float32)
    for s in range(0, len(px_norm), 200_000):
        chunk = px_norm[s:s + 200_000]
        d = ((chunk[:, None, :] - bar_norm[None, :, :]) ** 2).sum(axis=2)
        score[s:s + 200_000] = bar_score[d.argmin(axis=1)]
    weight = clum[lit] - base[lit]
    lit_cells = cells[lit.ravel()]
    wsum = np.bincount(lit_cells, weights=weight, minlength=ROWS * COLS)
    ssum = np.bincount(lit_cells, weights=weight * score, minlength=ROWS * COLS)
    with np.errstate(invalid="ignore", divide="ignore"):
        change = (ssum / wsum).reshape(ROWS, COLS)
    change[wsum.reshape(ROWS, COLS) < 2000] = np.nan   # too little light to judge

    # ---- cross-check: change map vs. yearly maps ----
    g12, g23 = grids[2012], grids[2023]
    with np.errstate(invalid="ignore", divide="ignore"):
        ratio = (g23 - g12) / (g23 + g12)            # -1..+1
    both = ~np.isnan(change) & ((g12 + g23) > 2000)
    agree = float(np.mean(np.sign(ratio[both]) == np.sign(change[both])))
    corr = float(np.corrcoef(ratio[both], change[both])[0, 1])
    ratio[(g12 + g23) <= 2000] = np.nan

    # ---- named places: a small box (about 1.5 x 1.5 degrees) around each city ----
    # 10 degree cells mix countries together (the Kyiv cell is mostly Russia),
    # so the stories in NASA's zoom boxes need a closer look.
    lit_score = np.full(lit.shape, np.nan, np.float32)
    lit_score[lit] = score
    place_out = []
    for name, lat, lon in PLACES:
        ys, xs = box_pixels(lat, lon)
        series = [float(light[y][np.ix_(ys, xs)].sum()) for y in years]
        w = (clum - base)[np.ix_(ys, xs)]
        s = lit_score[np.ix_(ys, xs)]
        ok = ~np.isnan(s)
        ch = float((w[ok] * s[ok]).sum() / w[ok].sum()) if ok.sum() > 20 else None
        top = max(series) or 1
        place_out.append({
            "name": name, "lat": lat, "lon": lon,
            "light": [round(v / top, 3) for v in series],
            "lightNote": "1 is this place's brightest year",
            "change": None if ch is None else round(ch, 3),
            "changeFromYears": round((series[-1] - series[0]) / (series[-1] + series[0]), 3)
                               if series[-1] + series[0] > 0 else None,
        })

    data = {
        "id": "nightlights",
        "title": "Earth at night, 2012-2023",
        "whatHighMeans": "more light at night (cities, roads, industry)",
        "units": "relative: 1 is the brightest cell in any year, 0 is dark",
        "times": [str(y) for y in years],
        "timeStep": "year",
        "grid": {"cellDegrees": 10, "rows": ROWS, "cols": COLS,
                 "row0": "90N to 80N", "col0": "180W to 170W",
                 "nullMeans": "not used for yearly values (dark cells are 0)"},
        "values": values,
        "summary": {"description": "all light on Earth each year, 1 is the brightest year",
                    "values": [round(float(t / totals.max()), 4) for t in totals]},
        "change": {
            "description": "NASA's change map 2012 to 2023: -1 lights out, 0 no change, +1 new lights. null where there is too little light to judge",
            "values": to_list(change),
        },
        "changeFromYears": {
            "description": "the same idea computed from the 2012 and 2023 maps: (2023 - 2012) / (2023 + 2012). Used to cross-check the change map",
            "values": to_list(ratio),
        },
        "places": {
            "description": "small boxes (about 1.5 x 1.5 degrees) around cities; light is per place, change is from NASA's change map",
            "values": place_out,
        },
        "validation": {
            "changeSignAgreement": round(agree, 3),
            "changeCorrelation": round(corr, 3),
            "cellsCompared": int(both.sum()),
            "method": "compare the sign and the correlation of 'change' and 'changeFromYears' in cells with enough light",
        },
        "source": {
            "visualization": "NASA Scientific Visualization Studio 5313, Change in Night Lights between 2012 and 2023 - EIC Version",
            "url": "https://svs.gsfc.nasa.gov/5313/",
            "data": "NASA Black Marble (VNP46), Suomi NPP VIIRS",
        },
        "method": __doc__.strip(),
    }
    (OUT / "nightlights.json").write_text(json.dumps(data, separators=(",", ":")))
    print("years", years)
    print("summary", data["summary"]["values"])
    print("validation", data["validation"])
    for p in place_out:
        print(f"{p['name']:22s} change={p['change']} fromYears={p['changeFromYears']} light={p['light'][0]}->{p['light'][-1]}")


if __name__ == "__main__":
    main()
