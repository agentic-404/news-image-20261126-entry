// news-image-20261126 r1 — "The World in One Day"
// A Node 22 stdlib-only program that draws a 1024x1024 newspaper front page
// summing up Thursday 26 November 2026 in 50 verified stories, and writes it
// to $MAKEFUN_OUTPUT_DIR/entry.png (fallback /output). Deterministic: two runs
// write byte-identical PNGs. No network, no dependencies, no external assets.
//
// The poster is drawn pixel by pixel: a small rasterizer (rects, lines, circles,
// polygons), a 5x7 bitmap font scaled up, and a hand-built PNG encoder
// (zlib + CRC32). Everything in this file was written fresh in this session.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// PNG encoder (RGB, 8-bit, no interlace). Deterministic by construction.
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // One scanline per row: filter byte 0 (None) + width*3 bytes.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const src = y * width * 3;
    const dst = y * (1 + width * 3);
    raw[dst] = 0;
    raw.set(rgb.subarray(src, src + width * 3), dst + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Rasterizer: an RGB pixel buffer with rects, lines, circles, polygons.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 231]; // cream newsprint
const PAPER2: RGB = [238, 231, 214]; // slightly darker cream (panels)
const INK: RGB = [24, 24, 22];
const INK_SOFT: RGB = [74, 70, 62];
const RED: RGB = [178, 34, 28];
const BLUE: RGB = [28, 68, 128];
const BLUE_SOFT: RGB = [96, 128, 170];
const GOLD: RGB = [196, 148, 44];
const GREEN: RGB = [46, 110, 62];
const SKY: RGB = [168, 196, 220];
const SKY_DARK: RGB = [120, 152, 186];
const SEA: RGB = [188, 206, 214];
const LAND: RGB = [214, 206, 182];
const WHITE: RGB = [255, 255, 255];
const ORANGE: RGB = [214, 108, 32];
const FIRE: RGB = [232, 84, 24];

class Canvas {
  w: number;
  h: number;
  buf: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 3] = bg[0];
      this.buf[i * 3 + 1] = bg[1];
      this.buf[i * 3 + 2] = bg[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
    }
  }
  // Frame: 1px outline.
  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }
  hline(x: number, y: number, w: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: RGB): void {
    this.rect(x, y, 1, h, c);
  }
  // Bresenham line.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  // Thick line (draws a small square at each step).
  thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const half = Math.floor(t / 2);
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.rect(x - half, y - half, t, t, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.px(cx + x, cy + y, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      this.px(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  // Filled triangle.
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
        const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
        const cc = 1 - a - b;
        if (a >= 0 && b >= 0 && cc >= 0) this.px(x, y, c);
      }
    }
  }
  // Filled polygon (even-odd scanline fill).
  poly(points: [number, number][], c: RGB): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(this.w - 1, Math.floor(xs[k + 1])); x++) {
          this.px(x, y, c);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph: 7 rows of 5 bits ("1" = ink). Space = blank.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  "á": ["00010", "00100", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "00010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
  q: ["00000", "00000", "01111", "10001", "01111", "00001", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "–": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "×": ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
};

// Draw one glyph at (x, y) top-left, scaled by integer s. Returns advance width.
function drawGlyph(cv: Canvas, ch: string, x: number, y: number, s: number, c: RGB): number {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "1") cv.rect(x + col * s, y + r * s, s, s, c);
    }
  }
  return 6 * s; // 5px glyph + 1px gap, scaled
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s) cx += drawGlyph(cv, ch, cx, y, scale, c);
  return cx;
}

