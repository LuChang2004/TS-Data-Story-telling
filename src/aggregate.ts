import type { CountRecord, SongEntry } from "./types";

export type { CountRecord };

/** One field may list several progressions separated by `;` — each counts separately in charts. */
export function chordProgressionSegments(progression: string): string[] {
  return progression
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^unknown$/i.test(s));
}

export function chordCountsFromSongs(songs: SongEntry[]): CountRecord {
  const acc: CountRecord = {};
  for (const s of songs) {
    for (const seg of chordProgressionSegments(s.chordProgression)) {
      acc[seg] = (acc[seg] ?? 0) + 1;
    }
  }
  return acc;
}

/** Sums each instrument's percentage across tracks (weights reflect album-wide emphasis). @see instrumentNames.ts */
export function instrumentWeightsFromSongs(songs: SongEntry[]): CountRecord {
  const acc: CountRecord = {};
  for (const s of songs) {
    for (const { name, percent } of s.instrumentation) {
      const key = name.trim();
      if (!key) continue;
      acc[key] = (acc[key] ?? 0) + percent;
    }
  }
  return acc;
}

export function topChordProgressions(
  chords: CountRecord,
  limit: number
): { name: string; value: number }[] {
  return Object.entries(chords)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value)
    .slice(0, limit);
}

export function instrumentationRanking(
  instruments: CountRecord
): { name: string; value: number; ratio: number }[] {
  const entries = Object.entries(instruments)
    .map(([name, value]) => ({ name, value }))
    .sort((x, y) => y.value - x.value);
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  return entries.map((e) => ({
    ...e,
    ratio: e.value / total,
  }));
}
