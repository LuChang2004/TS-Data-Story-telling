import Papa from "papaparse";
import { chordCountsFromSongs, instrumentWeightsFromSongs } from "./aggregate";
import { parseInstrumentationString } from "./instrumentNames";
import { createLyricsNarrativeLookup } from "./lyricsNarrative";
import type { SpotifyMetaLookup } from "./spotifyMeta";
import type { AlbumBundle, SongEntry } from "./types";

export { parseInstrumentationString } from "./instrumentNames";

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

export function buildAlbumsFromCsv(
  csvText: string,
  lyricsCsvText: string = "",
  spotifyLookup?: SpotifyMetaLookup
): AlbumBundle[] {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const lyricsLookup = createLyricsNarrativeLookup(lyricsCsvText);
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => slugHeader(h.replace(/^\ufeff/, "")),
  });

  if (parsed.errors.length) {
    console.warn("CSV parse warnings:", parsed.errors);
  }

  const byNumber = new Map<
    number,
    {
      albumName: string;
      releaseDate: string;
      eraLabel: string;
      albumInstr: string;
      songs: SongEntry[];
    }
  >();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const numStr = cell(row, "album_number", "albumnumber");
    const num = parseInt(numStr, 10);
    if (!Number.isFinite(num)) continue;

    const albumName = cell(row, "album_name", "albumname");
    const releaseDate = cell(row, "release_date", "releasedate");
    const eraLabel = cell(row, "taylors_musical_era", "taylor_s_musical_era");
    const albumInstr = cell(row, "album_instrumentation_types_proportions");
    const songTitle = cell(row, "songs_included_in_album", "songs_included_in_album");
    const chord = cell(row, "song_chord_progressions", "song_chord_progression");
    const modeKey = cell(row, "song_modes_keys", "song_modes_key");
    const songInstrRaw = cell(row, "song_instrumentation_types_proportions");

    if (!byNumber.has(num)) {
      byNumber.set(num, {
        albumName: albumName || `Album ${num}`,
        releaseDate,
        eraLabel: eraLabel || "Era",
        albumInstr,
        songs: [],
      });
    }

    const bucket = byNumber.get(num)!;
    if (albumName) bucket.albumName = albumName;
    if (releaseDate) bucket.releaseDate = releaseDate;
    if (eraLabel) bucket.eraLabel = eraLabel;
    if (albumInstr) bucket.albumInstr = albumInstr;

    const title = songTitle || `Track ${bucket.songs.length + 1}`;
    const albumForLookup = albumName || bucket.albumName || `Album ${num}`;
    const spotifyMeta = spotifyLookup?.getMeta(albumForLookup, title);

    bucket.songs.push({
      title,
      chordProgression: chord,
      modeKey: modeKey || "—",
      instrumentation: parseInstrumentationString(songInstrRaw),
      lyrics: lyricsLookup.getLyrics(albumForLookup, title),
      selfFictionScore: lyricsLookup.getScore(
        albumForLookup,
        title
      ),
      tempoBpm: spotifyMeta?.tempoBpm,
      keyPitchClass: spotifyMeta?.keyPitchClass,
      keyTonic: spotifyMeta?.keyTonic,
      calmIntenseScore: spotifyMeta?.calmIntenseScore,
    });
  }

  const albums: AlbumBundle[] = [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([albumNumber, b]) => {
      const chordCounts = chordCountsFromSongs(b.songs);
      const instrumentWeights = instrumentWeightsFromSongs(b.songs);
      return {
        albumNumber,
        albumName: b.albumName,
        releaseDate: b.releaseDate,
        eraLabel: b.eraLabel,
        albumInstrumentationSummary: b.albumInstr,
        songs: b.songs,
        chordCounts,
        instrumentWeights,
      };
    });

  return albums;
}
