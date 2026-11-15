"""Write plain-English summaries of out/*.json and add a "facts" list to each file.

The summaries are for reading with a screen reader: short sentences, no tables.
Run after lightning.py and nightlights.py:  python3 tools/summarize.py
"""

import json
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "out"

# Rough names for 10 degree cells. A cell gets the closest name within 9 degrees.
REGIONS = [
    ("the Congo rainforest", -2, 23), ("Central Africa", 5, 22), ("Gabon and Cameroon", 0, 12),
    ("Nigeria and the Gulf of Guinea", 6, 6), ("southern Africa", -15, 27),
    ("East Africa", 0, 36), ("Madagascar", -19, 47),
    ("Colombia and Venezuela", 6, -72), ("the Amazon", -5, -62), ("southern Brazil and Argentina", -27, -55),
    ("the central United States", 38, -96), ("the southeastern United States", 33, -85),
    ("Mexico and Central America", 16, -92), ("the Caribbean", 18, -72),
    ("northern India and Bangladesh", 25, 85), ("South India", 13, 78), ("Pakistan", 30, 70),
    ("Southeast Asia (Thailand, Laos, Vietnam)", 16, 103), ("Indonesia and Malaysia", -2, 108),
    ("New Guinea", -5, 142), ("northern Australia", -15, 132), ("eastern Australia", -28, 150),
    ("southern China", 25, 112), ("eastern China", 33, 117), ("Japan", 36, 138),
    ("Europe", 47, 10), ("the Mediterranean", 38, 18), ("the Middle East", 30, 45), ("Russia", 55, 50),
    ("the western Pacific Ocean", 5, 150), ("the Indian Ocean", -10, 75), ("the Atlantic Ocean", 0, -30),
]


def cell_center(r, c):
    return 85 - r * 10, -175 + c * 10


def name_of(r, c):
    lat, lon = cell_center(r, c)
    best, dist = None, 1e9
    for name, la, lo in REGIONS:
        d = ((la - lat) ** 2 + (((lo - lon + 180) % 360) - 180) ** 2) ** 0.5
        if d < dist:
            best, dist = name, d
    if dist <= 9:
        return best
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"the area around {abs(lat)} {ns}, {abs(lon)} {ew}"


def grid(values):
    return np.array([[np.nan if v is None else v for v in row] for row in values], float)


def top_cells(g, n):
    order = np.argsort(-np.nan_to_num(g, nan=-1), axis=None)
    seen, out = set(), []
    for k in order:
        r, c = divmod(int(k), g.shape[1])
        name = name_of(r, c)
        if name in seen:
            continue
        seen.add(name)
        out.append((name, float(g[r, c])))
        if len(out) == n:
            break
    return out


def lightning():
    path = OUT / "lightning.json"
    d = json.loads(path.read_text())
    times, s = d["times"], d["summary"]["values"]
    season = d["averageYear"]["values"]
    top = top_cells(grid(d["averageMap"]["values"]), 6)
    busiest = times[int(np.argmax(s))]
    quietest = times[int(np.argmin(s))]
    months_sorted = sorted(season, key=season.get, reverse=True)

    facts = [
        f"The stormiest place on Earth in this data is {top[0][0]}.",
        f"Other lightning hot spots: {', '.join(n for n, _ in top[1:5])}.",
        f"Worldwide, the most lightning comes in {months_sorted[0]} and {months_sorted[1]}, during summer in the northern half of the world.",
        f"The quietest months are {months_sorted[-1]} and {months_sorted[-2]}.",
        f"The busiest single month was {busiest}. The quietest was {quietest}.",
        "Lightning is mostly over land, not over the ocean.",
        "The space station cannot see the far north or far south, so those areas have no data.",
    ]
    d["facts"] = facts
    path.write_text(json.dumps(d, separators=(",", ":")))

    lines = [
        "Lightning seen from the International Space Station, March 2017 to July 2023.",
        f"There is one map for each month: {len(times)} months.",
        "Numbers go from 0 (no lightning) to 1 (the busiest place in the busiest month).",
        "",
        "Key facts:",
        *[f"- {f}" for f in facts],
        "",
        "Average lightning in each month of the year, where 1 is the busiest month ever:",
        *[f"- {m}: {v:.2f}" for m, v in season.items()],
        "",
        "Stormiest places, average over all months, where 1 is the stormiest:",
        *[f"- {n}: {v:.2f}" for n, v in top],
        "",
        "Every month, all lightning added up:",
        *[f"- {t}: {v:.2f}" for t, v in zip(times, s)],
    ]
    (OUT / "lightning_summary.txt").write_text("\n".join(lines) + "\n")


def nightlights():
    path = OUT / "nightlights.json"
    d = json.loads(path.read_text())
    times, s = d["times"], d["summary"]["values"]
    places = d["places"]["values"]
    rise = round((s[-1] / s[0] - 1) * 100)
    brighter = sorted([p for p in places if p["changeFromYears"] is not None and p["changeFromYears"] > 0.15],
                      key=lambda p: -p["changeFromYears"])
    darker = sorted([p for p in places if p["changeFromYears"] is not None and p["changeFromYears"] < -0.1],
                    key=lambda p: p["changeFromYears"])
    top = top_cells(grid(d["values"][-1]), 5)
    v = d["validation"]

    facts = [
        f"Between 2012 and 2023, the Earth at night got about {rise} percent brighter.",
        f"The brightest areas in 2023: {', '.join(n for n, _ in top[:4])}.",
        "Cities in India got much brighter, as more homes and roads got electric light.",
        "Many cities in Western Europe got darker, partly because of new LED street lights and saving energy.",
        "Cities in Ukraine got darker after the war began in 2022. NASA's movie zooms in on Ukraine to show this.",
        "Damascus in Syria and Beirut in Lebanon got darker.",
        "Most of the oceans, deserts and rainforests stay dark all the time.",
    ]
    d["facts"] = facts
    path.write_text(json.dumps(d, separators=(",", ":")))

    def change_word(p):
        # Words come from our own 2012 vs 2023 comparison: it uses the same scale
        # everywhere. NASA's change map agrees on the direction (see validation),
        # but its colors are harder to turn into "how much".
        c = p["changeFromYears"]
        if c is None:
            return "no data"
        if c > 0.15:
            return "much brighter"
        if c > 0.03:
            return "a little brighter"
        if c < -0.15:
            return "much darker"
        if c < -0.03:
            return "a little darker"
        return "about the same"

    lines = [
        "Earth at night, 2012 to 2023, from NASA's Black Marble.",
        "There is one map for each year, and one map of change from 2012 to 2023.",
        "Numbers are relative. 1 is the brightest area in any year. 0 is dark.",
        "",
        "Key facts:",
        *[f"- {f}" for f in facts],
        "",
        "All light on Earth each year, where 1 is the brightest year:",
        *[f"- {t}: {x:.2f}" for t, x in zip(times, s)],
        "",
        "Cities, from 2012 to 2023:",
        *[f"- {p['name']}: {change_word(p)}." for p in places],
        "",
        "Got much brighter: " + "; ".join(p["name"] for p in brighter[:8]) + ".",
        "Got darker: " + "; ".join(p["name"] for p in darker) + ".",
        "",
        "Check of the numbers:",
        f"- NASA's change map and our own 2012 versus 2023 comparison agree on brighter or darker in {round(v['changeSignAgreement'] * 100)} percent of {v['cellsCompared']} areas.",
    ]
    (OUT / "nightlights_summary.txt").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    lightning()
    nightlights()
    print((OUT / "lightning_summary.txt").read_text())
    print((OUT / "nightlights_summary.txt").read_text())
