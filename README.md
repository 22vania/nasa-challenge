# Earthtone

Buildless, browser-local Earth temperature sonification prototype. Serve `dist` with a static HTTP server. No dependencies or API keys required. Run `node check.cjs` for data/mapping checks.

NASA GISTEMP v4 snapshot downloaded November 14, 2026 from https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv . The app uses complete January–December annual means, 1880–2025. Values are Celsius anomalies relative to 1951–1980. Source attribution: GISTEMP Team, 2026, GISS Surface Temperature Analysis version 4; Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble, doi:10.1029/2023JD040179.

The pitch mapping is 220 * 2^(anomaly * semitonesPerDegree / 12). Scale modes quantize this interval. Audio uses synthesized oscillators, not sampled physical instruments or recordings of the planet. Playback duration is the selected duration divided by speed. Preferences are saved only to localStorage.

## Datasets

| Dataset | File | Source |
|---|---|---|
| Global temperature, 1880-2025 | `dist/gistemp.csv` | NASA GISTEMP v4 (above) |
| Earth at night, 2012-2023 | `dist/data/nightlights.json` | NASA SVS 5313, "Change in Night Lights between 2012 and 2023 - EIC Version" |
| Lightning seen from space, 2017-2023 | `dist/data/lightning.json` | NASA SVS 5011, "Lightning Events Detected from the ISS 2017-2023" |

The night lights and lightning numbers were measured from the colors of the NASA Earth Information Center movies. The scripts and the method are in `data-prep/` (see its README). Their values are relative (0 to 1): each place is compared with its own brightest year or stormiest month. For these datasets, 220 Hz is the middle of the range, and the pitch increment is the number of semitones from the middle to the peak.

Night lights and lightning also show a flat world map for every step (`dist/data/maps/`, cut from the same NASA movies by `data-prep/tools/maps.py`). A ring marks the chosen place. Clicking the map picks the closest place; the Where menu does the same for keyboards. The map image has a short text description, so the sound and the numbers stay the main way to read the data.

"Listen across the map" turns the map into sound for people who cannot see it: 36 notes, one for each 10 degree strip of longitude, from west to east in about 6 seconds. Higher notes mean more light or lightning in that strip, almost empty strips are silent, and stereo panning moves from the left ear (the Americas) to the right ear (Asia and Australia). At the end, the caption names the three loudest areas.

Each dataset is described in the `DATASETS` object at the top of `dist/app.js`. To add one, give it a `load()` that fills `places` with `{name, rows:[{label, spoken, value}]}`.

## Accessibility

The page is a single column, in the same order a screen reader reads it. The chart is a keyboard slider: arrow keys move one step, Page Up and Page Down ten steps, Home and End jump to the ends, Enter plays the current step. Clicking or dragging on the chart also plays each point.
