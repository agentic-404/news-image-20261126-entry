// The World in One Day — 26 November 2026 (news-image-20261126 r2)
// A front-page poster of Thursday 26 November 2026's world news: 36 stories
// (13 illustrated + 23 listed), 9 regions, a pinned world map, a numbers strip,
// an all-Thursday UTC timeline and a DATE CHECK box. Drawn at run time with
// Node's standard library only: a hand-built vector stroke font (clean serif
// headlines, sans labels) and procedural scenes. No network, no binary assets,
// no environment reads. Deterministic: two runs write identical bytes.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

export const W = 1024;
export const H = 1024;

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- color
type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [26, 26, 26];
const INK_SOFT: RGB = [64, 60, 54];
const GREY: RGB = [112, 108, 100];
const LINE: RGB = [206, 201, 190];
const RED: RGB = [178, 28, 28];
const RED_DARK: RGB = [140, 20, 20];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [18, 18, 18];
const DARK_BAND: RGB = [26, 26, 28];
const GOLD: RGB = [212, 175, 55];
const SEA: RGB = [214, 230, 242];
const LAND: RGB = [52, 65, 82];
const SKY_DAY: RGB = [176, 205, 226];
const SKY_DUSK: RGB = [120, 140, 170];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// ------------------------------------------------------------------ canvas
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Buffer;
  private clipX = 0;
  private clipY = 0;
  private clipW: number;
  private clipH: number;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.clipW = w;
    this.clipH = h;
    this.buf = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 4] = bg[0];
      this.buf[i * 4 + 1] = bg[1];
      this.buf[i * 4 + 2] = bg[2];
      this.buf[i * 4 + 3] = 255;
    }
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clipX = Math.max(0, Math.floor(x));
    this.clipY = Math.max(0, Math.floor(y));
    this.clipW = Math.min(this.w, Math.floor(x + w)) - this.clipX;
    this.clipH = Math.min(this.h, Math.floor(y + h)) - this.clipY;
    if (this.clipW < 0) this.clipW = 0;
    if (this.clipH < 0) this.clipH = 0;
  }
  clearClip(): void {
    this.clipX = 0;
    this.clipY = 0;
    this.clipW = this.w;
    this.clipH = this.h;
  }

  px(x: number, y: number, c: RGB): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < this.clipX || xi >= this.clipX + this.clipW) return;
    if (yi < this.clipY || yi >= this.clipY + this.clipH) return;
    const i = (yi * this.w + xi) * 4;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(this.clipX, Math.floor(x));
    const y0 = Math.max(this.clipY, Math.floor(y));
    const x1 = Math.min(this.clipX + this.clipW, Math.ceil(x + w));
    const y1 = Math.min(this.clipY + this.clipH, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.w + xx) * 4;
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      for (let xx = -dx; xx <= dx; xx++) this.px(cx + xx, cy + dy, c);
    }
  }

  ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r && d >= r - t) this.px(cx + dx, cy + dy, c);
      }
    }
  }

  // Thick line with round caps: stamp circles along the segment.
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) {
      this.fillCircle(x0, y0, w / 2, c);
      return;
    }
    if (w <= 1.3) {
      // Bresenham, 1 px.
      const steps = Math.ceil(len);
      for (let i = 0; i <= steps; i++) {
        this.px(x0 + (dx * i) / steps, y0 + (dy * i) / steps, c);
      }
      return;
    }
    const step = Math.max(0.4, w / 5);
    const n = Math.ceil(len / step);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.fillCircle(x0 + dx * t, y0 + dy * t, w / 2, c);
    }
  }

  polyline(pts: [number, number][], w: number, c: RGB, close = false): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
    }
    if (close && pts.length > 2) {
      this.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], w, c);
    }
  }

  // Even-odd scanline fill for a simple polygon.
  polygon(pts: [number, number][], c: RGB): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const y0 = Math.max(this.clipY, Math.ceil(minY));
    const y1 = Math.min(this.clipY + this.clipH - 1, Math.floor(maxY));
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0p] = pts[i];
        const [x1, y1p] = pts[(i + 1) % pts.length];
        if ((y0p <= y && y1p > y) || (y1p <= y && y0p > y)) {
          xs.push(x0 + ((y - y0p) * (x1 - x0)) / (y1p - y0p));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(this.clipX, Math.ceil(xs[k]));
        const xb = Math.min(this.clipX + this.clipW - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) {
          const i = (y * this.w + x) * 4;
          this.buf[i] = c[0];
          this.buf[i + 1] = c[1];
          this.buf[i + 2] = c[2];
        }
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    const y0 = Math.max(this.clipY, Math.floor(cy - ry));
    const y1 = Math.min(this.clipY + this.clipH - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      const t = (y - cy) / ry;
      if (Math.abs(t) > 1) continue;
      const dx = rx * Math.sqrt(1 - t * t);
      const xa = Math.max(this.clipX, Math.ceil(cx - dx));
      const xb = Math.min(this.clipX + this.clipW - 1, Math.floor(cx + dx));
      for (let x = xa; x <= xb; x++) {
        const i = (y * this.w + x) * 4;
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
      }
    }
  }

  // Vertical gradient in horizontal bands.
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB, bands = 12): void {
    for (let i = 0; i < bands; i++) {
      const c = mix(top, bot, i / (bands - 1));
      this.fillRect(x, y + (h * i) / bands, w, h / bands + 1, c);
    }
  }

  roundedRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.fillRect(x, y + r, w, h - 2 * r, c);
    this.fillCircle(x + r, y + r, r, c);
    this.fillCircle(x + w - r, y + r, r, c);
    this.fillCircle(x + r, y + h - r, r, c);
    this.fillCircle(x + w - r, y + h - r, r, c);
  }
}