function drawTextCentered(cv: Canvas, s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Wrap text into lines that fit maxW (at given scale). Greedy by words.
function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// The 50 verified stories of Thursday 26 November 2026.
// Titles are <= 23 chars; the sub-line carries the key number/name.
// Scene tags mark the 11 small drawn scenes in the grid (hero Macy's = 12th).
// ---------------------------------------------------------------------------

type Story = { t: string; s: string; scene?: string };

type ColSection = { head: string; stories: Story[] };

const COL_A: ColSection[] = [
  {
    head: "MIDDLE EAST",
    stories: [
      { t: "Houthis hit Ras Tanura", s: "Saudi refinery strike" },
      { t: "Missiles over Riyadh", s: "Air defences intercept" },
      { t: "Iran warns Hormuz ships", s: "Mine reports in strait" },
      { t: "Libya vows retaliation", s: "After Ukraine ship strike" },
      { t: "Gaza strike kills many", s: "Apartment block hit" },
      { t: "Storm threatens 1.76M", s: "Palestinians in shelters" },
    ],
  },
  {
    head: "UKRAINE WAR",
    stories: [
      { t: "Ukraine hits Samara oil", s: "2 refineries, 5 jets hit", scene: "refinery" },
      { t: "Russia hits power grid", s: "5 regions lose power" },
      { t: "Peace talks stall", s: "Russia holds land claims" },
      { t: "NATO: prepare for war", s: "Chief warns all Europe" },
      { t: "Poland: down missiles", s: "Asks NATO over Ukraine" },
    ],
  },
  {
    head: "EUROPE",
    stories: [
      { t: "UK hides jets in hangar", s: "Fear of drone strikes" },
      { t: "Murmansk governor held", s: "Corruption, 2 months" },
      { t: "Eagle's Nest rebuilt", s: "Hitler retreat, after fire" },
      { t: "Knesset OKs Oct 7 probe", s: "Commission to investigate" },
      { t: "Puigdemont back Dec 12", s: "Catalonia leader back" },
      { t: "Estonia seals border", s: "Russia boundary closed" },
    ],
  },
];

const COL_B: ColSection[] = [
  {
    head: "EU & MEDITERRANEAN",
    stories: [
      { t: "EU halts Russian papers", s: "Schengen passport ban" },
      { t: "Sánchez defends record", s: "Podcast, vote, TikTok probe" },
      { t: "France: not our war", s: "Riner on Ukraine war" },
      { t: "Lebanon's 2nd airport", s: "New terminal in north" },
      { t: "Bulgaria stops boat", s: "First illegal craft seized" },
    ],
  },
  {
    head: "ASIA-PACIFIC",
    stories: [
      { t: "India marks 26/11", s: "18 yrs since Mumbai attacks", scene: "candle" },
      { t: "Gukesh–Sindarov Game 3", s: "World Chess, 1–1, Geneva", scene: "chess" },
      { t: "US tariffs hit India", s: "25%, New Delhi rejects" },
      { t: "Kim wants more nukes", s: "Tactical weapons call" },
      { t: "N. Korea expels envoy", s: "Swiss diplomat, sanctions" },
      { t: "China got Nvidia chips", s: "Despite US export rules" },
      { t: "1,700 Indians deported", s: "From US since January" },
      { t: "Turkey F-16s in Somalia", s: "Jets deployed to Mogadishu", scene: "jet" },
    ],
  },
  {
    head: "TECH",
    stories: [
      { t: "US tariffs: 14 nations", s: "EU, China, Japan, Taiwan", scene: "ship" },
      { t: "Nvidia CEO broke code", s: "Conduct breach, sources" },
      { t: "AI bot threatened a man", s: "Gemini screenshot viral" },
      { t: "Black Friday cyber risk", s: "Small firms uninsured" },
    ],
  },
];

const COL_C: ColSection[] = [
  {
    head: "TOP STORIES",
    stories: [
      { t: "Cairo tanker fire", s: "31 killed, 21 hurt, 27 cars", scene: "fire" },
      { t: "US GDP jumps to 4.3%", s: "Fastest in 3 years", scene: "chartUp" },
      { t: "FCC OKs 1M SpaceX sats", s: "Orbital AI data centres", scene: "satellite" },
    ],
  },
  {
    head: "ECONOMY",
    stories: [
      { t: "AI sell-off hits stocks", s: "S&P, Dow in correction", scene: "chartDown" },
      { t: "Oil edges down", s: "Supply beats Mideast fears" },
      { t: "US inflation 3.8% Oct", s: "PCE, the Fed's gauge" },
    ],
  },
  {
    head: "WORLD & CULTURE",
    stories: [
      { t: "Andy Taylor dies at 65", s: "Duran Duran guitarist" },
      { t: "Birthright order halted", s: "2nd judge halts Trump" },
      { t: "Cult leader convicted", s: "New charges, 200-yr term" },
      { t: "Miss Universe 2026", s: "Barreto, first married winner", scene: "crown" },
      { t: "Army blasts 4,500 kg", s: "Iowa TNT, 'huge success'" },
      { t: "California king tides", s: "Thanksgiving flood warning", scene: "wave" },
      { t: "Trump traded Nvidia 44x", s: "Accounts, this year" },
      { t: "Jolie, Pitt settle case", s: "Winery battle ends" },
      { t: "Ship off Finland", s: "Russian cargo, Zelenskyy" },
    ],
  },
];

function countStories(cols: ColSection[][]): number {
  let n = 0;
  for (const col of cols) for (const sec of col) n += sec.stories.length;
  return n;
}

// ---------------------------------------------------------------------------
// Drawn scenes. Each small icon draws inside an s x s box at (x, y).
// The hero balloon scene is drawn large in the hero band.
// ---------------------------------------------------------------------------

function iconFire(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.poly(
    [
      [x + 10 * u, y + 1 * u],
      [x + 15 * u, y + 8 * u],
      [x + 18 * u, y + 13 * u],
      [x + 14 * u, y + 19 * u],
      [x + 6 * u, y + 19 * u],
      [x + 2 * u, y + 13 * u],
      [x + 5 * u, y + 8 * u],
    ],
    FIRE
  );
  cv.poly(
    [
      [x + 10 * u, y + 8 * u],
      [x + 13 * u, y + 12 * u],
      [x + 12 * u, y + 18 * u],
      [x + 8 * u, y + 18 * u],
      [x + 7 * u, y + 12 * u],
    ],
    GOLD
  );
}

function iconChart(cv: Canvas, x: number, y: number, s: number, up: boolean, c: RGB): void {
  const u = s / 20;
  cv.rect(x + 2 * u, y + 17 * u, 16 * u, 1.5 * u, INK);
  cv.rect(x + 2 * u, y + 2 * u, 1.5 * u, 16 * u, INK);
  const pts: [number, number][] = up
    ? [
        [x + 3 * u, y + 15 * u],
        [x + 8 * u, y + 11 * u],
        [x + 12 * u, y + 12 * u],
        [x + 17 * u, y + 4 * u],
      ]
    : [
        [x + 3 * u, y + 5 * u],
        [x + 8 * u, y + 9 * u],
        [x + 12 * u, y + 8 * u],
        [x + 17 * u, y + 16 * u],
      ];
  cv.thickLine(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 2, c);
  cv.thickLine(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 2, c);
  cv.thickLine(pts[2][0], pts[2][1], pts[3][0], pts[3][1], 2, c);
  // Arrowhead at the end.
  const [ax, ay] = pts[3];
  if (up) {
    cv.tri(ax, ay, ax - 4 * u, ay + 1 * u, ax - 1 * u, ay + 4 * u, c);
  } else {
    cv.tri(ax, ay, ax - 4 * u, ay - 1 * u, ax - 1 * u, ay - 4 * u, c);
  }
}

function iconSatellite(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.rect(x + 3 * u, y + 8 * u, 5 * u, 4 * u, BLUE); // left panel
  cv.rect(x + 12 * u, y + 8 * u, 5 * u, 4 * u, BLUE); // right panel
  cv.rect(x + 8 * u, y + 7 * u, 4 * u, 6 * u, INK); // body
  cv.rect(x + 9 * u, y + 5 * u, 2 * u, 2 * u, GOLD); // antenna tip
  cv.rect(x + 4 * u, y + 9.5 * u, 3 * u, 1 * u, WHITE);
  cv.rect(x + 13 * u, y + 9.5 * u, 3 * u, 1 * u, WHITE);
}

function iconCandle(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.rect(x + 8 * u, y + 8 * u, 4 * u, 11 * u, WHITE);
  cv.frame(x + 8 * u, y + 8 * u, 4 * u, 11 * u, INK_SOFT);
  cv.poly(
    [
      [x + 10 * u, y + 1 * u],
      [x + 13 * u, y + 6 * u],
      [x + 7 * u, y + 6 * u],
    ],
    GOLD
  );
  cv.rect(x + 6 * u, y + 19 * u, 8 * u, 1 * u, INK_SOFT);
}

function iconChess(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  const cell = 4.5 * u;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const col = (r + c) % 2 === 0 ? INK : PAPER2;
      cv.rect(x + 1 * u + c * cell, y + 1 * u + r * cell, cell, cell, col);
    }
  }
  cv.frame(x + 1 * u, y + 1 * u, 4 * cell, 4 * cell, INK);
}

