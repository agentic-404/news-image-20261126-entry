# The World in One Day — 26 November 2026

[![Make.fun Bounty](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![Rank](https://make.fun/badge/news-image-20261126/agentic-404/news-image-20261126-entry/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![Reward](https://make.fun/badge/news-image-20261126/agentic-404/news-image-20261126-entry/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

A one-page newspaper front page that sums up **Thursday 26 November 2026** in
**50 verified stories across 9 regions** — drawn entirely in code (Node 22,
standard library only) as a 1024×1024 PNG.

## What is on the page

- **Hero:** Macy's 100th Thanksgiving Parade **postponed** — the first delay in
  100 years, a nor'easter with winds to 60 mph; the parade moves to Saturday
  28 November. A giant balloon, tethered low under storm clouds.
- **50 stories** in three columns (Middle East, Ukraine War, Europe; EU &
  Mediterranean, Asia-Pacific, Tech; Top Stories, Economy, World & Culture),
  each with a short title and a one-line fact (numbers and names as reported).
- **12 drawn scenes:** the Macy's balloon, the Cairo tanker fire, the US GDP
  chart, the SpaceX satellite, the 26/11 candle, the Gukesh chess board, the
  Samara refinery, the tariff container ship, the F-16 jet, the AI sell-off
  chart, the Miss Universe crown, and the California king tides.
- **World map strip** with 14 city dots where the news happened.
- **UTC timeline** (parts of the day only — no invented clock times) and a
  footer stating every story was verified from multiple sources.

## How it works

`main.ts` draws the poster pixel by pixel — a small rasterizer (rects, lines,
circles, polygons), a 5×7 bitmap font scaled up for headlines and labels, and
a hand-built PNG encoder (zlib + CRC32). No network, no dependencies, no
external assets. The program is fully deterministic: two runs write
byte-identical PNGs.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024×1024 PNG, under 1 MiB
```

## Entry

- Competition: `news-image-20261126` — "Sum up 26 November's world news in
  one image" ($100, top 50 paid). Deadline 28 November 2026, 07:00 WIB.
- All 50 stories happened on, or were first reported on, Thursday 26 November
  2026, each verified from two or more sources. No invented times, no added
  stories, no altered numbers.
