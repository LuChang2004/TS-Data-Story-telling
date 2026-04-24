import * as XLSX from "xlsx";

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

function normalizeTight(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function makeKey(album: string, title: string): string {
  return `${normalizeTight(album)}::${normalizeTight(title)}`;
}

const TONIC_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function parsePitchClass(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  // Dataset may use Spotify convention (0-11) or user-facing 1-12.
  if (n >= 0 && n <= 11) return Math.trunc(n);
  if (n >= 1 && n <= 12) return Math.trunc(n - 1);
  return undefined;
}

function tempoToCalmIntense(tempoRaw: unknown): number | undefined {
  const t = Number(tempoRaw);
  if (!Number.isFinite(t)) return undefined;
  // 55 BPM -> -1 (calm), 165 BPM -> +1 (intense), linear in-between.
  return clamp11((t - 110) / 55);
}

export type SpotifySongMeta = {
  tempoBpm?: number;
  keyPitchClass?: number;
  keyTonic?: string;
  calmIntenseScore?: number;
};

export type SpotifyMetaLookup = {
  getMeta: (albumName: string, songTitle: string) => SpotifySongMeta | undefined;
};

export function createSpotifyMetaLookupFromWorkbook(
  workbookArrayBuffer: ArrayBuffer
): SpotifyMetaLookup {
  if (workbookArrayBuffer.byteLength < 8) {
    return { getMeta: () => undefined };
  }

  const wb = XLSX.read(workbookArrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });

  const byAlbumSong = new Map<string, SpotifySongMeta>();
  const bySongLoose = new Map<string, SpotifySongMeta[]>();

  for (const row of rows) {
    const album = String(row["Album"] ?? "").trim();
    const song = String(row["Song Name"] ?? "").trim();
    if (!song) continue;

    const keyPitchClass = parsePitchClass(row["Key"]);
    const tempoBpm = Number(row["Tempo"]);
    const meta: SpotifySongMeta = {
      tempoBpm: Number.isFinite(tempoBpm) ? tempoBpm : undefined,
      keyPitchClass,
      keyTonic:
        typeof keyPitchClass === "number" ? TONIC_NAMES[keyPitchClass] : undefined,
      calmIntenseScore: tempoToCalmIntense(row["Tempo"]),
    };

    byAlbumSong.set(makeKey(album, song), meta);
    const looseKey = normalizeTight(song);
    const arr = bySongLoose.get(looseKey);
    if (arr) arr.push(meta);
    else bySongLoose.set(looseKey, [meta]);
  }

  return {
    getMeta(albumName: string, songTitle: string): SpotifySongMeta | undefined {
      const strict = byAlbumSong.get(makeKey(albumName, songTitle));
      if (strict) return strict;
      const arr = bySongLoose.get(normalizeTight(songTitle));
      if (!arr?.length) return undefined;
      // title-only fallback: average available numeric fields.
      const pick = (getter: (m: SpotifySongMeta) => number | undefined): number | undefined => {
        const vals = arr.map(getter).filter((v): v is number => Number.isFinite(v));
        if (!vals.length) return undefined;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const calmIntenseScore = pick((m) => m.calmIntenseScore);
      const tempo = pick((m) => m.tempoBpm);
      const key = pick((m) => m.keyPitchClass);
      const keyInt = key == null ? undefined : Math.max(0, Math.min(11, Math.round(key)));
      return {
        calmIntenseScore,
        tempoBpm: tempo,
        keyPitchClass: keyInt,
        keyTonic: keyInt == null ? undefined : TONIC_NAMES[keyInt],
      };
    },
  };
}