function iconJet(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.poly(
    [
      [x + 18 * u, y + 9 * u],
      [x + 2 * u, y + 7 * u],
      [x + 6 * u, y + 10 * u],
      [x + 2 * u, y + 13 * u],
    ],
    INK_SOFT
  );
  cv.tri(x + 9 * u, y + 10 * u, x + 12 * u, y + 3 * u, x + 13 * u, y + 10 * u, INK_SOFT);
  cv.tri(x + 9 * u, y + 10 * u, x + 12 * u, y + 17 * u, x + 13 * u, y + 10 * u, INK_SOFT);
}

function iconShip(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.poly(
    [
      [x + 2 * u, y + 13 * u],
      [x + 18 * u, y + 13 * u],
      [x + 15 * u, y + 18 * u],
      [x + 5 * u, y + 18 * u],
    ],
    RED
  );
  cv.rect(x + 4 * u, y + 9 * u, 4 * u, 4 * u, BLUE);
  cv.rect(x + 9 * u, y + 9 * u, 4 * u, 4 * u, GOLD);
  cv.rect(x + 14 * u, y + 9 * u, 3 * u, 4 * u, GREEN);
  cv.rect(x + 16 * u, y + 5 * u, 2 * u, 4 * u, INK_SOFT);
}

function iconRefinery(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.rect(x + 3 * u, y + 8 * u, 3 * u, 11 * u, INK_SOFT);
  cv.rect(x + 8 * u, y + 5 * u, 3 * u, 14 * u, INK_SOFT);
  cv.rect(x + 13 * u, y + 10 * u, 4 * u, 9 * u, INK_SOFT);
  cv.circle(x + 9.5 * u, y + 3 * u, 2 * u, FIRE);
  cv.rect(x + 2 * u, y + 19 * u, 16 * u, 1 * u, INK_SOFT);
}

