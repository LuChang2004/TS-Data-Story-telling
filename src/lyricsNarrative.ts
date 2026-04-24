import Papa from "papaparse";

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

function normalizeLoose(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTight(s: string): string {
  return normalizeLoose(s).replace(/\s+/g, "");
}

function makeKey(album: string, title: string): string {
  return `${normalizeTight(album)}::${normalizeTight(title)}`;
}

const FIRST_PERSON = new Set([
  "i",
  "me",
  "my",
  "mine",
  "myself",
  "im",
  "ive",
  "ill",
  "id",
  "we",
  "us",
  "our",
  "ours",
  "ourselves",
]);

const THIRD_PERSON = new Set([
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
]);

function scoreLyricsSelfFiction(rawLyrics: string): number {
  const clean = rawLyrics
    .toLowerCase()
    .replace(/you might also like/g, " ")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return 0;

  const tokens = clean
    .split(" ")
    .map((t) => t.replace(/^'+|'+$/g, "").replace(/'/g, ""))
    .filter(Boolean);

  let first = 0;
  let third = 0;
  for (const t of tokens) {
    if (FIRST_PERSON.has(t)) first += 1;
    if (THIRD_PERSON.has(t)) third += 1;
  }

  // Self = negative, Fictional = positive.
  const base = (third - first) / Math.max(1, first + third);
  return clamp11(base);
}

export type LyricsNarrativeLookup = {
  getScore: (albumName: string, songTitle: string) => number | undefined;
  getLyrics: (albumName: string, songTitle: string) => string | undefined;
};

export function createLyricsNarrativeLookup(csvText: string): LyricsNarrativeLookup {
  if (!csvText.trim()) {
    return { getScore: () => undefined, getLyrics: () => undefined };
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const byAlbumTitle = new Map<string, number>();
  const byTitleLoose = new Map<string, number[]>();
  const lyricsByAlbumTitle = new Map<string, string>();
  const lyricsByTitleLoose = new Map<string, string[]>();

  for (const row of parsed.data) {
    const album = String(row["Album"] ?? "").trim();
    const title = String(row["Song Name"] ?? "").trim();
    const lyrics = String(row["Lyrics"] ?? "").trim();
    if (!title || !lyrics) continue;
    const score = scoreLyricsSelfFiction(lyrics);

    byAlbumTitle.set(makeKey(album, title), score);
    lyricsByAlbumTitle.set(makeKey(album, title), lyrics);
    const t = normalizeTight(title);
    const arr = byTitleLoose.get(t);
    if (arr) arr.push(score);
    else byTitleLoose.set(t, [score]);
    const larr = lyricsByTitleLoose.get(t);
    if (larr) larr.push(lyrics);
    else lyricsByTitleLoose.set(t, [lyrics]);
  }

  return {
    getScore(albumName: string, songTitle: string): number | undefined {
      const strict = byAlbumTitle.get(makeKey(albumName, songTitle));
      if (strict !== undefined) return strict;
      const arr = byTitleLoose.get(normalizeTight(songTitle));
      if (!arr?.length) return undefined;
      // If title matches multiple entries, use average as a stable fallback.
      const s = arr.reduce((a, b) => a + b, 0) / arr.length;
      return clamp11(s);
    },
    getLyrics(albumName: string, songTitle: string): string | undefined {
      const strict = lyricsByAlbumTitle.get(makeKey(albumName, songTitle));
      if (strict) return strict;
      const arr = lyricsByTitleLoose.get(normalizeTight(songTitle));
      if (!arr?.length) return undefined;
      return arr[0];
    },
  };
}

