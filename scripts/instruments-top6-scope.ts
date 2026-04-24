/**
 * Union of instrument names that ever appear in the album-level top 6
 * (same aggregation + sort as `instrumentationRanking` + `VIZ_INSTRUMENT_RANK_SHOW`).
 *
 * Run: npm run instruments:top6
 * Writes: public/instrument-icons/INSTRUMENT_NAMES_TOP6.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { instrumentationRanking } from "../src/aggregate";
import { buildAlbumsFromCsv } from "../src/tsDataCsv";
import { VIZ_INSTRUMENT_RANK_SHOW } from "../src/vizRender";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "src", "data", "ts-data.csv");
const outFile = path.join(
  root,
  "public",
  "instrument-icons",
  "INSTRUMENT_NAMES_TOP6.txt"
);

const text = fs.readFileSync(csvPath, "utf8");
const albums = buildAlbumsFromCsv(text);
const set = new Set<string>();
for (const a of albums) {
  const top = instrumentationRanking(a.instrumentWeights).slice(
    0,
    VIZ_INSTRUMENT_RANK_SHOW
  );
  for (const { name } of top) set.add(name);
}

const sorted = [...set].sort((a, b) => a.localeCompare(b, "en"));
const header = `# Instruments that can appear in the Analysis column top-${VIZ_INSTRUMENT_RANK_SHOW} (union across all albums).
# Same logic as src/aggregate.ts instrumentationRanking + src/vizRender.ts VIZ_INSTRUMENT_RANK_SHOW.
# Regenerate: npm run instruments:top6
`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, header + sorted.join("\n") + "\n", "utf8");
console.log(
  sorted.length,
  "names →",
  path.relative(root, outFile)
);
console.log(sorted.join("\n"));
