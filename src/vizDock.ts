import { wireInstrumentIconFallbacks } from "./instrumentIcons";
import { getVizScrollBlend } from "./scrollTheme";
import type { AlbumBundle } from "./types";
import {
  instrumentBarDisplayHeightPercent,
  instrumentRankCardInnerMarkup,
  instrumentationTopRankRows,
  renderAlbumVizChordsHtml,
} from "./vizRender";

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

type RankSlot = { idx: number; ratio: number };

function buildRankMap(
  rows: { name: string; ratio: number }[]
): Map<string, RankSlot> {
  const m = new Map<string, RankSlot>();
  rows.forEach((r, i) => m.set(r.name, { idx: i, ratio: r.ratio }));
  return m;
}

function applyMorphCard(
  el: HTMLElement,
  col: number,
  opacity: number,
  ratio: number
): void {
  el.style.left = `${(col / 6) * 100}%`;
  el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
  el.style.zIndex = String(10 + Math.round(col * 6));
  const hPct = instrumentBarDisplayHeightPercent(ratio);
  const pct = (ratio * 100).toFixed(1);
  const bar = el.querySelector<HTMLElement>(".inst-bar");
  const pctEl = el.querySelector<HTMLElement>(".inst-pct");
  if (bar) bar.style.height = `${hPct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

/**
 * Fixed third column: chord stats crossfade; instrumentation top-6 morphs per instrument
 * (each row slides from its rank on album A to its rank on album B while bar height blends).
 */
export function attachVizDock(
  app: HTMLElement,
  albums: AlbumBundle[]
): () => void {
  const dock = document.createElement("aside");
  dock.className = "viz-dock";
  dock.setAttribute("aria-label", "Analysis");
  dock.innerHTML = `
    <div class="viz-dock-panel col">
      <h2 class="col-title viz-dock-heading">Analysis</h2>
      <div class="viz-body viz-dock-body">
        <div class="viz-dock-stack">
          <div class="viz-blend-layer viz-blend-a"></div>
          <div class="viz-blend-layer viz-blend-b"></div>
        </div>
        <div class="viz-inst-section">
          <h3 class="viz-section-title">Instrumentation (rank + share of summed track %)</h3>
          <div class="inst-rank-viewport">
            <div class="inst-rank-morph-root"></div>
          </div>
        </div>
      </div>
    </div>`;
  app.appendChild(dock);

  const layerA = dock.querySelector<HTMLElement>(".viz-blend-a")!;
  const layerB = dock.querySelector<HTMLElement>(".viz-blend-b")!;
  const morphRoot = dock.querySelector<HTMLElement>(".inst-rank-morph-root")!;
  const cardByName = new Map<string, HTMLElement>();

  let cachedA = -1;
  let cachedB = -1;

  let raf = 0;
  const tick = (): void => {
    raf = 0;
    const blend = getVizScrollBlend(albums.length);
    const { a, b, t } = blend;

    if (a !== cachedA || b !== cachedB) {
      cachedA = a;
      cachedB = b;
      const albumA = albums[a];
      const albumB = albums[b];
      if (albumA) {
        layerA.innerHTML = renderAlbumVizChordsHtml(albumA);
      } else {
        layerA.innerHTML = "";
      }
      if (albumB && a !== b) {
        layerB.innerHTML = renderAlbumVizChordsHtml(albumB);
      } else {
        layerB.innerHTML = "";
      }

      const rowsA = albumA
        ? instrumentationTopRankRows(albumA.instrumentWeights)
        : [];
      const rowsB =
        albumB && a !== b ? instrumentationTopRankRows(albumB.instrumentWeights) : [];

      morphRoot.querySelectorAll(".viz-empty").forEach((n) => n.remove());

      if (!rowsA.length) {
        morphRoot
          .querySelectorAll(".inst-card-rank-morph")
          .forEach((n) => n.remove());
        cardByName.clear();
        morphRoot.innerHTML = `<p class="viz-empty">No instrumentation breakdown parsed for this album.</p>`;
      } else {
        const mapA = buildRankMap(rowsA);
        const mapB = a !== b && rowsB.length ? buildRankMap(rowsB) : null;
        const names = new Set<string>([
          ...mapA.keys(),
          ...(mapB ? mapB.keys() : []),
        ]);

        let added = false;
        for (const [name, el] of [...cardByName]) {
          if (!names.has(name)) {
            el.remove();
            cardByName.delete(name);
          }
        }
        for (const name of names) {
          if (!cardByName.has(name)) {
            const el = document.createElement("div");
            el.className = "inst-card inst-card-rank inst-card-rank-morph";
            el.dataset.instrument = name;
            el.innerHTML = instrumentRankCardInnerMarkup(name, 0.08);
            morphRoot.appendChild(el);
            cardByName.set(name, el);
            added = true;
          }
        }
        if (added) wireInstrumentIconFallbacks(dock);
      }
    }

    const st = smoothstep01(t);

    if (a === b) {
      layerA.style.opacity = "1";
      layerB.style.opacity = "0";
    } else {
      layerA.style.opacity = String(1 - st);
      layerB.style.opacity = String(st);
    }

    const albumA = albums[a];
    const albumB = albums[b];
    if (!albumA) return;

    const rowsA = instrumentationTopRankRows(albumA.instrumentWeights);
    if (!rowsA.length) return;

    const mapA = buildRankMap(rowsA);
    const mapB =
      a !== b && albumB
        ? buildRankMap(instrumentationTopRankRows(albumB.instrumentWeights))
        : null;

    for (const [name, el] of cardByName) {
      const pa = mapA.get(name);
      const pb = mapB?.get(name);

      let col: number;
      let opacity: number;
      let ratio: number;

      if (!mapB || a === b) {
        if (!pa) continue;
        col = pa.idx;
        opacity = 1;
        ratio = pa.ratio;
      } else if (pa && pb) {
        col = (1 - st) * pa.idx + st * pb.idx;
        opacity = 1;
        ratio = (1 - st) * pa.ratio + st * pb.ratio;
      } else if (pa && !pb) {
        col = pa.idx;
        opacity = 1 - st;
        ratio = pa.ratio;
      } else if (!pa && pb) {
        col = pb.idx;
        opacity = st;
        ratio = pb.ratio;
      } else {
        continue;
      }

      applyMorphCard(el, col, opacity, ratio);
    }
  };

  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  tick();

  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (raf) cancelAnimationFrame(raf);
    dock.remove();
  };
}