// ------------------------------------------------------------------ font
// Hand-built vector stroke font. Grid: x 0..~10, y 0 = cap top, 10 = baseline,
// 13 = descender bottom; lowercase x-height top = 3. A glyph is strokes joined
// by "|"; a stroke is space-separated "x,y" points; "oX,Y" is a small filled
// dot, "OX,Y" a large one. Clean humanist sans; serif mode adds small ticks at
// the top/bottom of vertical stems (see drawGlyph).
interface Glyph { w: number; s: string }
const GLYPHS: Record<string, Glyph> = {
  A: { w: 7, s: "0,10 3.5,0 7,10|1.6,6.8 5.4,6.8" },
  B: { w: 7, s: "0,0 0,10|0,0 4.5,0 6,1 6,4 5,5 0,5|0,5 4.5,5 6,6 6,9 5,10 0,10" },
  C: { w: 7, s: "6,2 4,0 2,0 0,2 0,8 2,10 4,10 6,8" },
  D: { w: 7, s: "0,0 0,10|0,0 4.5,0 6.5,2 6.5,8 4.5,10 0,10" },
  E: { w: 7, s: "0,0 0,10|0,0 6,0|0,5 4.5,5|0,10 6,10" },
  F: { w: 7, s: "0,0 0,10|0,0 6,0|0,5 4.5,5" },
  G: { w: 7, s: "6,2 4,0 2,0 0,2 0,8 2,10 4,10 6,8 6,6|6,6 3.5,6" },
  H: { w: 7, s: "0,0 0,10|7,0 7,10|0,5 7,5" },
  I: { w: 4, s: "2,0 2,10|0.5,0 3.5,0|0.5,10 3.5,10" },
  J: { w: 6, s: "6,0 6,8 5,10 3.5,10 2,9|2.5,0 6,0" },
  K: { w: 7, s: "0,0 0,10|6,0 0.8,5 6,10" },
  L: { w: 7, s: "0,0 0,10|0,10 6,10" },
  M: { w: 8.5, s: "0,10 0,0 4.25,6 8.5,0 8.5,10" },
  N: { w: 7.5, s: "0,10 0,0 7.5,10 7.5,0" },
  O: { w: 7.5, s: "2,0 5.5,0 7.5,2 7.5,8 5.5,10 2,10 0,8 0,2 2,0" },
  P: { w: 7, s: "0,0 0,10|0,0 4.5,0 6,1 6,4 5,5 0,5" },
  Q: { w: 7.5, s: "2,0 5.5,0 7.5,2 7.5,8 5.5,10 2,10 0,8 0,2 2,0|4.5,7 7.5,10.5" },
  R: { w: 7, s: "0,0 0,10|0,0 4.5,0 6,1 6,4 5,5 0,5|4,5 7,10" },
  S: { w: 7, s: "6,1.5 5,0 2,0 0.8,1 0,3 0,4 1,5 3,5 5,5 6.5,6 7,7.5 7,8.5 6,10 5,10 2,10 0.8,9" },
  T: { w: 7, s: "0,0 7,0|3.5,0 3.5,10" },
  U: { w: 7.5, s: "0,0 0,8 1,10 3,10 5.5,10 6.5,10 7.5,8 7.5,0" },
  V: { w: 7.5, s: "0,0 3.75,10 7.5,0" },
  W: { w: 10, s: "0,0 2.5,10 5,3 7.5,10 10,0" },
  X: { w: 7.5, s: "0,0 7.5,10|7.5,0 0,10" },
  Y: { w: 7.5, s: "0,0 3.75,5 7.5,0|3.75,5 3.75,10" },
  Z: { w: 7, s: "0,0 7,0 0,10 7,10" },
  a: { w: 7, s: "6,3 6,10|5,3 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9" },
  b: { w: 7, s: "0,0 0,10|0,6 1,3.5 3,3 5,3 6,4.5 6,7.5 5,10 3,10 1,10 0,8.5" },
  c: { w: 7, s: "6,4 5,3 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9" },
  d: { w: 7, s: "6,0 6,10|6,6 5,3 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9" },
  e: { w: 7, s: "6,4 5,3 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9|0,6.5 6,6.5" },
  f: { w: 5, s: "3.5,0 3.5,10|1.5,2 3,0 4.5,0 5,1|1,4 5,4" },
  g: { w: 7, s: "6,3 6,13|5,3 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9|6,13 3,13 1.5,12" },
  h: { w: 7, s: "0,0 0,10|0,6 1,3.5 3,3 5,3 6,4.5 6,10" },
  i: { w: 4, s: "2,3 2,10|o2,0.8" },
  j: { w: 4.5, s: "3,3 3,12 2,13 1,12|o3,0.8" },
  k: { w: 7, s: "0,0 0,10|6,3 1,6.5 6,10" },
  l: { w: 4, s: "2,0 2,10" },
  m: { w: 10, s: "0,3 0,10|4.5,3 4.5,10|0,3 2,3 3.5,4.5 4.5,6|4.5,3 6.5,3 8,4.5 9,10" },
  n: { w: 7, s: "0,3 0,10|0,3 2,3 4,4.5 5,6 5,10" },
  o: { w: 7, s: "2,3 4,3 6,4.5 6,8 5,10 3,10 1,10 0,8 0,5 1,3 2,3" },
  p: { w: 7, s: "0,3 0,13|0,6.5 1,3.5 3,3 5,3 6,4.5 6,7.5 5,10 3,10 1,10 0,8.5" },
  q: { w: 7, s: "6,3 6,13|6,6.5 5,3.5 3,3 1,4 0,6 0,8 1,10 3,10 5,10 6,9" },
  r: { w: 5.5, s: "0,3 0,10|0,5.5 1,3.5 3,3 4.5,3 5.5,4" },
  s: { w: 7, s: "6,4 5,3 3,3 1,4 0,5 0,6 1,7 3,7 5,7 6,8 6,9 5,10 3,10 1,10 0,9" },
  t: { w: 5, s: "3,0 3,10 4,10 5,9|1,4 5,4" },
  u: { w: 7, s: "0,3 0,9 1,10 3,10 5,10 6,9 6,3" },
  v: { w: 7, s: "0,3 3.5,10 7,3" },
  w: { w: 10, s: "0,3 2.5,10 5,5 7.5,10 10,3" },
  x: { w: 7, s: "0,3 7,10|7,3 0,10" },
  y: { w: 7, s: "0,3 3.5,10 7,3|3.5,10 3.5,13 2.5,13" },
  z: { w: 7, s: "0,3 7,3 0,10 7,10" },
  "0": { w: 7.5, s: "2,0 5.5,0 7.5,2 7.5,8 5.5,10 2,10 0,8 0,2 2,0" },
  "1": { w: 5, s: "2,1 3.5,0 3.5,10|1.5,10 5,10" },
  "2": { w: 7, s: "1,2 1,1 2,0 5,0 6,1 6,3.5 5,5 2,8 0,10 6,10" },
  "3": { w: 7, s: "1,1 2,0 5,0 6,1 6,3.5 5,5 4,5|4,5 6,6 6,9 5,10 2,10 1,9" },
  "4": { w: 7, s: "5,0 1,7 6,7|5,0 5,10" },
  "5": { w: 7, s: "6,0 1,0 0.5,1 0,4 1,5 4,5 5.5,5.5 6,7 6,9 5,10 2,10 1,9" },
  "6": { w: 7, s: "6,1 5,0 2,0 1,1 0,3 0,8 1,10 3,10 5,10 6,9 6,6.5 5,5 3,5 1,5 0,6.5" },
  "7": { w: 7, s: "0,0 7,0 3,10" },
  "8": { w: 7, s: "2,0 5,0 6,1 6,3.5 5,5 3.5,5 2,5 1,3.5 0,2 1,0 2,0|5,5 6,6 6,9 5,10 2,10 1,9 0,8 0,6 1,5 2,5" },
  "9": { w: 7, s: "0,9 0,5 1,5 3,5 5,5 6,4 6,1 5,0 2,0 1,1 0,3 0,7 1,9 2,10 4,10 6,9 7,7" },
  ".": { w: 4, s: "o2,9.2" },
  ",": { w: 4, s: "o2,9.2|2,10 2,12 1,13" },
  ":": { w: 4, s: "o2,3|o2,9.2" },
  ";": { w: 4, s: "o2,3|o2,9.2|2,10 2,12 1,13" },
  "-": { w: 7, s: "1,6.5 6,6.5" },
  "–": { w: 7, s: "0.5,6.5 6.5,6.5" },
  "—": { w: 7.5, s: "0,6.5 7.5,6.5" },
  "'": { w: 3.5, s: "2,1 1.5,3.5" },
  '"': { w: 6, s: "2,1 1.5,3.5|5,1 4.5,3.5" },
  "(": { w: 4.5, s: "3.5,0 2,2 2,8 3.5,10" },
  ")": { w: 4.5, s: "1,0 2.5,2 2.5,8 1,10" },
  "%": { w: 9, s: "7,0 1,10|O2.5,2.5|O6.5,7.5" },
  "+": { w: 7, s: "3.5,3 3.5,9|1,6 6,6" },
  "/": { w: 7, s: "1.5,10 5.5,0" },
  "€": { w: 7, s: "6,2 4,0 2,0 0,2 0,8 2,10 4,10 6,8|0,4 5,4|0,6.5 5,6.5" },
  "₹": { w: 7, s: "0,0 0,10|0,0 4.5,0 6,1 6,3.5 5,4.5 0,4.5|0,6.5 6,6.5" },
  "·": { w: 4, s: "o2,5.5" },
  "!": { w: 4, s: "2,0 2,7|o2,9.2" },
  "?": { w: 7, s: "2,1.5 3,0 5,0 6,1 6,3 5,5 4,6 3.5,7|o3.5,9.2" },
  "&": { w: 8, s: "6,2 5,0 3,0 1.5,1.5 1,3.5 1,5 2,6.5 4,6.5 6,6.5 6,8.5 5,10 3,10 1.5,9|0.5,8 7,2.5" },
  $: { w: 7, s: "3.5,-1 3.5,11|6,1.5 5,0 2,0 0.8,1 0,3 0,4 1,5 3,5 5,5 6.5,6 7,7.5 7,8.5 6,10 5,10 2,10 0.8,9" },
  "£": { w: 7, s: "6,0 3,0 2,1 2,9 3,10 6,10|1,4 5,4|1,6.5 5,6.5" },
  "[": { w: 4.5, s: "3.5,0 1,0 1,10 3.5,10" },
  "]": { w: 4.5, s: "1,0 3.5,0 3.5,10 1,10" },
  "°": { w: 4.5, s: "o2.2,1.5" },
  "•": { w: 4.5, s: "O2.2,6" },
  "=": { w: 7, s: "1,4 6,4|1,7 6,7" },
  _: { w: 7, s: "0,10.5 7,10.5" },
  "*": { w: 7, s: "3.5,1 3.5,9|0.5,3 6.5,7|6.5,3 0.5,7" },
  "<": { w: 6, s: "5,0 1,5 5,10" },
  ">": { w: 6, s: "1,0 5,5 1,10" },
  "|": { w: 3, s: "1.5,0 1.5,10" },
  " ": { w: 4, s: "" },
  "#": { w: 8, s: "2,0 2.5,10|5.5,0 6,10|0,3.5 8,3.5|0,6.5 8,6.5" },
  "~": { w: 7, s: "0.5,6 2,4 4,6 5.5,4 7,6" },
  "^": { w: 7, s: "0.5,6 3.5,1 6.5,6" },
  "\\": { w: 7, s: "1.5,0 5.5,10" },
};

interface TextOpts {
  weight?: "regular" | "medium" | "bold";
  serif?: boolean;
  tracking?: number; // extra px per char
}

const REG_W = 0.08; // stroke width as a fraction of cap-height size
const BOLD_W = 0.12;
const MED_W = 0.09;
const HSCALE = 0.72; // horizontal condense: glyphs are drawn ~0.72 as wide as
// the 10-unit grid, so average advance is ~0.53 em (a normal newspaper
// width). Without it, lines run ~40% too wide for their columns.

function glyphWidth(ch: string, size: number, tracking = 0): number {
  const g = GLYPHS[ch];
  if (!g) return size * 0.55 * HSCALE;
  return (g.w + 0.9) * (size / 10) * HSCALE + tracking;
}

function textWidth(text: string, size: number, tracking = 0): number {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch, size, tracking);
  return w - tracking; // no trailing tracking
}

