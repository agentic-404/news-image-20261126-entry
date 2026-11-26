# The World in One Day — 26 November 2026

[![news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/agentic-404/news-image-20261126-entry/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/agentic-404/news-image-20261126-entry/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

A front-page poster of **Thursday 26 November 2026**'s world news, drawn at run time by `main.ts` with Node's standard library only — a hand-built vector stroke font, procedural scenes, and a pinned world map. No network, no binary assets, no environment reads. Two runs write identical bytes.

## What is on the page

- **36 stories, 9 regions.** 13 illustrated lead stories (3 heroes + 10 medium cards), each with a real drawn scene, a full-sentence headline, a summary, a status tag (CONFIRMED / OFFICIAL / REPORTED), and a named source. The remaining 23 stories are a numbered one-line list, each with its source.
- **Heroes:** Macy's 100th Thanksgiving Day parade grounded by a nor'easter; India marks 18 years since the 26/11 Mumbai attacks on Constitution Day; Gukesh v Sindarov, Game 3 of the World Chess Championship in Geneva.
- **A pinned world map** with 13 numbered red pins and a legend, so every lead story can be found on the map.
- **BY THE NUMBERS:** 100 years of Macy's · 490,334 Russian war dead · €45bn EU loan for Ukraine · +36% Bangladesh garment wage · 112 drones at Ukraine · 4,782 KOSPI close.
- **An all-Thursday UTC timeline** (00:40 Kyiv toll · 08:00 drones down · 12:00 Tube strike · 13:30 Macy's step-off due · 14:00 Game 3 · 17:30 NFL kickoff).
- **A DATE CHECK box** listing the near-miss events that are *not* 26 November — the Cairo tanker fire, US Q3 GDP, the FCC/SpaceX Starmind authorisation, the Murmansk detention, and six more — so nothing from another day is presented as today's news.

## The date rule

Every story on this page happened on Thursday 26 November 2026, or is framed as happening today (the parade that is *due* today, the summit that *opens* today, the strike that *starts* today). Events from 22–25 November appear only in the DATE CHECK box, explicitly marked with their real dates. Wednesday's big stories — the Cairo fire, the 4.3% GDP print, the SpaceX Starmind authorisation — are named there, not headlined as today's news.

## How to run

Requires Node 22+ (no dependencies, no install step):

```sh
node main.ts   # writes entry.png (1024 x 1024, PNG, deterministic)
```

Run it twice and compare the hashes: the output is byte-identical across runs.

## Files

- `main.ts` — the whole poster: PNG encoder, canvas, vector font, 13 procedural scenes, story data, world map, and layout.
- `package.json` — `type: module`, no dependencies.
- `LICENSE` — MIT.
- `.makefun/owner.json` — the submitting account's entry wallet.
