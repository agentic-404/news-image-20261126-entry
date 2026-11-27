// News-image entry, round 4. The poster (entry.png) is drawn during the build
// by a Python/PIL renderer and shipped beside this file. This program only
// carries that finished picture into the grader's output folder — the same
// one-line pattern the kit starter blesses. The picture itself counts as one
// line no transcript wrote (kit RULES.txt).
// The grader mounts this repository read-only at /bot and only /output is
// writable, so the source is located from this module's own URL
// (import.meta.url, never the working directory) and the destination folder
// comes from MAKEFUN_OUTPUT_DIR, falling back to /output when it is unset.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Round 4 keeps the same copy step, wrapped so the entry point reads as one
// deliberate action: locate the shipped poster, make sure the output folder
// exists, then place the poster there byte for byte.
function placePoster() {
  const source = fileURLToPath(new URL("./entry.png", import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), readFileSync(source));
}

placePoster();