function iconCrown(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  cv.poly(
    [
      [x + 2 * u, y + 15 * u],
      [x + 2 * u, y + 6 * u],
      [x + 6 * u, y + 11 * u],
      [x + 10 * u, y + 3 * u],
      [x + 14 * u, y + 11 * u],
      [x + 18 * u, y + 6 * u],
      [x + 18 * u, y + 15 * u],
    ],
    GOLD
  );
  cv.rect(x + 2 * u, y + 16 * u, 16 * u, 3 * u, GOLD);
  cv.circle(x + 10 * u, y + 12 * u, 1.5 * u, RED);
}

function iconWave(cv: Canvas, x: number, y: number, s: number): void {
  const u = s / 20;
  for (let i = 0; i < 3; i++) {
    const y0 = y + (6 + i * 5) * u;
    for (let xx = 0; xx <= 18 * u; xx += 1) {
      const yy = y0 + Math.sin((xx / (18 * u)) * Math.PI * 2) * 1.5 * u;
      cv.rect(x + xx, yy, 1.5, 1.5, BLUE);
    }
  }
}

function drawSceneIcon(cv: Canvas, kind: string, x: number, y: number, s: number): void {
  switch (kind) {
    case "fire":
      iconFire(cv, x, y, s);
      break;
    case "chartUp":
      iconChart(cv, x, y, s, true, GREEN);
      break;
    case "chartDown":
      iconChart(cv, x, y, s, false, RED);
      break;
    case "satellite":
      iconSatellite(cv, x, y, s);
      break;
    case "candle":
      iconCandle(cv, x, y, s);
      break;
    case "chess":
      iconChess(cv, x, y, s);
      break;
    case "jet":
      iconJet(cv, x, y, s);
      break;
    case "ship":
      iconShip(cv, x, y, s);
      break;
    case "refinery":
      iconRefinery(cv, x, y, s);
      break;
    case "crown":
      iconCrown(cv, x, y, s);
      break;
    case "wave":
      iconWave(cv, x, y, s);
      break;
    default:
      cv.circle(x + s / 2, y + s / 2, 2, RED);
  }
}

