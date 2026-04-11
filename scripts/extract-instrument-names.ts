/**
 * Regenerates `public/instrument-icons/INSTRUMENT_NAMES.txt` from `TS Data.csv`
 * using `parseInstrumentationString` from `src/instrumentNames.ts` (single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { parseInstrumentationString } from "../src/instrumentNames";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "TS Data.csv");
const outDir = path.join(root, "public", "instrument-icons");
const outFile = path.join(outDir, "INSTRUMENT_NAMES.txt");

function slugHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

if (!fs.existsSync(csvPath)) {
  console.error("Missing TS Data.csv at project root:", csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf8");
const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
const parsed = Papa.parse<Record<string, string>>(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => slugHeader(h.replace(/^\ufeff/, "")),
});

const set = new Set<string>();
for (const row of parsed.data) {
  const cell = row.song_instrumentation_types_proportions;
  if (!cell) continue;
  for (const { name } of parseInstrumentationString(String(cell))) set.add(name);
}

const sorted = [...set].sort((a, b) => a.localeCompare(b, "en"));
fs.mkdirSync(outDir, { recursive: true });
const header = `# Canonical instrument names (after cleaning). One per line.
# Source: TS Data.csv → src/instrumentNames.ts → parseInstrumentationString
# PNG: public/instrument-icons/{encodeURIComponent(name)}.png
# Regenerate: npm run instruments:list
`;
fs.writeFileSync(outFile, header + sorted.join("\n") + "\n", "utf8");
console.log("Wrote", sorted.length, "names to", path.relative(root, outFile));
