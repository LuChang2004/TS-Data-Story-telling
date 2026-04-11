/**
 * Numbered PNGs in `public/instruments-icons/` (Ins-01 … Ins-14).
 * Order must match `public/instrument-icons/INSTRUMENT_NAMES_TOP6.txt` / `npm run instruments:top6`.
 * Copy files from your `Instruments Icons` folder into `public/instruments-icons/` using these names.
 */
export const NUMBERED_INSTRUMENT_ICON_ORDER = [
  "AcousticGuitar",
  "Banjo",
  "Bass",
  "DrumMachine",
  "Drums",
  "ElectricGuitar",
  "ElectronicDrums",
  "Fiddle",
  "Guitar",
  "Keyboard",
  "Piano",
  "Strings",
  "Synth",
  "Vocals",
] as const;

const PREFIX = "/instruments-icons/Ins-";

const URL_BY_CLEAN_NAME: ReadonlyMap<string, string> = new Map(
  NUMBERED_INSTRUMENT_ICON_ORDER.map((name, i) => {
    const n = String(i + 1).padStart(2, "0");
    return [name, `${PREFIX}${n}.png`];
  })
);

/** Resolved path for custom numbered icons, or `null` to fall back to `instrument-icons/{name}.png`. */
export function numberedInstrumentIconUrl(cleanName: string): string | null {
  return URL_BY_CLEAN_NAME.get(cleanName) ?? null;
}