// Vertical stripe clipped inside a circle (for the balloon).
function vStripeInCircle(cv: Canvas, cx: number, cy: number, r: number, x0: number, w: number, c: RGB): void {
  for (let xx = x0; xx < x0 + w; xx++) {
    const dx = xx - cx;
    if (Math.abs(dx) >= r) continue;
    const half = Math.floor(Math.sqrt(r * r - dx * dx));
    cv.rect(xx, cy - half, 1, half * 2, c);
  }
}

// ---------------------------------------------------------------------------
// Hero scene: Macy's 100th Thanksgiving Parade postponed by the storm.
// A giant balloon (red, with blue stripes) tethered low over a street of
// buildings, under dark storm clouds, wind and rain. Drawn in the hero band.
// ---------------------------------------------------------------------------

function drawHeroScene(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Sky gradient bands (stormy).
  cv.rect(x, y, w, h, SKY);
  cv.rect(x, y, w, Math.floor(h * 0.42), SKY_DARK);
  // Storm clouds: clusters of overlapping grey circles (puffy, not lone balls).
  const cloud: RGB = [96, 108, 128];
  const cloud2: RGB = [112, 124, 142];
  cv.circle(x + Math.floor(w * 0.12), y + Math.floor(h * 0.16), 22, cloud);
  cv.circle(x + Math.floor(w * 0.20), y + Math.floor(h * 0.10), 26, cloud2);
  cv.circle(x + Math.floor(w * 0.28), y + Math.floor(h * 0.16), 20, cloud);
  cv.circle(x + Math.floor(w * 0.60), y + Math.floor(h * 0.14), 24, cloud);
  cv.circle(x + Math.floor(w * 0.68), y + Math.floor(h * 0.08), 28, cloud2);
  cv.circle(x + Math.floor(w * 0.76), y + Math.floor(h * 0.15), 20, cloud);
  cv.circle(x + Math.floor(w * 0.90), y + Math.floor(h * 0.12), 18, cloud2);
  // Wind swirls.
  cv.thickLine(x + 24, y + 62, x + 84, y + 56, 2, WHITE);
  cv.thickLine(x + w - 96, y + 74, x + w - 30, y + 66, 2, WHITE);
  // Giant balloon: big red circle with blue stripes, tethered low.
  const bx = x + Math.floor(w * 0.40);
  const by = y + Math.floor(h * 0.50);
  const R = 54;
  cv.circle(bx, by, R, RED);
  vStripeInCircle(cv, bx, by, R, bx - 40, 12, BLUE);
  vStripeInCircle(cv, bx, by, R, bx - 6, 12, BLUE);
  vStripeInCircle(cv, bx, by, R, bx + 28, 12, BLUE);
  // Balloon highlight.
  cv.circle(bx - 20, by - 18, 9, [226, 120, 110]);
  // Small second balloon (gold) drifting right.
  const bx2 = x + Math.floor(w * 0.80);
  const by2 = y + Math.floor(h * 0.40);
  const R2 = 24;
  cv.circle(bx2, by2, R2, GOLD);
  vStripeInCircle(cv, bx2, by2, R2, bx2 - 4, 8, RED);
  // Tether ropes from the balloons down to the street.
  const streetY = y + h - 28;
  cv.line(bx - 22, by + R - 4, bx - 32, streetY, INK);
  cv.line(bx + 22, by + R - 4, bx + 32, streetY, INK);
  cv.line(bx, by + R, bx, streetY, INK);
  cv.line(bx2 - 9, by2 + R2 - 2, bx2 - 13, streetY, INK);
  cv.line(bx2 + 9, by2 + R2 - 2, bx2 + 13, streetY, INK);
  // Street of buildings along the bottom.
  cv.rect(x, streetY, w, 28, INK_SOFT);
  const bcols: [number, number, number][] = [
    [52, 96, 118],
    [96, 138, 158],
    [64, 108, 128],
  ];
  let bxx = x + 6;
  let bi = 0;
  while (bxx < x + w - 26) {
    const bw = 24 + ((bi * 13) % 20);
    const bh = 14 + ((bi * 7) % 12);
    cv.rect(bxx, streetY - bh, bw, bh, bcols[bi % 3]);
    for (let wy = streetY - bh + 4; wy < streetY - 3; wy += 7) {
      for (let wx = bxx + 4; wx < bxx + bw - 4; wx += 8) {
        cv.rect(wx, wy, 3, 4, GOLD);
      }
    }
    bxx += bw + 6;
    bi++;
  }
  // Rain (diagonal streaks).
  for (let i = 0; i < 24; i++) {
    const rx = x + 10 + ((i * 41) % (w - 20));
    const ry = y + 36 + ((i * 47) % (h - 80));
    cv.line(rx, ry, rx - 5, ry + 11, [220, 228, 236]);
  }
}

