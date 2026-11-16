# Earthtone

Buildless, browser-local Earth temperature sonification prototype. Serve `dist` with a static HTTP server. No dependencies or API keys required. Run `node check.cjs` for data/mapping checks.

NASA GISTEMP v4 snapshot downloaded November 14, 2026 from https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv . The app uses complete January–December annual means, 1880–2025. Values are Celsius anomalies relative to 1951–1980. Source attribution: GISTEMP Team, 2026, GISS Surface Temperature Analysis version 4; Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble, doi:10.1029/2023JD040179.

The listener chooses a lowest and a highest note (white piano keys from C2 to C7; default C3 to C5). The smallest value of a dataset plays the lowest note and the biggest plays the highest note: semitones above the lowest note = (value - min) / (max - min) * (highest - lowest), and frequency = 440 * 2^((note - 69) / 12). For temperature, min and max are the coolest and warmest years; for night lights and lightning they are 0% and 100%. Scale modes round to a major, minor or pentatonic scale that starts on the lowest note. The "How the sound is made" section on the page explains this rule for each dataset, filled in with the listener's own settings. Audio uses synthesized oscillators, not sampled physical instruments or recordings of the planet. Playback duration is the selected duration divided by speed. Preferences are saved only to localStorage. "Find your sound" asks six questions: instrument, lowest note, highest note, loudness, mood (scale) and length, each with a sample to hear first.

## Datasets

| Dataset | File | Source |
|---|---|---|
| Global temperature, 1880-2025 | `dist/gistemp.csv` | NASA GISTEMP v4 (above) |
| Earth at night, 2012-2023 | `dist/data/nightlights.json` | NASA SVS 5313, "Change in Night Lights between 2012 and 2023 - EIC Version" |
| Lightning seen from space, 2017-2023 | `dist/data/lightning.json` | NASA SVS 5011, "Lightning Events Detected from the ISS 2017-2023" |

The night lights and lightning numbers were measured from the colors of the NASA Earth Information Center movies. The scripts and the method are in `data-prep/` (see its README). Night lights compare every place with its own light in 2012: 2012 plays the middle note, twice as bright or more plays the highest note, half as bright or less the lowest note (the sound follows the number of doublings, log2 of the change). The Where menu shows each city's change since 2012 and groups the cities into brighter, darker and about the same. Lightning values are relative (0 to 1): each place is compared with its own stormiest month. Lightning places are the northern and southern halves (their storm seasons are opposite), rough continents made of whole 10 degree squares, and smaller areas of one 10 degree square each.

Night lights and lightning also show a flat world map for every step (`dist/data/maps/`, cut from the same NASA movies by `data-prep/tools/maps.py`). A ring marks the chosen place. Clicking the map picks the closest place; the Where menu does the same for keyboards. The map image has a short text description, so the sound and the numbers stay the main way to read the data.

For night lights, choosing a city zooms the map in on it (5 times, using the sharper 2048x1024 maps in `dist/data/maps/nightlights-hd/`); "Zoom in on ..." turns this on and off. "Show change since 2012" compares every pixel with the 2012 map: brighter by more than 10 out of 255 is purple, darker is orange (the same colors as NASA's change map), and the alt text says how the chosen city compares with 2012.

Each dataset is described in the `DATASETS` object at the top of `dist/app.js`. To add one, give it a `load()` that fills `places` with `{name, rows:[{label, spoken, value}]}`.

## Accessibility

Text size (Normal, Large, Extra large) is a switch at the top of the page and is remembered in the browser. All sizes in `style.css` are in rem, so text, buttons and menus grow together. Buttons are at least about 48 px tall.

The page is a single column, in the same order a screen reader reads it. The chart is a keyboard slider: arrow keys move one step, Page Up and Page Down ten steps, Home and End jump to the ends, Enter plays the current step. Clicking or dragging on the chart also plays each point.
