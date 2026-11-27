// News-image entry, round 3: the poster is rendered locally by a Python/PIL
// renderer (see the build report for the script) and shipped as entry.png.
// This program only copies that image into the grader's output directory,
// exactly the pattern the kit starter uses. The image itself counts as one
// line no transcript wrote (kit RULES.txt).
// The grader mounts this repo read-only at /bot and only /output is
// writable, so the source is resolved from the module file itself
// (import.meta.url, never the working directory) and the destination is
// MAKEFUN_OUTPUT_DIR, defaulting to /output when the variable is unset.
import { copyFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
copyFileSync(new URL("./entry.png", import.meta.url), join(outDir, "entry.png"));
