# Earth Jukebox data preparation

Turns two NASA Scientific Visualization Studio movies into numbers.
The results are in `out/` (see `out/README.md`).

| Dataset | NASA page | Script |
|---|---|---|
| Lightning from the ISS, 2017-2023 | https://svs.gsfc.nasa.gov/5011/ | `tools/lightning.py` |
| Night lights, 2012-2023, and their change | https://svs.gsfc.nasa.gov/5313/ | `tools/nightlights.py` |

## Rebuild

Needs Python 3 with `numpy`, and `ffmpeg`.

```
mkdir -p raw
curl -L -o raw/iss_lightning_sos_yearly_07312023_2048p60.mp4 https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4
curl -L -o raw/labels.txt https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/labels.txt
curl -L -o raw/nightlights_eic.mp4 https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4
python3 tools/lightning.py      # about 30 seconds
python3 tools/nightlights.py    # about 10 seconds
python3 tools/summarize.py      # writes the sentence summaries and the facts
python3 tools/maps.py           # flat map pictures, one per year or month (out/maps/), plus 2048x1024 night lights in out/maps/nightlights-hd/
```

Then copy the results into the website:

```
cp out/lightning.json out/nightlights.json ../dist/data/
cp -R out/maps ../dist/data/
```

`raw/` holds the downloads (about 440 MB, including test images) and is not meant to be shared.

## What we found while making the numbers

Lightning (SVS 5011)
- The Science On a Sphere movie is a true 2:1 latitude/longitude map, so pixels map straight to places.
- `labels.txt` has a typo: frames from 2023 are labelled 2003. The script fixes it.
- The page says "10-day roving window", but a dot stays on screen for about 30 days
  (measured: 80% of dots are still there after 10 days, 11% after 30 days).
  So we use one frame per month, at the end of the month.
- Numbers are yellow pixel counts, made relative. They are not flash counts.
- Check: the stormiest places are the Congo basin, Central Africa, Colombia and the
  central United States, and the peak is in northern summer. This matches what lightning
  scientists report from the same instrument.

Night lights (SVS 5313)
- The EIC movie is 7680x2160 with the world shown twice. Each copy covers 90 N to 90 S,
  stretched to 16:9. We fitted the position of 26 cities; most land within 0.3 degrees.
- Yearly maps: light = brightness above the base map (land and ice are never brighter than about 35 out of 255).
- Change map: each lit pixel's color is matched to the color bar (orange = lights out, purple = new lights).
- Check: NASA's change map and our 2012 vs 2023 comparison agree on brighter or darker
  in 92% of the 123 squares with enough light (correlation 0.78).
- Known stories show up: Ukraine and Syria darker, India much brighter, Western Europe a little darker.
