# Data for Earth Jukebox

Two datasets, made from NASA videos. Start with the summary files: they are plain sentences.

| File | What it is |
|---|---|
| `lightning_summary.txt` | Lightning, in sentences. Read this first. |
| `nightlights_summary.txt` | Night lights, in sentences. Read this first. |
| `lightning.json` | Lightning numbers for the website |
| `nightlights.json` | Night light numbers for the website |
| `maps/` | Flat world map pictures: `maps/nightlights/2012.jpg`, `maps/lightning/2017-03.jpg`. 1024x512, left edge 180 W, top 90 N. |
| `lightning_per_frame.csv` | Every movie frame and its amount of lightning (for checking only) |

## Both JSON files have the same shape

- `title`: a name to show or read aloud.
- `whatHighMeans`: what a high number means, for example "more lightning".
- `units`: all numbers are relative, from 0 to 1. They tell "more or less", not an amount.
- `times`: the list of times. Lightning has months ("2017-03"), night lights has years ("2012").
- `values`: one world map per time. `values[t][row][col]`.
  - The world is cut into 10 degree squares: 18 rows and 36 columns.
  - Row 0 is the far north (90 N to 80 N). Row 17 is the far south.
  - Column 0 starts at 180 W (the Pacific). Column 18 starts at 0 (London).
  - `null` means no data.
- `summary.values`: one number per time for the whole world. This is the easiest thing to play as a melody.
- `facts`: short true sentences, ready for quiz questions and the tutorial.
- `source`: where the data comes from. Show it on the About page.
- `method`: how the numbers were made.

To find the square for a place:

```
row = floor((90 - latitude) / 10)
col = floor((longitude + 180) / 10)
```

Taiwan (24 N, 121 E): row 6, column 30.

## Extra parts

Lightning:
- `averageMap`: one map, the average over all months. Good for "where are the storms?"
- `averageYear`: the average for each month of the year, January to December. Good for "when are the storms?"
- `incompleteMonths`: months with missing frames (none at the moment).

Night lights:
- `change`: NASA's change map from 2012 to 2023. -1 is lights out, 0 no change, +1 new lights.
- `changeFromYears`: the same idea, computed from the 2012 and 2023 maps. Use it for "how much".
- `places`: about 27 cities, each with its own light for every year and its change.
  The 10 degree squares mix countries together, so use `places` for city stories
  (for example Kyiv, Delhi, Paris, Taipei).
- `validation`: how well the two change maps agree.

## Load it in the website

```js
const lightning = await fetch("data/lightning.json").then(r => r.json());
console.log(lightning.times.length, "months");
console.log(lightning.summary.values);   // one number per month
```

## Things to know before you design sounds

- Lightning has a strong yearly rhythm: more in June to August, less in December to February.
  It sounds like seasons, not like a trend.
- Night lights go up slowly: the whole Earth is about 27 percent brighter in 2023 than in 2012.
  Some cities go up a lot (India), some go down (Ukraine, Syria, Western Europe).
- The space station cannot see beyond about 55 N and 55 S, so lightning has no data near the poles.