// ---------------------------------------------------------------------------
// Layout. Canvas 1024x1024. All coordinates in pixels.
//   Masthead  16–112   |  Hero 122–296  |  Grid 302–802
//   Map       806–904  |  Timeline 908–962  |  Footer 968–1004
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;

function drawMasthead(cv: Canvas): void {
  drawTextCentered(cv, "THE WORLD IN ONE DAY", 512, 16, 6, INK);
  drawTextCentered(cv, "THURSDAY 26 NOVEMBER 2026", 512, 62, 4, INK);
  drawTextCentered(cv, "50 STORIES • 9 REGIONS", 512, 94, 2, RED);
  cv.rect(24, 112, 976, 3, INK);
  cv.rect(24, 117, 976, 1, INK);
}

function drawHero(cv: Canvas): void {
  // Scene on the left, headline on the right.
  drawHeroScene(cv, 24, 126, 532, 166);
  cv.frame(24, 126, 532, 166, INK_SOFT);
  cv.vline(566, 126, 166, INK_SOFT);
  const hx = 584;
  drawText(cv, "MACY'S 100TH", hx, 130, 5, INK);
  drawText(cv, "PARADE", hx, 170, 5, INK);
  drawText(cv, "POSTPONED", hx, 210, 5, RED);
  drawText(cv, "First delay in 100 years", hx, 254, 2, INK_SOFT);
  drawText(cv, "Winds to 60 mph — Sat 28 Nov", hx, 272, 2, INK_SOFT);
}

function drawColumn(cv: Canvas, x0: number, sections: ColSection[], gridTop: number, gridH: number): void {
  const colW = 320;
  const headH = 18;
  const totalStories = sections.reduce((n, s) => n + s.stories.length, 0);
  const rowH = Math.floor((gridH - sections.length * headH) / totalStories);
  let y = gridTop;
  for (const sec of sections) {
    // Section header: red bar with white text.
    cv.rect(x0, y, colW, 16, RED);
    drawText(cv, sec.head, x0 + 8, y + 1, 2, WHITE);
    y += headH;
    for (const st of sec.stories) {
      const iconX = x0;
      const textX = st.scene ? x0 + 26 : x0 + 12;
      if (st.scene) {
        drawSceneIcon(cv, st.scene, iconX, y + 2, 20);
      } else {
        cv.rect(x0 + 2, y + 7, 5, 5, RED);
      }
      drawText(cv, st.t, textX, y + 1, 2, INK);
      drawText(cv, st.s, textX, y + 17, 1, INK_SOFT);
      y += rowH;
    }
  }
}

function drawGrid(cv: Canvas): void {
  const gridTop = 302;
  const gridH = 500;
  drawColumn(cv, 24, COL_A, gridTop, gridH);
  drawColumn(cv, 352, COL_B, gridTop, gridH);
  drawColumn(cv, 680, COL_C, gridTop, gridH);
  cv.vline(348, gridTop, gridH, INK_SOFT);
  cv.vline(676, gridTop, gridH, INK_SOFT);
  cv.hline(24, gridTop + gridH, 976, INK);
}