function drawGlyph(cv: Canvas, ch: string, x: number, baselineY: number, size: number, c: RGB, o: TextOpts): void {
  const g = GLYPHS[ch];
  if (!g || !g.s) return;
  const sc = size / 10;
  const scx = sc * HSCALE;
  const sw = size * (o.weight === "bold" ? BOLD_W : o.weight === "medium" ? MED_W : REG_W);
  const strokes = g.s.split("|");
  for (const st of strokes) {
    const toks = st.trim().split(/\s+/);
    if (toks.length === 1 && (toks[0].startsWith("o") || toks[0].startsWith("O"))) {
      const big = toks[0][0] === "O";
      const [gx, gy] = toks[0].slice(1).split(",").map(Number);
      cv.fillCircle(x + gx * scx, baselineY + (gy - 10) * sc, (big ? 1.35 : 0.95) * sc, c);
      continue;
    }
    const pts: [number, number][] = toks.map((t) => {
      const [gx, gy] = t.split(",").map(Number);
      return [x + gx * scx, baselineY + (gy - 10) * sc] as [number, number];
    });
    cv.polyline(pts, Math.max(1, sw), c);
    // Serif ticks: at stroke endpoints on the cap line (y=0) or baseline
    // (y=10) whose adjacent segment is vertical.
    if (o.serif) {
      const tick = (idx: number) => {
        const [gx, gy] = toks[idx].split(",").map(Number);
        if (gy !== 0 && gy !== 10) return;
        const nb = idx === 0 ? 1 : toks.length - 2;
        const [nx] = toks[nb].split(",").map(Number);
        if (Math.abs(nx - gx) > 0.6) return;
        const cxp = x + gx * scx;
        const cyp = baselineY + (gy - 10) * sc;
        cv.line(cxp - 0.85 * scx, cyp, cxp + 0.85 * scx, cyp, Math.max(1, sw * 0.85), c);
      };
      tick(0);
      tick(toks.length - 1);
    }
  }
}

// Draw one line; returns its width. x = left edge, baselineY = baseline.
function drawText(cv: Canvas, text: string, x: number, baselineY: number, size: number, c: RGB, o: TextOpts = {}): number {
  let cx = x;
  for (const ch of text) {
    drawGlyph(cv, ch, cx, baselineY, size, c, o);
    cx += glyphWidth(ch, size, o.tracking ?? 0);
  }
  return cx - x;
}

function drawTextCentered(cv: Canvas, text: string, cx: number, baselineY: number, size: number, c: RGB, o: TextOpts = {}): void {
  const w = textWidth(text, size, o.tracking ?? 0);
  drawText(cv, text, cx - w / 2, baselineY, size, c, o);
}

function wrapText(text: string, size: number, maxW: number, tracking = 0): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, size, tracking) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw wrapped text; returns number of lines drawn.
function drawTextBlock(cv: Canvas, text: string, x: number, yTop: number, size: number, maxW: number, leading: number, c: RGB, o: TextOpts = {}, maxLines = 99): number {
  const lines = wrapText(text, size, maxW, o.tracking ?? 0).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(cv, lines[i], x, yTop + size + i * leading, size, c, o);
  }
  return lines.length;
}

// Largest size in [minSize, maxSize] whose wrap fits in maxLines lines.
function fitSize(text: string, maxSize: number, minSize: number, maxW: number, maxLines: number, tracking = 0): number {
  for (let s = maxSize; s >= minSize; s -= 0.5) {
    if (wrapText(text, s, maxW, tracking).length <= maxLines) return s;
  }
  return minSize;
}

// ------------------------------------------------------------------ scenes
// Each scene draws inside its own rect (x, y, w, h). All shapes are simple
// primitives; every scene is built to be recognisable at 300 px.

function star4(cv: Canvas, cx: number, cy: number, r: number, c: RGB): void {
  cv.polygon([[cx, cy - r], [cx + r * 0.28, cy - r * 0.28], [cx + r, cy], [cx + r * 0.28, cy + r * 0.28], [cx, cy + r], [cx - r * 0.28, cy + r * 0.28], [cx - r, cy], [cx - r * 0.28, cy - r * 0.28]], c);
}

function flame(cv: Canvas, cx: number, cy: number, s: number, c: RGB): void {
  cv.polygon([[cx, cy - s], [cx + s * 0.55, cy + s * 0.2], [cx, cy + s * 0.7], [cx - s * 0.55, cy + s * 0.2]], c);
  cv.fillCircle(cx, cy + s * 0.25, s * 0.5, c);
}

function building(cv: Canvas, x: number, y: number, w: number, h: number, body: RGB, win: RGB, lit: RGB): void {
  cv.fillRect(x, y, w, h, body);
  const cols = Math.max(2, Math.floor(w / 9));
  const rows = Math.max(2, Math.floor(h / 11));
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const litWin = (r * 7 + c * 3) % 5 !== 0;
      cv.fillRect(x + c * cw + 1.5, y + r * ch + 2, cw - 3, ch - 4, litWin ? lit : win);
    }
  }
}

function person(cv: Canvas, x: number, y: number, s: number, shirt: RGB, pants: RGB, helmet?: RGB): void {
  // s = figure height in px; x,y = top centre of head.
  cv.fillCircle(x, y + s * 0.09, s * 0.09, [222, 184, 150]); // head
  if (helmet) cv.fillCircle(x, y + s * 0.07, s * 0.1, helmet);
  cv.fillRect(x - s * 0.13, y + s * 0.2, s * 0.26, s * 0.42, shirt); // torso
  cv.fillRect(x - s * 0.12, y + s * 0.62, s * 0.1, s * 0.36, pants); // legs
  cv.fillRect(x + s * 0.02, y + s * 0.62, s * 0.1, s * 0.36, pants);
}

function sceneMacys(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [58, 72, 96], [112, 124, 140]);
  // rain slashes
  for (let i = 0; i < 26; i++) {
    const rx = x + ((i * 37) % Math.max(1, Math.floor(w)));
    const ry = y + ((i * 23) % Math.max(1, Math.floor(h * 0.6)));
    cv.line(rx, ry, rx - 3, ry + 9, 1, [190, 200, 210]);
  }
  // storm clouds
  cv.ellipse(x + w * 0.18, y + h * 0.1, w * 0.22, h * 0.09, [52, 60, 74]);
  cv.ellipse(x + w * 0.8, y + h * 0.06, w * 0.26, h * 0.1, [46, 54, 68]);
  cv.ellipse(x + w * 0.55, y + h * 0.16, w * 0.2, h * 0.08, [60, 68, 82]);
  // skyline
  building(cv, x + w * 0.02, y + h * 0.62, w * 0.2, h * 0.38, [38, 44, 54], [70, 78, 90], [240, 200, 90]);
  building(cv, x + w * 0.78, y + h * 0.58, w * 0.2, h * 0.42, [34, 40, 50], [66, 74, 86], [240, 200, 90]);
  building(cv, x + w * 0.28, y + h * 0.7, w * 0.16, h * 0.3, [44, 50, 60], [74, 82, 94], [240, 200, 90]);
  // giant balloon: a tall round balloon with a friendly face
  const bcx = x + w * 0.5;
  const bcy = y + h * 0.44;
  const brx = Math.min(w, h) * 0.34;
  const bry = Math.min(w, h) * 0.4;
  cv.ellipse(bcx, bcy, brx, bry, [196, 38, 38]);
  cv.ellipse(bcx, bcy - bry * 0.12, brx * 0.62, bry * 0.55, [250, 244, 236]);
  cv.fillCircle(bcx - brx * 0.3, bcy - bry * 0.2, Math.max(2, brx * 0.09), [26, 26, 26]);
  cv.fillCircle(bcx + brx * 0.3, bcy - bry * 0.2, Math.max(2, brx * 0.09), [26, 26, 26]);
  cv.line(bcx - brx * 0.28, bcy + bry * 0.12, bcx, bcy + bry * 0.24, 2, [26, 26, 26]);
  cv.line(bcx, bcy + bry * 0.24, bcx + brx * 0.28, bcy + bry * 0.12, 2, [26, 26, 26]);
  // balloon ropes
  cv.line(bcx - brx * 0.5, bcy + bry * 0.9, bcx - brx * 0.7, y + h * 0.92, 1, [230, 230, 220]);
  cv.line(bcx + brx * 0.5, bcy + bry * 0.9, bcx + brx * 0.7, y + h * 0.92, 1, [230, 230, 220]);
}

function sceneIndia(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Indian flag: saffron / white / green
  cv.fillRect(x, y, w, h * 0.34, [255, 153, 51]);
  cv.fillRect(x, y + h * 0.34, w, h * 0.33, [248, 246, 240]);
  cv.fillRect(x, y + h * 0.67, w, h * 0.33, [19, 136, 8]);
  // chakra wheel in the white band
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const r = h * 0.18;
  cv.ring(cx, cy, r, Math.max(1.5, r * 0.16), [6, 51, 102]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    cv.line(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, [6, 51, 102]);
  }
  cv.fillCircle(cx, cy, r * 0.14, [6, 51, 102]);
  // memorial candles along the bottom
  for (let i = 0; i < 5; i++) {
    const bx = x + w * (0.12 + i * 0.19);
    const by = y + h * 0.92;
    cv.fillRect(bx - 3.5, by - 4, 7, 5, [120, 72, 32]); // diya bowl
    flame(cv, bx, by - 8, 5, [255, 170, 40]);
  }
}

