/**
 * One-shot / repeatable: replace Chinese (and mixed CN/EN) instrumentation labels in
 * `TS Data.csv` with English PascalCase-style names (consistent with AcousticGuitar, etc.).
 *
 * Token tables: `scripts/instrument-translation-data.mjs`
 * Parsing after edit: `src/instrumentNames.ts`
 *
 * Run: node scripts/translate-instrument-csv.mjs
 * Then: npm run instruments:list
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import {
  INSTRUMENT_PHRASES_FOR_CSV,
  INSTRUMENT_TOKEN_PAIRS_FOR_CSV,
} from "./instrument-translation-data.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "TS Data.csv");

function slugHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function applyPhrases(s) {
  let out = s;
  for (const [zh, en] of INSTRUMENT_PHRASES_FOR_CSV) {
    if (out.includes(zh)) out = out.split(zh).join(en);
  }
  return out;
}

function translateInstrumentName(name) {
  let s = name.trim();
  for (const [zh, en] of INSTRUMENT_TOKEN_PAIRS_FOR_CSV) {
    if (s.includes(zh)) s = s.split(zh).join(en);
  }
  return s;
}

function translateSongInstrumentationCell(cell) {
  if (cell == null || cell === "") return cell;
  let s = applyPhrases(String(cell));
  return s
    .split("、")
    .map((part) => {
      const m = part.match(/^(.+?)\((\d+(?:\.\d+)?)\s*%\)$/);
      if (!m) return part;
      const name = translateInstrumentName(m[1]);
      return `${name}(${m[2]}%)`;
    })
    .join("、");
}

function translateAlbumInstrumentationCell(cell) {
  if (cell == null || cell === "") return cell;
  let s = applyPhrases(String(cell));
  for (const [zh, en] of INSTRUMENT_TOKEN_PAIRS_FOR_CSV) {
    if (s.includes(zh)) s = s.split(zh).join(en);
  }
  return s;
}

const csv = fs.readFileSync(csvPath, "utf8");
const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => slugHeader(h.replace(/^\ufeff/, "")),
});

const albumKey = "album_instrumentation_types_proportions";
const songKey = "song_instrumentation_types_proportions";

let rows = 0;
for (const row of parsed.data) {
  if (row[albumKey] != null) {
    row[albumKey] = translateAlbumInstrumentationCell(row[albumKey]);
  }
  if (row[songKey] != null) {
    row[songKey] = translateSongInstrumentationCell(row[songKey]);
  }
  rows++;
}

/** Map slugged keys back to original CSV column titles. */
const HEADER_DISPLAY = [
  "Album Number",
  "Album Name",
  "Release Date",
  "Taylor's Musical Era",
  "Album Instrumentation Types & Proportions",
  "Songs Included in Album",
  "Song Chord Progressions",
  "Song Modes/Keys",
  "Song Instrumentation Types & Proportions",
];

const outRows = parsed.data.map((row) =>
  parsed.meta.fields.map((k) => row[k] ?? "")
);
const out = Papa.unparse(
  { fields: HEADER_DISPLAY, data: outRows },
  { newline: "\n", quotes: true, quoteChar: '"', escapeChar: '"', delimiter: "," }
);

fs.writeFileSync(csvPath, out, "utf8");
console.log("Updated", rows, "rows in", path.relative(root, csvPath));

const re = /[\u4e00-\u9fff]/;
let leaks = 0;
for (const row of parsed.data) {
  for (const k of [albumKey, songKey]) {
    const v = row[k];
    if (v && re.test(String(v))) {
      leaks++;
      console.warn("Remaining CJK in", k, ":", String(v).slice(0, 120));
    }
  }
}
if (leaks === 0) console.log("No CJK left in instrumentation columns.");
