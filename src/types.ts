export type CountRecord = Record<string, number>;

/** One image in Taylor’s journey column; `afterParagraph` = 0 after 1st paragraph, 1 after 2nd, -1 before all (legacy). */
export interface ExperienceImageItem {
  src: string;
  caption?: string;
  alt?: string;
  /** Insert after `paragraphs[afterParagraph]`; `-1` = before first paragraph. */
  afterParagraph?: number;
  /** If true, render this figure and the **next** image in the same paragraph group side-by-side. */
  layoutRowWithNext?: boolean;
}

/** Optional column-1 content from `public/data/experience.json`. */
export interface ExperienceBlock {
  paragraphs?: string[];
  /** Preferred: several figures, optionally keyed to paragraphs via `afterParagraph`. */
  images?: ExperienceImageItem[];
  /** @deprecated Use `images`; if set, renders once before paragraphs. */
  image?: {
    src: string;
    caption?: string;
    alt?: string;
  };
}

export interface SongEntry {
  title: string;
  chordProgression: string;
  modeKey: string;
  /** Instrument `name` strings: cleaned via `instrumentNames.ts` when parsed from CSV. */
  instrumentation: { name: string; percent: number }[];
  /** Full lyrics text (from Genius dataset) when available. */
  lyrics?: string;
  /** -1 = self-focused narrative, +1 = fictional/third-person narrative. */
  selfFictionScore?: number;
  /** Spotify tempo in BPM. */
  tempoBpm?: number;
  /** Pitch class 0..11 (C..B). */
  keyPitchClass?: number;
  /** Tonic label resolved from `keyPitchClass` (C, C#, ... B). */
  keyTonic?: string;
  /** -1 = calm, +1 = intense, mapped from tempo. */
  calmIntenseScore?: number;
}

export interface AlbumBundle {
  albumNumber: number;
  albumName: string;
  releaseDate: string;
  eraLabel: string;
  albumInstrumentationSummary: string;
  songs: SongEntry[];
  chordCounts: CountRecord;
  /** Keys = cleaned instrument names (`instrumentNames.ts`); values = summed weights from tracks. */
  instrumentWeights: CountRecord;
  /** Optional copy + image from `public/data/experience.json`. */
  experience?: ExperienceBlock;
}