function sceneChess(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [36, 68, 48]);
  // checkerboard (kept inside the scene: 6 squares, small margin)
  const bs = Math.min(w * 0.085, h * 0.14);
  const bx = x + w * 0.05;
  const by = y + h * 0.06;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      cv.fillRect(bx + c * bs, by + r * bs, bs, bs, (r + c) % 2 === 0 ? [240, 222, 190] : [96, 62, 40]);
    }
  }
  // a white pawn and a black king on the board
  cv.fillCircle(bx + bs * 1.5, by + bs * 4.5, bs * 0.32, [245, 245, 240]);
  cv.fillRect(bx + bs * 1.5 - bs * 0.28, by + bs * 4.5, bs * 0.56, bs * 0.5, [245, 245, 240]);
  cv.fillCircle(bx + bs * 4.5, by + bs * 1.5, bs * 0.3, [30, 30, 30]);
  cv.fillRect(bx + bs * 4.5 - bs * 0.26, by + bs * 1.5, bs * 0.52, bs * 0.5, [30, 30, 30]);
  // clock showing 1:32
  const cx = x + w * 0.76;
  const cy = y + h * 0.3;
  const r = Math.min(w, h) * 0.18;
  cv.fillCircle(cx, cy, r, [250, 248, 242]);
  cv.ring(cx, cy, r, 2, [26, 26, 26]);
  cv.line(cx, cy, cx + r * 0.45, cy - r * 0.55, 2, [26, 26, 26]); // hour ~1
  cv.line(cx, cy, cx + r * 0.75, cy + r * 0.5, 2, [26, 26, 26]); // minute ~32
  cv.fillCircle(cx, cy, 2, [26, 26, 26]);
  // small "1:32" label under the clock
  drawText(cv, "1:32", cx - r * 0.7, cy + r + 12, 11, WHITE, { weight: "bold" });
}

function sceneEU(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [0, 51, 102]);
  // circle of 12 gold stars
  const cx = x + w * 0.5;
  const cy = y + h * 0.38;
  const rr = Math.min(w, h) * 0.3;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    star4(cv, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(3, w * 0.022), GOLD);
  }
  // Berlaymont building at the bottom
  building(cv, x + w * 0.08, y + h * 0.68, w * 0.84, h * 0.32, [120, 124, 128], [90, 94, 98], [220, 225, 230]);
}

function sceneHouthi(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [12, 18, 38], [38, 52, 84]);
  for (let i = 0; i < 22; i++) {
    cv.fillCircle(x + ((i * 53) % Math.max(1, Math.floor(w))), y + ((i * 29) % Math.max(1, Math.floor(h * 0.5))), 1, WHITE);
  }
  // Riyadh towers: Kingdom Centre with its arch opening
  cv.fillRect(x + w * 0.1, y + h * 0.5, w * 0.16, h * 0.5, [30, 36, 52]);
  cv.polygon([[x + w * 0.1, y + h * 0.5], [x + w * 0.18, y + h * 0.42], [x + w * 0.26, y + h * 0.5]], [12, 18, 38]);
  cv.fillRect(x + w * 0.3, y + h * 0.62, w * 0.14, h * 0.38, [36, 42, 58]);
  cv.fillRect(x + w * 0.68, y + h * 0.55, w * 0.18, h * 0.45, [28, 34, 50]);
  for (let r = 0; r < 5; r++) {
    cv.fillRect(x + w * 0.12, y + h * (0.54 + r * 0.08), w * 0.12, 2, [250, 210, 110]);
  }
  // missile trails + intercept burst
  cv.line(x + w * 0.55, y + h * 0.1, x + w * 0.42, y + h * 0.42, 2, [255, 240, 200]);
  cv.line(x + w * 0.85, y + h * 0.05, x + w * 0.72, y + h * 0.38, 2, [255, 240, 200]);
  const bx = x + w * 0.58;
  const by = y + h * 0.3;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cv.line(bx, by, bx + Math.cos(a) * w * 0.09, by + Math.sin(a) * w * 0.09, 2, [255, 190, 60]);
  }
  cv.fillCircle(bx, by, w * 0.035, [255, 220, 120]);
}

function sceneKyiv(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [150, 160, 175], [110, 116, 128]);
  // shopping centre, damaged
  building(cv, x + w * 0.06, y + h * 0.34, w * 0.6, h * 0.66, [96, 96, 100], [60, 60, 64], [230, 210, 140]);
  cv.polygon([[x + w * 0.3, y + h * 0.34], [x + w * 0.42, y + h * 0.22], [x + w * 0.54, y + h * 0.34]], [70, 70, 74]); // broken roof
  // smoke
  cv.ellipse(x + w * 0.36, y + h * 0.16, w * 0.16, h * 0.1, [200, 200, 200]);
  cv.ellipse(x + w * 0.5, y + h * 0.08, w * 0.13, h * 0.08, [210, 210, 210]);
  // fire glow at the base
  cv.ellipse(x + w * 0.3, y + h * 0.92, w * 0.2, h * 0.1, [255, 140, 40]);
  flame(cv, x + w * 0.26, y + h * 0.88, 7, [255, 190, 60]);
  flame(cv, x + w * 0.36, y + h * 0.9, 5, [255, 170, 40]);
  // rescue workers
  person(cv, x + w * 0.74, y + h * 0.62, h * 0.3, [240, 120, 30], [40, 40, 44], [255, 220, 40]);
  person(cv, x + w * 0.86, y + h * 0.66, h * 0.26, [240, 120, 30], [40, 40, 44], [255, 220, 40]);
  // ambulance
  cv.fillRect(x + w * 0.7, y + h * 0.86, w * 0.26, h * 0.12, WHITE);
  cv.fillRect(x + w * 0.7, y + h * 0.86, w * 0.08, h * 0.12, [220, 40, 40]);
  cv.fillRect(x + w * 0.79, y + h * 0.885, 2, h * 0.07, [220, 40, 40]);
  cv.fillRect(x + w * 0.76, y + h * 0.9, w * 0.05, 2, [220, 40, 40]);
  cv.fillCircle(x + w * 0.74, y + h * 0.97, 2.5, [26, 26, 26]);
  cv.fillCircle(x + w * 0.92, y + h * 0.97, 2.5, [26, 26, 26]);
}

function sceneTube(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [232, 228, 220]);
  // station facade + closed gate
  cv.fillRect(x + w * 0.06, y + h * 0.3, w * 0.88, h * 0.7, [90, 86, 80]);
  for (let i = 0; i < 10; i++) {
    cv.fillRect(x + w * (0.08 + i * 0.088), y + h * 0.34, 3, h * 0.62, [40, 38, 36]);
  }
  // Underground roundel
  const cx = x + w * 0.5;
  const cy = y + h * 0.18;
  cv.ring(cx, cy, Math.min(w, h) * 0.13, Math.max(3, w * 0.02), [220, 30, 30]);
  cv.fillRect(cx - w * 0.2, cy - 3, w * 0.4, 6, [0, 40, 110]);
  // picket signs
  cv.line(x + w * 0.16, y + h * 0.78, x + w * 0.16, y + h * 0.98, 2, [90, 70, 40]);
  cv.fillRect(x + w * 0.08, y + h * 0.66, w * 0.16, h * 0.12, WHITE);
  cv.line(x + w * 0.84, y + h * 0.78, x + w * 0.84, y + h * 0.98, 2, [90, 70, 40]);
  cv.fillRect(x + w * 0.76, y + h * 0.66, w * 0.16, h * 0.12, WHITE);
  // a stopped train front
  cv.roundedRect(x + w * 0.34, y + h * 0.68, w * 0.32, h * 0.3, 4, [200, 30, 30]);
  cv.fillRect(x + w * 0.37, y + h * 0.72, w * 0.1, h * 0.1, [200, 220, 235]);
  cv.fillRect(x + w * 0.53, y + h * 0.72, w * 0.1, h * 0.1, [200, 220, 235]);
}

function sceneTariffs(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h * 0.62, [178, 206, 228], [220, 232, 240]);
  cv.fillRect(x, y + h * 0.62, w, h * 0.38, [28, 80, 130]); // sea
  cv.line(x, y + h * 0.62, x + w, y + h * 0.62, 1, [200, 220, 235]);
  // cargo ship
  cv.polygon([[x + w * 0.06, y + h * 0.66], [x + w * 0.94, y + h * 0.66], [x + w * 0.86, y + h * 0.92], [x + w * 0.14, y + h * 0.92]], [30, 34, 40]);
  const cont: RGB[] = [[200, 60, 50], [40, 110, 190], [60, 160, 80], [230, 170, 40], [150, 60, 140]];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      cv.fillRect(x + w * (0.1 + c * 0.165), y + h * (0.5 - r * 0.09), w * 0.15, h * 0.085, cont[(r * 5 + c) % 5]);
    }
  }
  // bridge tower
  cv.fillRect(x + w * 0.84, y + h * 0.34, w * 0.08, h * 0.32, [240, 240, 235]);
  cv.fillRect(x + w * 0.85, y + h * 0.38, w * 0.06, h * 0.05, [30, 40, 60]);
  // big % in the sky (kept inside the scene: cap top above the rect top)
  drawText(cv, "%", x + w * 0.06, y + h * 0.36, Math.min(w, h) * 0.28, [178, 28, 28], { weight: "bold" });
}