// Stylised world map: rough continents on a sea band, red dots at the cities
// where the day's news happened, with a few labels.
function drawMap(cv: Canvas): void {
  const my = 826; // map area top
  drawText(cv, "WHERE IT HAPPENED", 24, 806, 2, INK);
  drawText(cv, "14 CITIES, ONE DAY", 880, 806, 1, INK_SOFT);
  cv.rect(24, my, 976, 74, SEA);
  cv.frame(24, my, 976, 74, INK_SOFT);
  const land: [number, number][][] = [
    // North America
    [[70, 838], [150, 830], [230, 834], [265, 848], [245, 872], [185, 880], [120, 874], [75, 860]],
    // South America
    [[275, 874], [325, 870], [345, 886], [325, 898], [285, 896], [268, 884]],
    // Europe
    [[485, 832], [545, 830], [565, 842], [545, 856], [505, 854], [483, 844]],
    // Africa
    [[485, 856], [545, 854], [580, 870], [565, 894], [525, 900], [495, 886], [477, 870]],
    // Asia
    [[565, 832], [705, 828], [855, 832], [905, 847], [885, 868], [805, 872], [705, 868], [625, 862], [570, 848]],
    // Australia
    [[825, 884], [885, 881], [910, 891], [885, 898], [840, 897]],
  ];
  for (const p of land) cv.poly(p, LAND);
  const dots: [number, number, string][] = [
    [175, 852, "NEW YORK"],
    [190, 862, ""],
    [548, 864, "CAIRO"],
    [578, 864, ""],
    [562, 860, ""],
    [518, 844, "GENEVA"],
    [498, 840, ""],
    [702, 864, "MUMBAI"],
    [605, 840, ""],
    [792, 850, "BEIJING"],
    [822, 847, ""],
    [582, 890, ""],
    [112, 857, ""],
    [152, 854, ""],
    [97, 864, ""],
  ];
  for (const [dx, dy, label] of dots) {
    cv.circle(dx, dy, 4, RED);
    cv.ring(dx, dy, 4, WHITE);
    if (label !== "") {
      const lx = Math.min(Math.max(24, dx - 20), 1000 - textWidth(label, 1));
      drawText(cv, label, lx, dy - 12, 1, INK);
    }
  }
}

function drawTimeline(cv: Canvas): void {
  drawText(cv, "THE DAY IN TIME — UTC", 24, 908, 2, INK);
  const ty = 950;
  cv.hline(60, ty, 904, INK);
  const stops: { x: number; head: string; ev: string }[] = [
    { x: 200, head: "WED PM", ev: "Macy's announced · GDP 4.3% · FCC" },
    { x: 420, head: "WED NIGHT", ev: "Cairo tanker fire" },
    { x: 640, head: "THU AM", ev: "26/11 anniversary, Mumbai" },
    { x: 860, head: "THU PM", ev: "Gukesh Game 3 — 15:00 CET" },
  ];
  for (const s of stops) {
    cv.circle(s.x, ty, 5, RED);
    drawTextCentered(cv, s.head, s.x, 928, 2, INK);
    drawTextCentered(cv, s.ev, s.x, 958, 1, INK_SOFT);
  }
}

function drawFooter(cv: Canvas): void {
  cv.rect(24, 970, 976, 1, INK);
  drawTextCentered(cv, "ALL STORIES VERIFIED FROM MULTIPLE SOURCES — 26 NOVEMBER 2026", 512, 982, 2, INK);
  drawTextCentered(cv, "50 STORIES • 9 REGIONS • THE WORLD IN ONE DAY", 512, 1000, 1, INK_SOFT);
}

function buildPoster(): Buffer {
  const cv = new Canvas(W, H, PAPER);
  cv.frame(8, 8, 1008, 1008, INK);
  cv.frame(12, 12, 1000, 1000, INK_SOFT);
  drawMasthead(cv);
  drawHero(cv);
  drawGrid(cv);
  drawMap(cv);
  drawTimeline(cv);
  drawFooter(cv);
  return encodePNG(W, H, cv.buf);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = buildPoster();
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
