import Papa from "papaparse";

export type AlbumAchievement = {
  albumNumber: number;
  albumName: string;
  sales: number;
  grammyWins: number;
  grammyNominations: number;
};

function slugHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

type RawRow = Record<string, string>;

function cell(row: RawRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseSales(raw: string): number {
  const n = parseInt(String(raw).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseGrammy(raw: string): number {
  const t = String(raw).trim();
  if (!t || /^pending$/i.test(t)) return 0;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Album-level stats from `TS Data 02.csv` (key = album number). */
export function parseAchievementCsv(csvText: string): Map<number, AlbumAchievement> {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => slugHeader(h.replace(/^\ufeff/, "")),
  });

  if (parsed.errors.length) {
    console.warn("Achievement CSV parse warnings:", parsed.errors);
  }

  const map = new Map<number, AlbumAchievement>();
  for (const row of parsed.data) {
    const numStr = cell(row, "no", "album_number", "albumnumber");
    const num = parseInt(numStr, 10);
    if (!Number.isFinite(num)) continue;

    map.set(num, {
      albumNumber: num,
      albumName: cell(row, "album", "album_name", "albumname") || `Album ${num}`,
      sales: parseSales(cell(row, "worldwide_sales_est", "worldwidesalesest")),
      grammyWins: parseGrammy(cell(row, "grammy_wins", "grammywins")),
      grammyNominations: parseGrammy(cell(row, "grammy_nominations", "grammynominations")),
    });
  }

  return map;
}
