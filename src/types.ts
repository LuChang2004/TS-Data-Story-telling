export type CountRecord = Record<string, number>;

/** Optional column-1 content from `public/data/experience.json`. */
export interface ExperienceBlock {
  paragraphs?: string[];
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
