import { wireInstrumentIconFallbacks } from "./instrumentIcons";
import {
  getVizScrollBlend,
  getEraIndexForViewportRef,
  isViewportEraStuckOnDesktop,
} from "./scrollTheme";
import type { AlbumAchievement } from "./tsAchievementCsv";
import type { AlbumBundle } from "./types";
import {
  buildAchievementPaintPoints,
  paintAchievementCharts,
} from "./vizAchievementCharts";
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

type VizMode = "musical" | "achievement";

/**
 * Fixed third column: Musical (chords + instrumentation morph) or Achievement (sales line + awards bars).
 * Achievement charts include albums from the first era through the current viewport era only
 * (scrolling back removes later albums from the charts).
 */
export function attachVizDock(
  app: HTMLElement,
  albums: AlbumBundle[],
  achievementByNumber: Map<number, AlbumAchievement>
): () => void {
  const dock = document.createElement("aside");
  dock.className = "viz-dock";
  dock.setAttribute("aria-label", "Analysis");
  dock.innerHTML = `
    <div class="viz-dock-panel col">
      <h2 class="col-title viz-dock-heading">Analysis</h2>
      <div class="viz-dock-toolbar" role="tablist" aria-label="Analysis mode">
        <button type="button" class="viz-dock-tab" role="tab" aria-selected="true" aria-controls="viz-panel-musical" id="viz-tab-musical" data-viz-mode="musical">Musical</button>
        <button type="button" class="viz-dock-tab" role="tab" aria-selected="false" aria-controls="viz-panel-achievement" id="viz-tab-achievement" tabindex="-1" data-viz-mode="achievement">Achievement</button>
      </div>
      <div class="viz-body viz-dock-body">
        <div class="viz-mode-panel" data-viz-panel="musical" id="viz-panel-musical" role="tabpanel" aria-labelledby="viz-tab-musical">
          <div class="viz-dock-stack">
            <div class="viz-blend-layer viz-blend-a"></div>
            <div class="viz-blend-layer viz-blend-b"></div>
          </div>
          <div class="viz-inst-section">
            <h3 class="viz-section-title">INSTRUMENTATION</h3>
            <div class="inst-rank-viewport">
              <div class="inst-rank-morph-root"></div>
            </div>
          </div>
        </div>
        <div class="viz-mode-panel viz-mode-panel--hidden" data-viz-panel="achievement" id="viz-panel-achievement" role="tabpanel" aria-labelledby="viz-tab-achievement" hidden>
          <div class="viz-ach-stack">
            <section class="viz-ach-block" aria-label="Sales chart">
              <h3 class="viz-section-title">Estimated worldwide sales</h3>
              <div class="viz-ach-svg-host">
                <div class="viz-ach-svg-slot" data-ach-sales></div>
              </div>
            </section>
            <section class="viz-ach-block" aria-label="Awards chart">
              <h3 class="viz-section-title">Grammy wins &amp; nominations</h3>
              <div class="viz-ach-svg-host">
                <div class="viz-ach-svg-slot" data-ach-awards></div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>`;
  app.appendChild(dock);

  const musicalPanel = dock.querySelector<HTMLElement>("[data-viz-panel='musical']")!;
  const achievementPanel = dock.querySelector<HTMLElement>("[data-viz-panel='achievement']")!;
  const layerA = musicalPanel.querySelector<HTMLElement>(".viz-blend-a")!;
  const layerB = musicalPanel.querySelector<HTMLElement>(".viz-blend-b")!;
  const morphRoot = musicalPanel.querySelector<HTMLElement>(".inst-rank-morph-root")!;
  const salesHost = achievementPanel.querySelector<HTMLElement>("[data-ach-sales]")!;
  const awardsHost = achievementPanel.querySelector<HTMLElement>("[data-ach-awards]")!;
  const tabMusical = dock.querySelector<HTMLButtonElement>("#viz-tab-musical")!;
  const tabAchievement = dock.querySelector<HTMLButtonElement>("#viz-tab-achievement")!;

  const cardByName = new Map<string, HTMLElement>();

  let mode: VizMode = "musical";
  let lastAchPaintKey = "";
  let cachedA = -1;
  let cachedB = -1;
  let instEnterAnimTimer = 0;

  const playInstrumentationEnterAnimation = (): void => {
    morphRoot.classList.remove("is-entering");
    void morphRoot.offsetWidth;
    morphRoot.classList.add("is-entering");
    if (instEnterAnimTimer) {
      window.clearTimeout(instEnterAnimTimer);
    }
    instEnterAnimTimer = window.setTimeout(() => {
      morphRoot.classList.remove("is-entering");
      instEnterAnimTimer = 0;
    }, 620);
  };

  function setMode(next: VizMode): void {
    if (next === mode) return;
    const prev = mode;
    mode = next;
    const isMusical = mode === "musical";
    tabMusical.setAttribute("aria-selected", isMusical ? "true" : "false");
    tabAchievement.setAttribute("aria-selected", isMusical ? "false" : "true");
    tabMusical.tabIndex = isMusical ? 0 : -1;
    tabAchievement.tabIndex = isMusical ? -1 : 0;
    musicalPanel.classList.toggle("viz-mode-panel--hidden", !isMusical);
    achievementPanel.classList.toggle("viz-mode-panel--hidden", isMusical);
    musicalPanel.toggleAttribute("hidden", !isMusical);
    achievementPanel.toggleAttribute("hidden", isMusical);
    if (!isMusical) lastAchPaintKey = "";
    if (prev === "achievement" && isMusical) {
      playInstrumentationEnterAnimation();
    }
  }

  tabMusical.addEventListener("click", () => {
    setMode("musical");
    schedule();
  });
  tabAchievement.addEventListener("click", () => {
    setMode("achievement");
    schedule();
  });

  let raf = 0;
  const tick = (): void => {
    raf = 0;
    const throughEraInclusive = document.body.classList.contains("landing-past")
      ? getEraIndexForViewportRef()
      : -1;

    if (mode === "achievement") {
      const key = String(throughEraInclusive);
      if (key !== lastAchPaintKey) {
        lastAchPaintKey = key;
        const pts = buildAchievementPaintPoints(
          albums,
          achievementByNumber,
          throughEraInclusive
        );
        paintAchievementCharts(salesHost, awardsHost, pts);
      }
      return;
    }

    let blend = getVizScrollBlend(albums.length);
    if (isViewportEraStuckOnDesktop()) {
      const i = getEraIndexForViewportRef();
      blend = { a: i, b: i, t: 0 };
    }
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
        albumB && a !== b
          ? instrumentationTopRankRows(albumB.instrumentWeights)
          : [];

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
      el.style.setProperty("--inst-i", String(Math.max(0, Math.round(col))));
    }
  };

  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  const bodyClassMo = new MutationObserver(() => schedule());
  bodyClassMo.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  tick();

  return () => {
    bodyClassMo.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (instEnterAnimTimer) window.clearTimeout(instEnterAnimTimer);
    if (raf) cancelAnimationFrame(raf);
    dock.remove();
  };
}
