/** Instrument display strings come from CSV via `instrumentNames.ts`. */
import {
  instrumentationRanking,
  topChordProgressions,
} from "./aggregate";
import { instrumentIconImgHtml } from "./instrumentIcons";
import type { AlbumBundle, CountRecord } from "./types";

/** Analysis column: fixed chord rows (extra ranks omitted, shortfall = blank rows). */
export const VIZ_CHORD_SLOT_COUNT = 4;
/** Fixed viz column: only top N instruments in the rank strip. */
export const VIZ_INSTRUMENT_RANK_SHOW = 6;

/** Bar fill uses 2× the data ratio (capped at 100%); label still shows true %. */
export const INSTRUMENT_BAR_DISPLAY_SCALE = 2;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderChordDataRowHtml(
  row: { name: string; value: number },
  max: number
): string {
  const pct = max > 0 ? (row.value / max) * 100 : 0;
  const n = Math.round(row.value);
  return `
        <div class="chord-row">
          <div class="chord-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</div>
          <div>
            <div class="chord-bar-wrap"><div class="chord-bar" style="width:${pct}%"></div></div>
            <div class="chord-val">${n} track${n === 1 ? "" : "s"}</div>
          </div>
        </div>`;
}

function renderChordEmptyRowHtml(): string {
  return `
        <div class="chord-row chord-row--empty" aria-hidden="true">
          <div class="chord-name">&nbsp;</div>
          <div>
            <div class="chord-bar-wrap"><div class="chord-bar" style="width:0%"></div></div>
            <div class="chord-val">&nbsp;</div>
          </div>
        </div>`;
}

/** Exactly `slotCount` rows: real chords first (capped), then placeholders. */
export function renderChordBlockFixedRowsHtml(
  chords: CountRecord,
  slotCount: number = VIZ_CHORD_SLOT_COUNT
): string {
  const top = topChordProgressions(chords, slotCount);
  const max = top[0]?.value ?? 1;
  const parts: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const row = top[i];
    parts.push(
      row ? renderChordDataRowHtml(row, max) : renderChordEmptyRowHtml()
    );
  }
  return parts.join("");
}

/** Height % of the bar track (0–100). Label uses raw `ratio` separately. */
export function instrumentBarDisplayHeightPercent(ratio: number): number {
  return Math.min(100, ratio * 100 * INSTRUMENT_BAR_DISPLAY_SCALE);
}

/** Inner markup for one rank cell (wrapper is added by caller). */
export function instrumentRankCardInnerMarkup(
  name: string,
  ratio: number
): string {
  const hPct = instrumentBarDisplayHeightPercent(ratio);
  const pct = (ratio * 100).toFixed(1);
  return `
          <div class="inst-icon" aria-hidden="true">${instrumentIconImgHtml(name)}</div>
          <div class="inst-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <div class="inst-bar-col">
            <div class="inst-bar" style="height:${hPct}%"></div>
          </div>
          <div class="inst-pct">${pct}%</div>`;
}

export function instrumentationTopRankRows(
  instruments: CountRecord,
  rankCount: number = VIZ_INSTRUMENT_RANK_SHOW
): { name: string; ratio: number }[] {
  return instrumentationRanking(instruments)
    .slice(0, rankCount)
    .map((r) => ({ name: r.name, ratio: r.ratio }));
}

/** Top-N instruments as a fixed grid (no horizontal scroll). */
export function renderInstrumentTopRankGridHtml(
  instruments: CountRecord,
  rankCount: number = VIZ_INSTRUMENT_RANK_SHOW
): string {
  const ranked = instrumentationTopRankRows(instruments, rankCount);
  if (!ranked.length) {
    return `<p class="viz-empty">No instrumentation breakdown parsed for this album.</p>`;
  }
  return ranked
    .map(
      (row) => `
        <div class="inst-card inst-card-rank">
          ${instrumentRankCardInnerMarkup(row.name, row.ratio)}
        </div>`
    )
    .join("");
}

/** Chord block only (instrument rank is handled separately in viz dock). */
export function renderAlbumVizChordsHtml(album: AlbumBundle): string {
  return `
                <div class="viz-chord-block">
                  <h3 class="viz-section-title">CHORD PROGRESSION</h3>
                  <div class="chord-list chord-list--fixed">${renderChordBlockFixedRowsHtml(album.chordCounts)}</div>
                </div>`;
}