function sceneKospi(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [248, 248, 244]);
  // Seoul tower
  cv.fillRect(x + w * 0.78, y + h * 0.2, 3, h * 0.62, [90, 90, 96]);
  cv.ellipse(x + w * 0.78, y + h * 0.2, w * 0.06, h * 0.05, [60, 90, 140]);
  cv.line(x + w * 0.78, y + h * 0.2, x + w * 0.78, y + h * 0.08, 2, [90, 90, 96]);
  // skyline
  building(cv, x + w * 0.04, y + h * 0.72, w * 0.2, h * 0.28, [120, 124, 130], [90, 94, 100], [240, 220, 120]);
  building(cv, x + w * 0.3, y + h * 0.66, w * 0.18, h * 0.34, [110, 114, 120], [84, 88, 94], [240, 220, 120]);
  building(cv, x + w * 0.55, y + h * 0.76, w * 0.2, h * 0.24, [128, 132, 138], [96, 100, 106], [240, 220, 120]);
  // rising chart line
  const pts: [number, number][] = [];
  const chart = [0.62, 0.58, 0.6, 0.5, 0.52, 0.42, 0.34, 0.36, 0.24, 0.16];
  for (let i = 0; i < chart.length; i++) {
    pts.push([x + w * (0.08 + i * 0.09), y + h * chart[i]]);
  }
  cv.polyline(pts, 3, [22, 140, 70]);
  const last = pts[pts.length - 1];
  cv.polygon([[last[0], last[1] - 7], [last[0] + 8, last[1] + 1], [last[0], last[1] + 7]], [22, 140, 70]);
  drawText(cv, "+1.8%", x + w * 0.06, y + h * 0.14, 13, [22, 140, 70], { weight: "bold" });
}

function sceneKim(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [70, 74, 82], [40, 42, 50]);
  // North Korean flag stripes (top strip)
  cv.fillRect(x, y, w, h * 0.1, [20, 60, 160]);
  cv.fillRect(x, y + h * 0.1, w, h * 0.04, WHITE);
  cv.fillRect(x, y + h * 0.14, w, h * 0.06, [200, 30, 30]);
  // missile on its launcher
  const mx = x + w * 0.42;
  cv.fillRect(mx - w * 0.05, y + h * 0.82, w * 0.24, h * 0.08, [24, 26, 30]); // launcher base
  cv.fillRect(mx - w * 0.035, y + h * 0.3, w * 0.07, h * 0.52, [235, 235, 230]); // body
  cv.polygon([[mx - w * 0.035, y + h * 0.3], [mx, y + h * 0.18], [mx + w * 0.035, y + h * 0.3]], [200, 40, 40]); // nose
  cv.fillRect(mx - w * 0.055, y + h * 0.72, w * 0.02, h * 0.1, [200, 40, 40]); // fin
  cv.fillRect(mx + w * 0.035, y + h * 0.72, w * 0.02, h * 0.1, [200, 40, 40]);
  cv.line(mx - w * 0.02, y + h * 0.4, mx + w * 0.02, y + h * 0.4, 2, [26, 26, 26]);
  // Kim figure in dark suit
  person(cv, x + w * 0.78, y + h * 0.55, h * 0.42, [24, 24, 28], [30, 30, 34]);
  // red star
  star4(cv, x + w * 0.82, y + h * 0.3, Math.max(4, w * 0.04), [220, 40, 40]);
}

function sceneRussianDead(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [120, 118, 110], [70, 68, 62]);
  // rows of crosses
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const cx = x + w * (0.1 + c * 0.11);
      const cy = y + h * (0.3 + r * 0.2);
      cv.line(cx - 3, cy, cx + 3, cy, 2, [235, 232, 225]);
      cv.line(cx, cy - 4, cx, cy + 5, 2, [235, 232, 225]);
    }
  }
  // leaked document
  const dx = x + w * 0.66;
  const dy = y + h * 0.12;
  cv.fillRect(dx, dy, w * 0.3, h * 0.72, [248, 246, 240]);
  cv.line(dx + 4, dy + 4, dx + w * 0.3 - 4, dy + 4, 1, [120, 120, 116]);
  for (let i = 0; i < 5; i++) {
    cv.line(dx + w * 0.04, dy + h * (0.2 + i * 0.09), dx + w * 0.26, dy + h * (0.2 + i * 0.09), 1, [150, 148, 142]);
  }
  cv.ring(dx + w * 0.15, dy + h * 0.58, Math.max(4, w * 0.035), 2, [190, 40, 40]);
}

function sceneBangladesh(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [238, 230, 214]);
  // fabric rolls
  const rollCols: RGB[] = [[200, 60, 60], [40, 120, 140], [230, 180, 40], [90, 140, 60]];
  for (let i = 0; i < 4; i++) {
    const rx = x + w * (0.06 + i * 0.21);
    cv.fillRect(rx, y + h * 0.14, w * 0.16, h * 0.3, rollCols[i]);
    cv.ellipse(rx + w * 0.08, y + h * 0.14, w * 0.08, h * 0.03, mix(rollCols[i], WHITE, 0.4));
  }
  // work tables with sewing machines
  for (let i = 0; i < 2; i++) {
    const tx = x + w * (0.06 + i * 0.48);
    cv.fillRect(tx, y + h * 0.62, w * 0.4, h * 0.05, [120, 84, 52]); // table
    cv.fillRect(tx + w * 0.02, y + h * 0.66, 3, h * 0.3, [110, 78, 48]);
    cv.fillRect(tx + w * 0.36, y + h * 0.66, 3, h * 0.3, [110, 78, 48]);
    cv.fillRect(tx + w * 0.08, y + h * 0.48, w * 0.2, h * 0.12, [70, 72, 78]); // machine body
    cv.line(tx + w * 0.26, y + h * 0.48, tx + w * 0.26, y + h * 0.62, 2, [60, 62, 68]); // needle arm
  }
  // workers
  person(cv, x + w * 0.2, y + h * 0.3, h * 0.32, [30, 90, 140], [50, 50, 54]);
  person(cv, x + w * 0.68, y + h * 0.3, h * 0.32, [160, 40, 90], [50, 50, 54]);
}

function sceneSolomon(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.vgrad(x, y, w, h, [150, 190, 215], [210, 225, 235]);
  // Pacific dots (islands)
  for (let i = 0; i < 12; i++) {
    cv.fillCircle(x + ((i * 67) % Math.max(1, Math.floor(w))), y + h * 0.15 + ((i * 31) % Math.max(1, Math.floor(h * 0.5))), 1.5, [90, 120, 150]);
  }
  // Australia flag (left)
  const ax = x + w * 0.06;
  const ay = y + h * 0.14;
  cv.fillRect(ax, ay, w * 0.36, h * 0.34, [0, 40, 110]);
  cv.fillRect(ax, ay, w * 0.36, h * 0.06, [200, 40, 40]);
  cv.fillRect(ax + w * 0.06, ay, w * 0.03, h * 0.34, [200, 40, 40]);
  star4(cv, ax + w * 0.28, ay + h * 0.2, 4, WHITE);
  star4(cv, ax + w * 0.2, ay + h * 0.28, 3, WHITE);
  // Solomon Islands flag (right)
  const sx = x + w * 0.58;
  cv.polygon([[sx, ay], [sx + w * 0.36, ay], [sx + w * 0.36, ay + h * 0.34], [sx, ay + h * 0.34]], [0, 90, 160]);
  cv.polygon([[sx, ay + h * 0.34], [sx + w * 0.36, ay], [sx + w * 0.36, ay + h * 0.1], [sx, ay + h * 0.34]], [240, 200, 40]);
  cv.polygon([[sx, ay + h * 0.1], [sx + w * 0.36, ay + h * 0.1], [sx + w * 0.36, ay + h * 0.34], [sx, ay + h * 0.34]], [0, 140, 70]);
  star4(cv, sx + w * 0.1, ay + h * 0.08, 3, WHITE);
  star4(cv, sx + w * 0.2, ay + h * 0.12, 3, WHITE);
  // handshake: two forearms meeting in the middle
  const hy = y + h * 0.78;
  cv.fillRect(x + w * 0.08, hy - 5, w * 0.34, 10, [222, 184, 150]);
  cv.fillRect(x + w * 0.58, hy - 5, w * 0.34, 10, [200, 160, 125]);
  cv.fillCircle(x + w * 0.46, hy, 9, [222, 184, 150]);
  cv.fillCircle(x + w * 0.54, hy, 9, [200, 160, 125]);
  cv.line(x + w * 0.44, hy - 8, x + w * 0.56, hy + 8, 1.5, [150, 110, 80]);
  cv.line(x + w * 0.44, hy + 8, x + w * 0.56, hy - 8, 1.5, [150, 110, 80]);
}

const SCENES: Record<string, (cv: Canvas, x: number, y: number, w: number, h: number) => void> = {
  macys: sceneMacys,
  india: sceneIndia,
  chess: sceneChess,
  eu: sceneEU,
  houthi: sceneHouthi,
  kyiv: sceneKyiv,
  tube: sceneTube,
  tariffs: sceneTariffs,
  kospi: sceneKospi,
  kim: sceneKim,
  russiandead: sceneRussianDead,
  bangladesh: sceneBangladesh,
  solomon: sceneSolomon,
};

