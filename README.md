# Earthtone

Buildless, browser-local Earth temperature sonification prototype. Serve `dist` with a static HTTP server. No dependencies or API keys required. Run `node check.cjs` for data/mapping checks.

NASA GISTEMP v4 snapshot downloaded November 14, 2026 from https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv . The app uses complete January–December annual means, 1880–2025. Values are Celsius anomalies relative to 1951–1980. Source attribution: GISTEMP Team, 2026, GISS Surface Temperature Analysis version 4; Lenssen et al. (2024), A GISTEMPv4 observational uncertainty ensemble, doi:10.1029/2023JD040179.

The pitch mapping is 220 * 2^(anomaly * semitonesPerDegree / 12). Scale modes quantize this interval. Audio uses synthesized oscillators, not sampled physical instruments or recordings of the planet. Playback duration is the selected duration divided by speed. Preferences are saved only to localStorage.

To substitute final challenge data, replace the CSV adapter in `load()` with records `{year,value}` and update metadata/baseline descriptions. Current visuals are a synchronized custom temperature chart, not official EIC frame playback. EIC frame alignment is a future integration and must use matching dates, units, and source provenance. This prototype is not a claim of full challenge compliance.