// ------------------------------------------------------------------- data
interface Story {
  n: number;
  region: string;
  tag: string;
  headline: string;
  summary: string;
  source: string;
  scene: string;
  city: string;
  lon: number;
  lat: number;
}

// 13 illustrated stories (diagnosis §5.1). Summaries are shortened to fit
// their panels; every fact is as verified in the diagnosis.
const ILLUSTRATED: Story[] = [
  { n: 1, region: "Americas", tag: "CONFIRMED", headline: "MACY'S 100TH PARADE GROUNDED", summary: "Nor'easter gusts to 60 mph cancel the parade — first in 100 years. It moves to Sat 08:30 ET.", source: "AP, USA Today", scene: "macys", city: "New York", lon: -74, lat: 40.7 },
  { n: 2, region: "South Asia", tag: "OFFICIAL", headline: "INDIA REMEMBERS 26/11", summary: "18 years since the 2008 Mumbai attacks, on Constitution Day; PM Modi pays tribute.", source: "PTI, PIB", scene: "india", city: "Mumbai", lon: 72.8, lat: 19.1 },
  { n: 3, region: "Space & Tech", tag: "CONFIRMED", headline: "GUKESH v SINDAROV — GAME 3", summary: "World Chess Championship opens in Geneva; Sindarov, 14, is the youngest challenger.", source: "FIDE, Chess.com", scene: "chess", city: "Geneva", lon: 6.1, lat: 46.2 },
  { n: 4, region: "Europe", tag: "OFFICIAL", headline: "EU OPENS SUMMIT ON KYIV'S MONEY", summary: "EU summit opens; a €45bn loan for Ukraine in 2027 is on the table.", source: "European Council, TASS", scene: "eu", city: "Brussels", lon: 4.35, lat: 50.85 },
  { n: 5, region: "Middle East", tag: "REPORTED", headline: "HOUTHI MISSILES OVER RIYADH DESTROYED", summary: "Saudi-led coalition destroys two Houthi missiles over Riyadh.", source: "Reuters, Arab News", scene: "houthi", city: "Riyadh", lon: 46.7, lat: 24.7 },
  { n: 6, region: "Ukraine War", tag: "REPORTED", headline: "KYIV COUNTS 4 HURT AFTER MALL STRIKE", summary: "Russian missiles hit a Kyiv mall; 4 hurt. 88 of 112 drones down.", source: "Kyiv Mayor Klitschko, UNIAN, Reuters", scene: "kyiv", city: "Kyiv", lon: 30.5, lat: 50.45 },
  { n: 7, region: "Europe", tag: "CONFIRMED", headline: "TUBE DRIVERS STRIKE FROM NOON", summary: "RMT strike starts at noon; first of 8 walkouts to Feb 2027.", source: "The Times, TfL", scene: "tube", city: "London", lon: -0.1, lat: 51.5 },
  { n: 8, region: "Americas", tag: "REPORTED", headline: "US TARIFFS HIT 14 PARTNERS", summary: "US proposes Section 301 tariffs on 14 economies.", source: "Reuters", scene: "tariffs", city: "Washington", lon: -77, lat: 38.9 },
  { n: 9, region: "Markets & Economy", tag: "REPORTED", headline: "KOSPI REBOUNDS AS BANK OF KOREA HIKES", summary: "KOSPI +1.8% to 4,782; Bank of Korea hikes to 3.25%.", source: "Korea JoongAng Daily, AJP", scene: "kospi", city: "Seoul", lon: 127, lat: 37.5 },
  { n: 10, region: "Asia-Pacific", tag: "REPORTED", headline: "KIM ORDERS MORE NUKES", summary: "Kim calls for wider tactical nuclear deployment.", source: "Reuters, KCNA", scene: "kim", city: "Pyongyang", lon: 125.75, lat: 39 },
  { n: 11, region: "Ukraine War", tag: "REPORTED", headline: "RUSSIAN WAR DEAD NEAR 500,000", summary: "Leaked data: ~490,334 Russian dead; ~700,000 with missing.", source: "BBC, Le Monde", scene: "russiandead", city: "Moscow", lon: 37.6, lat: 55.75 },
  { n: 12, region: "South Asia", tag: "CONFIRMED", headline: "GARMENT WAGES UP 36%", summary: "Wage board votes 4–2: Tk17,000 (from Tk12,500), effective Dec 1.", source: "AP, The Hindu BusinessLine", scene: "bangladesh", city: "Dhaka", lon: 90.4, lat: 23.8 },
  { n: 13, region: "Asia-Pacific", tag: "CONFIRMED", headline: "SOLOMON ISLANDS SIGNS AUSTRALIA PACT", summary: "Wale and Albanese sign a security pact in Canberra.", source: "Reuters, AP", scene: "solomon", city: "Canberra", lon: 149.1, lat: -35.3 },
];

// 23 listed stories (diagnosis §5.2), one line each + source.
const LISTED: { n: number; text: string; source: string }[] = [
  { n: 14, text: "US markets shut; NFL games today", source: "AP" },
  { n: 15, text: "N. Korea expels Swiss diplomat", source: "Reuters" },
  { n: 16, text: "Judges: drop Netanyahu case", source: "Reuters" },
  { n: 17, text: "US stocks fall into correction", source: "Reuters" },
  { n: 18, text: "Andy Taylor dies at 65", source: "Reuters" },
  { n: 19, text: "2nd judge blocks birthright order", source: "Reuters" },
  { n: 20, text: "Kenyan cult leader convicted again", source: "Reuters" },
  { n: 21, text: "Iowa blast 'huge success'", source: "Al Jazeera" },
  { n: 22, text: "Russia hits Ukraine energy grid", source: "Reuters" },
  { n: 23, text: "Ukraine hits 2 Samara refineries", source: "Reuters" },
  { n: 24, text: "Abu Dhabi peace talks stall", source: "Reuters" },
  { n: 25, text: "NATO chief: Europe must prepare", source: "NATO" },
  { n: 26, text: "Poland urges NATO to down missiles", source: "Reuters" },
  { n: 27, text: "UK RAF shelters jets from drones", source: "UK MoD" },
  { n: 28, text: "US: don't travel to Ukraine", source: "US State Dept" },
  { n: 29, text: "Russian passports blocked", source: "European Council" },
  { n: 30, text: "9 Ukrainian children returned", source: "Reuters" },
  { n: 31, text: "Gaza storm threatens 1.76M", source: "Gaza media" },
  { n: 32, text: "Israel strikes Gaza tower: 2 dead", source: "Reuters" },
  { n: 33, text: "Australia inflation hits 4.9%", source: "ABS" },
  { n: 34, text: "Niger gunmen kill 30+", source: "Reuters" },
  { n: 35, text: "Shenzhou-24 docks with Pakistani", source: "Xinhua" },
  { n: 36, text: "India unveils ₹15,000cr Nepal aid", source: "MEA" },
];

const NUMBERS: { num: string; label: string; source: string }[] = [
  { num: "100", label: "YEARS OF MACY'S PARADE", source: "AP" },
  { num: "490,334", label: "RUSSIAN SOLDIERS DEAD", source: "BBC" },
  { num: "€45bn", label: "EU LOAN FOR UKRAINE", source: "European Council" },
  { num: "+36%", label: "BANGLADESH WAGE RISE", source: "AP" },
  { num: "112", label: "DRONES AT UKRAINE", source: "Ukrainian Air Force" },
  { num: "4,782", label: "KOSPI CLOSE", source: "AJP" },
];

const TIMELINE: { t: string; label: string }[] = [
  { t: "00:40", label: "Kyiv: 4 hurt confirmed" },
  { t: "08:00", label: "88 of 112 drones down" },
  { t: "12:00", label: "Tube strike begins" },
  { t: "13:30", label: "Macy's step-off due" },
  { t: "14:00", label: "Chess Game 3, Geneva" },
  { t: "17:30", label: "NFL kickoff" },
];

// DATE CHECK: events that are NOT 26 November (diagnosis §5.6).
const DATECHECK_L: string[] = [
  "Cairo tanker fire, 31 dead — Wed 25 Nov (Reuters)",
  "US Q3 GDP 4.3% — released Wed 25 Nov (BEA)",
  "FCC authorizes SpaceX Starmind — Wed 25 Nov",
  "Murmansk governor detained — Wed 25 Nov (Reuters)",
  "Kenya–Saudi 293,600 jobs — 12 Nov; clarified 17–18 Nov",
  "Nvidia reinstates Jensen Huang — 24 Nov",
];
const DATECHECK_R: string[] = [
  "COP31 ends without a pact — 22 Nov",
  "Ukraine drones hit ships off Libya — 22 Nov",
  "Belgium strike grounds flights — 23 Nov",
  "UNRWA worker killed in Gaza — 23 Nov",
  "US shelves Russia deal plan — 25 Nov",
];

const REGIONS = ["Americas", "Europe", "Middle East", "Ukraine War", "Asia-Pacific", "South Asia", "Africa", "Space & Tech", "Markets & Economy"];
const REGION_COLORS: Record<string, RGB> = {
  Americas: [29, 78, 216],
  Europe: [14, 116, 144],
  "Middle East": [180, 83, 9],
  "Ukraine War": [77, 124, 15],
  "Asia-Pacific": [15, 118, 110],
  "South Asia": [190, 24, 93],
  Africa: [161, 98, 7],
  "Space & Tech": [109, 40, 217],
  "Markets & Economy": [3, 105, 161],
};

// Simplified continent outlines as [lon, lat] points (equirectangular).
const CONTINENTS: [number, number][][] = [
  [[-168, 66], [-140, 70], [-125, 72], [-110, 73], [-95, 80], [-85, 80], [-80, 73], [-75, 72], [-65, 60], [-55, 52], [-60, 47], [-70, 42], [-75, 35], [-80, 32], [-81, 26], [-84, 30], [-90, 21], [-97, 16], [-94, 17], [-105, 20], [-110, 23], [-115, 30], [-125, 40], [-125, 49], [-135, 58], [-155, 58], [-165, 60]],
  [[-80, 9], [-77, 4], [-75, -5], [-80, -6], [-81, -15], [-77, -20], [-70, -23], [-70, -35], [-68, -45], [-65, -52], [-68, -55], [-60, -45], [-55, -35], [-48, -28], [-40, -20], [-35, -8], [-40, -3], [-50, 0], [-55, 5], [-60, 8], [-70, 11], [-77, 8]],
  [[-17, 15], [-15, 20], [-10, 30], [0, 36], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [43, 11], [48, 10], [51, 12], [44, 0], [40, -10], [35, -20], [32, -28], [28, -33], [20, -35], [15, -30], [12, -18], [13, -10], [9, 4], [0, 6], [-8, 5], [-13, 8], [-17, 12]],
  [[-10, 36], [-9, 43], [-2, 48], [-5, 50], [0, 51], [5, 53], [8, 57], [10, 59], [5, 60], [5, 62], [12, 65], [18, 69], [25, 71], [30, 70], [40, 68], [50, 69], [60, 69], [70, 72], [80, 73], [90, 75], [100, 76], [110, 74], [120, 73], [130, 72], [140, 72], [150, 70], [160, 70], [170, 66], [178, 65], [170, 60], [162, 58], [158, 52], [150, 59], [142, 55], [140, 50], [135, 45], [130, 42], [127, 40], [126, 38], [122, 38], [120, 32], [118, 25], [110, 20], [108, 12], [105, 9], [103, 2], [100, 7], [98, 10], [95, 16], [92, 21], [90, 22], [86, 20], [82, 17], [80, 13], [77, 8], [75, 10], [72, 20], [68, 23], [65, 25], [60, 25], [57, 26], [52, 28], [50, 29], [48, 30], [44, 29], [40, 32], [36, 36], [30, 36], [26, 38], [22, 37], [19, 40], [15, 44], [12, 44], [8, 44], [3, 43], [0, 40], [-2, 37], [-6, 36]],
  [[113, -22], [114, -30], [115, -35], [120, -34], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20], [114, -21]],
  [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51], [-2, 50]],
  [[130, 31], [132, 33], [135, 34], [138, 35], [140, 36], [141, 38], [141, 41], [140, 44], [142, 45], [143, 42], [141, 39], [139, 37], [136, 35], [133, 34], [131, 32]],
  [[-45, 60], [-40, 64], [-32, 68], [-25, 70], [-20, 74], [-25, 78], [-35, 80], [-50, 78], [-58, 74], [-55, 70], [-52, 64], [-48, 60]],
  [[44, -16], [47, -15], [50, -16], [49, -20], [47, -25], [44, -25], [43, -20]],
  [[167, -45], [170, -43], [173, -41], [175, -38], [177, -38], [178, -37], [175, -40], [173, -42], [170, -44]],
  [[-22, 64], [-18, 66], [-14, 64], [-18, 63]],
];

function project(lon: number, lat: number, x: number, y: number, w: number, h: number): [number, number] {
  // Equirectangular over lon -170..190, lat -60..85.
  const px = x + ((lon + 170) / 360) * w;
  const py = y + ((85 - lat) / 145) * h;
  return [px, py];
}

function drawMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, SEA);
  // faint graticule
  for (let lon = -150; lon <= 180; lon += 30) {
    const [px] = project(lon, 0, x, y, w, h);
    cv.line(px, y, px, y + h, 1, [196, 212, 226]);
  }
  for (let lat = -45; lat <= 75; lat += 30) {
    const [, py] = project(0, lat, x, y, w, h);
    cv.line(x, py, x + w, py, 1, [196, 212, 226]);
  }
  for (const cont of CONTINENTS) {
    const pts = cont.map(([lo, la]) => project(lo, la, x, y, w, h));
    cv.polygon(pts, LAND);
  }
  // pins (small: European cities sit only a few px apart)
  for (const s of ILLUSTRATED) {
    const [px, py] = project(s.lon, s.lat, x, y, w, h);
    cv.fillCircle(px, py, 6, RED);
    cv.ring(px, py, 6, 1, WHITE);
    const num = String(s.n);
    const tw = textWidth(num, 7.5, 0);
    drawText(cv, num, px - tw / 2, py + 2.8, 7.5, WHITE, { weight: "bold" });
  }
}

// ------------------------------------------------------------------ layout
const WARN: string[] = [];

const LISTED_REGION: Record<number, string> = {
  14: "Americas", 15: "Asia-Pacific", 16: "Middle East", 17: "Markets & Economy",
  18: "Europe", 19: "Americas", 20: "Africa", 21: "Americas", 22: "Ukraine War",
  23: "Ukraine War", 24: "Middle East", 25: "Europe", 26: "Europe", 27: "Europe",
  28: "Americas", 29: "Europe", 30: "Ukraine War", 31: "Middle East",
  32: "Middle East", 33: "Asia-Pacific", 34: "Africa", 35: "Asia-Pacific",
  36: "South Asia",
};

function frame(cv: Canvas, x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  cv.fillRect(x, y, w, t, c);
  cv.fillRect(x, y + h - t, w, t, c);
  cv.fillRect(x, y, t, h, c);
  cv.fillRect(x + w - t, y, t, h, c);
}

// Fit text into maxLines lines: shrink size first, then trim words (with "…").
function fitBlock(text: string, maxSize: number, minSize: number, maxW: number, maxLines: number, o: TextOpts): { size: number; lines: string[]; trimmed: boolean } {
  for (let s = maxSize; s >= minSize; s -= 0.5) {
    const lines = wrapText(text, s, maxW, o.tracking ?? 0);
    if (lines.length <= maxLines) return { size: s, lines, trimmed: false };
  }
  let words = text.split(" ");
  while (words.length > 1) {
    const lines = wrapText(words.join(" ") + " …", minSize, maxW, o.tracking ?? 0);
    if (lines.length <= maxLines) return { size: minSize, lines, trimmed: true };
    words.pop();
  }
  return { size: minSize, lines: wrapText(words.join(" ") + " …", minSize, maxW, o.tracking ?? 0), trimmed: true };
}

function drawLines(cv: Canvas, lines: string[], x: number, baseline1: number, leading: number, size: number, c: RGB, o: TextOpts = {}): void {
  for (let i = 0; i < lines.length; i++) {
    drawText(cv, lines[i], x, baseline1 + i * leading, size, c, o);
  }
}

function tagColor(tag: string): RGB {
  if (tag === "CONFIRMED") return [22, 140, 70];
  if (tag === "OFFICIAL") return [0, 51, 102];
  return [180, 83, 9]; // REPORTED
}

function drawTagPill(cv: Canvas, tag: string, x: number, y: number, size: number): void {
  const w = textWidth(tag, size, 0) + 14;
  const h = size + 7;
  cv.fillRect(x - w, y, w, h, tagColor(tag));
  drawText(cv, tag, x - w + 7, y + size + 2.5, size, WHITE, { weight: "bold" });
}

function drawNumberBadge(cv: Canvas, n: number, cx: number, cy: number, r: number, size: number): void {
  cv.fillCircle(cx, cy, r, RED);
  cv.ring(cx, cy, r, 1.5, WHITE);
  const t = String(n);
  drawText(cv, t, cx - textWidth(t, size, 0) / 2, cy + size * 0.36, size, WHITE, { weight: "bold" });
}

function drawMasthead(cv: Canvas): void {
  drawText(cv, "DAILY RECORD", 12, 28, 10, INK, { weight: "bold", tracking: 1 });
  const ed = "THURSDAY EDITION";
  drawText(cv, ed, 1012 - textWidth(ed, 10, 1), 28, 10, INK, { weight: "bold", tracking: 1 });
  const vol = "VOL. I · No. 330";
  drawText(cv, vol, 512 - textWidth(vol, 10, 1) / 2, 28, 10, INK, { tracking: 1 });
  const title = "THE WORLD IN ONE DAY";
  const tSize = fitSize(title, 60, 48, 1000, 1);
  drawTextCentered(cv, title, 512, 90, tSize, INK, { serif: true, weight: "medium", tracking: 2 });
  const date = "THURSDAY, 26 NOVEMBER 2026";
  const dSize = 19;
  const dw = textWidth(date, dSize, 0);
  cv.line(12, 123, 512 - dw / 2 - 14, 123, 1, INK);
  cv.line(512 + dw / 2 + 14, 123, 1012, 123, 1, INK);
  drawTextCentered(cv, date, 512, 130, dSize, INK, { weight: "bold" });
  cv.fillRect(12, 138, 1000, 2, INK);
}

function drawRegionBar(cv: Canvas): void {
  const counts: Record<string, number> = {};
  for (const s of ILLUSTRATED) counts[s.region] = (counts[s.region] ?? 0) + 1;
  for (const n of Object.keys(LISTED_REGION)) {
    const r = LISTED_REGION[Number(n)];
    counts[r] = (counts[r] ?? 0) + 1;
  }
  const label = "9 REGIONS:";
  drawText(cv, label, 12, 155, 11, INK, { weight: "bold" });
  let cx = 12 + textWidth(label, 11, 0) + 14;
  for (const r of REGIONS) {
    const chip = r + " (" + (counts[r] ?? 0) + ")";
    cv.fillCircle(cx + 4, 151, 3.5, REGION_COLORS[r]);
    drawText(cv, chip, cx + 11, 155, 9, INK);
    cx += 11 + textWidth(chip, 9, 0) + 15;
  }
  if (cx > 1012) WARN.push("region bar overflows by " + Math.round(cx - 1012) + "px");
  cv.line(12, 160, 1012, 160, 1, GREY);
}

function drawHero(cv: Canvas, s: Story, x: number, y: number): void {
  const w = 328;
  const h = 210;
  SCENES[s.scene](cv, x + 1, y + 1, w - 2, 99);
  frame(cv, x, y, w, h, 1, INK);
  drawNumberBadge(cv, s.n, x + 16, y + 16, 13, 13);
  drawTagPill(cv, s.tag, x + w - 7, y + 7, 10);
  // Headlines are all caps (no descenders): leading = size + 3.
  const head = fitBlock(s.headline, 22, 17, 312, 2, { serif: true, weight: "bold" });
  drawLines(cv, head.lines, x + 8, y + 126, 25, head.size, INK, { serif: true, weight: "bold" });
  if (head.trimmed) WARN.push("hero #" + s.n + " headline trimmed");
  // Summaries are mixed case: leading = size x 1.3 + 2.
  const sum = fitBlock(s.summary, 11, 10, 312, 2, {});
  drawLines(cv, sum.lines, x + 8, y + 167, 16, sum.size, INK);
  if (sum.trimmed) WARN.push("hero #" + s.n + " summary trimmed to fit 2 lines");
  drawText(cv, "Source: " + s.source, x + 8, y + 199, 9, GREY);
}

function drawMedium(cv: Canvas, s: Story, x: number, y: number): void {
  const w = 193;
  const h = 136;
  SCENES[s.scene](cv, x + 1, y + 1, w - 2, 55);
  frame(cv, x, y, w, h, 1, INK);
  drawNumberBadge(cv, s.n, x + 11, y + 11, 9.5, 9);
  drawTagPill(cv, s.tag, x + w - 5, y + 5, 8);
  const head = fitBlock(s.headline, 15, 12, 181, 2, { serif: true, weight: "bold" });
  drawLines(cv, head.lines, x + 6, y + 72, 18, head.size, INK, { serif: true, weight: "bold" });
  if (head.trimmed) WARN.push("medium #" + s.n + " headline trimmed");
  const sum = fitBlock(s.summary, 11, 9.5, 181, 2, {});
  drawLines(cv, sum.lines, x + 6, y + 104, 16, sum.size, INK);
  if (sum.trimmed) WARN.push("medium #" + s.n + " summary trimmed to fit 2 lines");
  const src = "Source: " + s.source.split(",")[0];
  drawText(cv, src, x + 6, y + 134, 8.5, GREY);
}

function drawNumbers(cv: Canvas): void {
  const y = 650;
  const h = 40;
  frame(cv, 12, y, 1000, h, 1, INK);
  // label cell
  cv.fillRect(12, y, 142, h, INK);
  drawTextCentered(cv, "BY THE", 12 + 71, y + 20, 9, WHITE, { weight: "bold" });
  drawTextCentered(cv, "NUMBERS", 12 + 71, y + 33, 9, WHITE, { weight: "bold" });
  for (let i = 0; i < NUMBERS.length; i++) {
    const cx = 12 + 143 * (i + 1) + 71;
    cv.line(12 + 143 * (i + 1), y, 12 + 143 * (i + 1), y + h, 1, GREY);
    drawTextCentered(cv, NUMBERS[i].num, cx, y + 22, 18, INK, { serif: true, weight: "bold" });
    drawTextCentered(cv, NUMBERS[i].label, cx, y + 36, 8, INK, { weight: "bold" });
  }
}

function drawMapList(cv: Canvas): void {
  const y = 692;
  // map (144 tall; legend strip below it)
  drawMap(cv, 13, 693, 318, 142);
  frame(cv, 12, y, 320, 144, 1, INK);
  cv.fillRect(18, 698, 118, 15, INK);
  drawTextCentered(cv, "WHERE IT HAPPENED", 18 + 59, 709, 8.5, WHITE, { weight: "bold" });
  // pin legend strip under the map
  frame(cv, 12, 838, 320, 30, 1, GREY);
  drawTextCentered(cv, "1 NEW YORK · 2 MUMBAI · 3 GENEVA · 4 BRUSSELS · 5 RIYADH · 6 KYIV · 7 LONDON", 172, 849, 8, INK);
  drawTextCentered(cv, "8 WASHINGTON · 9 SEOUL · 10 PYONGYANG · 11 MOSCOW · 12 DHAKA · 13 CANBERRA", 172, 862, 8, INK);
  // listed stories, two columns, 10px with 14.5 leading (10 x 1.3 + 1.5)
  const cols: { n: number; text: string; source: string }[][] = [LISTED.slice(0, 12), LISTED.slice(12)];
  const colX = [340, 680];
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < cols[c].length; i++) {
      const it = cols[c][i];
      const line = it.n + ". " + it.text + " — " + it.source;
      const lw = textWidth(line, 10, 0);
      if (lw > 332) WARN.push("listed #" + it.n + " overflows by " + Math.round(lw - 332) + "px: " + line);
      drawText(cv, line, colX[c], y + 12 + i * 14.5, 10, INK);
    }
  }
}

function drawTimeline(cv: Canvas): void {
  const y = 870;
  drawText(cv, "TIMELINE (UTC)", 12, 880, 10, INK, { weight: "bold" });
  cv.line(118, 883, 1012, 883, 1, GREY);
  for (let i = 0; i < TIMELINE.length; i++) {
    const px = 118 + (i + 0.5) * (894 / 6);
    cv.fillCircle(px, 883, 3.5, RED);
    drawTextCentered(cv, TIMELINE[i].t, px, 880, 10, INK, { weight: "bold" });
    drawTextCentered(cv, TIMELINE[i].label, px, 893, 9, INK);
  }
}

function drawDateCheck(cv: Canvas): void {
  const y = 896;
  const h = 78;
  frame(cv, 12, y, 1000, h, 1, INK);
  cv.fillRect(12, y, 1000, 17, INK);
  drawTextCentered(cv, "DATE CHECK — NOT 26 NOVEMBER", 512, y + 13, 11, WHITE, { weight: "bold" });
  const drawItem = (text: string, x: number, baseline: number): void => {
    cv.line(x, baseline - 6, x + 6, baseline, 1.5, RED);
    cv.line(x + 6, baseline, x + 12, baseline - 6, 1.5, RED);
    drawText(cv, text, x + 12, baseline, 9.5, INK);
  };
  // 11 items in 3 columns (4 + 4 + 3), 12.5 leading for 9.5px text
  const items = [...DATECHECK_L, ...DATECHECK_R];
  const colX = [24, 352, 680];
  const colItems = [items.slice(0, 4), items.slice(4, 8), items.slice(8)];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < colItems[c].length; i++) {
      drawItem(colItems[c][i], colX[c], y + 29 + i * 12.5);
    }
  }
}

function drawFooter(cv: Canvas): void {
  const f = "36 STORIES · 9 REGIONS · EVERY STORY NAMES ITS SOURCE · WHAT IS NOT TODAY: SEE DATE CHECK";
  drawTextCentered(cv, f, 512, 992, 10, INK);
}

function main(): void {
  const cv = new Canvas(W, H, PAPER);
  cv.fillRect(0, 0, W, H, PAPER);
  frame(cv, 6, 6, W - 12, H - 12, 2, INK);
  frame(cv, 10, 10, W - 20, H - 20, 1, INK);
  drawMasthead(cv);
  drawRegionBar(cv);
  const heroX = [12, 348, 684];
  for (let i = 0; i < 3; i++) drawHero(cv, ILLUSTRATED[i], heroX[i], 162);
  const medX = [12, 213, 414, 615, 816];
  for (let i = 0; i < 5; i++) drawMedium(cv, ILLUSTRATED[3 + i], medX[i], 374);
  for (let i = 0; i < 5; i++) drawMedium(cv, ILLUSTRATED[8 + i], medX[i], 512);
  drawNumbers(cv);
  drawMapList(cv);
  drawTimeline(cv);
  drawDateCheck(cv);
  drawFooter(cv);
  const png = encodePNG(W, H, cv.buf);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
  console.log("entry.png bytes=" + png.length);
  if (WARN.length) {
    for (const w of WARN) console.error("WARN: " + w);
  } else {
    console.log("no warnings");
  }
}

main();
