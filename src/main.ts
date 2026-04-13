import "./styles.css";
import { createAlbumAudioController } from "./albumAudio";
import { loadAlbumThemes, type AlbumThemeConfig } from "./albumThemes";
import { attachEraParallax } from "./eraParallax";
import { attachNarrativeFirstWheel } from "./narrativeFirstWheel";
import { attachClosingHero, closingHeroHtml } from "./closingHero";
import { attachLandingHero, landingHeroHtml } from "./landingHero";
import type { LandingCoverLayoutOverride } from "./landingCoverLayout";
import { loadLandingCoverLayout } from "./landingCoverLayout";
import {
  attachScrollThemeListeners,
  attachTimelineLayoutSync,
  getEraIndexForViewportRef,
  syncTimelineHeightCssVar,
  updatePageGradientForScroll,
} from "./scrollTheme";
import { loadExperienceByAlbum } from "./experience";
import {
  instrumentIconImgHtml,
  wireInstrumentIconFallbacks,
} from "./instrumentIcons";
import { chordProgressionSegments } from "./aggregate";
import { buildAlbumsFromCsv } from "./tsDataCsv";
import { parseAchievementCsv } from "./tsAchievementCsv";
import type { AlbumBundle, ExperienceImageItem, SongEntry } from "./types";
import { attachVizDock } from "./vizDock";
import tsDataCsv from "../TS Data.csv?raw";
import tsData02Csv from "../TS Data 02.csv?raw";
/** Local files in `public/Album Covers/` named `1.JPG` … `12.JPG` (Album Number from CSV). */
const LOCAL_COVER_MAX = 12;
/** Matches `public/TS Music/{n}.mp3` (same numbering as album cover JPGs). */
const ALBUM_AUDIO_MAX = 12;

function albumCoverSrc(albumNumber: number, albumName: string): string {
  if (albumNumber >= 1 && albumNumber <= LOCAL_COVER_MAX) {
    return `/Album Covers/${albumNumber}.JPG`;
  }
  const coverSeed = encodeURIComponent(albumName.slice(0, 24));
  return `https://picsum.photos/seed/${coverSeed}/400/400`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Consecutive albums sharing the same `eraLabel` become one nav group with a single era title. */
function groupAlbumsByEraForTimeline(albums: AlbumBundle[]): {
  era: string;
  albums: { i: number; label: string; year: string }[];
}[] {
  const groups: {
    era: string;
    albums: { i: number; label: string; year: string }[];
  }[] = [];
  for (let i = 0; i < albums.length; i++) {
    const a = albums[i];
    const era = (a.eraLabel || "Era").trim() || "Era";
    const slot = {
      i,
      label: a.albumName,
      year: (a.releaseDate || "").trim(),
    };
    const last = groups[groups.length - 1];
    if (last && last.era === era) last.albums.push(slot);
    else groups.push({ era, albums: [slot] });
  }
  return groups;
}

function narrativeFigureHtml(
  src: string,
  caption?: string,
  alt?: string
): string {
  const cap = caption
    ? `<figcaption>${escapeHtml(caption)}</figcaption>`
    : "";
  return `<figure class="narrative-figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? "")}" loading="lazy" />${cap}</figure>`;
}

function narrativeFigureStackHtml(items: ExperienceImageItem[]): string {
  if (!items.length) return "";
  const chunks: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const im = items[i];
    if (im.layoutRowWithNext && i + 1 < items.length) {
      const next = items[i + 1];
      chunks.push(
        `<div class="narrative-figure-row">${narrativeFigureHtml(im.src, im.caption, im.alt)}${narrativeFigureHtml(next.src, next.caption, next.alt)}</div>`
      );
      i += 1;
    } else {
      chunks.push(narrativeFigureHtml(im.src, im.caption, im.alt));
    }
  }
  return `<div class="narrative-figure-stack">${chunks.join("")}</div>`;
}

function experienceColumnHtml(album: AlbumBundle): string {
  const ex = album.experience;
  const parts: string[] = [];
  const paras = ex?.paragraphs ?? [];
  const imgs = ex?.images?.length ? ex.images : null;

  if (imgs) {
    const before = imgs.filter((i) => i.afterParagraph === -1);
    if (before.length) parts.push(narrativeFigureStackHtml(before));

    for (let pi = 0; pi < paras.length; pi++) {
      parts.push(
        `<p>${escapeHtml(paras[pi]).replace(/\n/g, "<br/>")}</p>`
      );
      const group = imgs.filter((i) => i.afterParagraph === pi);
      if (group.length) parts.push(narrativeFigureStackHtml(group));
    }

    const tail = imgs.filter(
      (i) =>
        i.afterParagraph !== -1 &&
        (i.afterParagraph === undefined ||
          (typeof i.afterParagraph === "number" &&
            i.afterParagraph >= paras.length))
    );
    if (tail.length) parts.push(narrativeFigureStackHtml(tail));
  } else {
    if (ex?.image?.src) {
      parts.push(
        narrativeFigureHtml(ex.image.src, ex.image.caption, ex.image.alt)
      );
    }
    for (const p of paras) {
      parts.push(`<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`);
    }
  }

  if (!paras.length && !imgs?.length && !ex?.image?.src) {
    parts.push(
      `<p class="viz-empty">Add Taylor’s journey copy (and optional images) in <code>public/data/experience.json</code>, using album number <strong>${album.albumNumber}</strong> as the JSON key.</p>`
    );
  }
  parts.push(
    `<p class="experience-foot"><span class="experience-album-context">${escapeHtml(album.albumName)} · ${escapeHtml(album.releaseDate)} · ${escapeHtml(album.eraLabel)}</span><br/><span class="experience-hint">${album.songs.length} tracks — click a track title in the album column for per-track instrumentation.</span></p>`
  );
  return parts.join("");
}

function chordProgressionDdHtml(progression: string): string {
  const segs = chordProgressionSegments(progression);
  if (!segs.length) return "Unknown";
  return segs.map((s) => escapeHtml(s)).join("<br/>");
}

function popoverHtml(album: AlbumBundle, song: SongEntry): string {
  const chord = chordProgressionDdHtml(song.chordProgression);
  const key = escapeHtml(song.modeKey.trim() || "—");
  const inst = [...song.instrumentation].sort((a, b) => b.percent - a.percent);
  const instRows =
    inst.length > 0
      ? inst
          .map((r) => {
            const w = Math.min(100, Math.max(0, r.percent));
            return `<div class="pop-inst-row">
            <span class="pop-inst-icon" aria-hidden="true">${instrumentIconImgHtml(r.name)}</span>
            <div class="pop-inst-meta">
              <div class="pop-inst-name">${escapeHtml(r.name)}</div>
              <div class="pop-inst-bar-wrap"><div class="pop-inst-bar" style="width:${w}%"></div></div>
            </div>
            <span class="pop-inst-pct">${r.percent.toFixed(1)}%</span>
          </div>`;
          })
          .join("")
      : `<p class="viz-empty">No instrumentation tokens parsed for this track.</p>`;

  return `
    <header class="song-popover-head">
      <h3 class="song-popover-title">${escapeHtml(song.title)}</h3>
      <p class="song-popover-sub">${escapeHtml(album.albumName)}</p>
    </header>
    <dl class="song-popover-facts">
      <div><dt>Chord progression</dt><dd>${chord}</dd></div>
      <div><dt>Mode / key</dt><dd>${key}</dd></div>
    </dl>
    <h4 class="song-popover-section">Instrumentation</h4>
    <div class="song-popover-inst">${instRows}</div>
  `;
}

function positionPopover(panel: HTMLElement, anchor: HTMLElement): void {
  panel.style.visibility = "hidden";
  panel.classList.add("is-open");
  const pad = 10;
  const gap = 8;
  const rect = anchor.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  let left = rect.left + rect.width / 2 - pw / 2;
  let top = rect.bottom + gap;
  if (left < pad) left = pad;
  if (left + pw > window.innerWidth - pad) left = window.innerWidth - pw - pad;
  if (top + ph > window.innerHeight - pad) {
    top = rect.top - gap - ph;
  }
  if (top < pad) top = pad;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.visibility = "";
}

function attachSongPopover(app: HTMLElement, albums: AlbumBundle[]): void {
  const root = document.createElement("div");
  root.className = "song-popover-root";
  root.innerHTML = `
    <div class="song-popover-backdrop" aria-hidden="true"></div>
    <div class="song-popover-panel" role="dialog" aria-modal="true" aria-label="Track details" tabindex="-1"></div>
  `;
  document.body.appendChild(root);
  const backdrop = root.querySelector<HTMLDivElement>(".song-popover-backdrop")!;
  const panel = root.querySelector<HTMLDivElement>(".song-popover-panel")!;
  let lastAnchor: HTMLElement | null = null;

  function close(): void {
    root.classList.remove("is-visible");
    panel.innerHTML = "";
    panel.classList.remove("is-open");
    lastAnchor = null;
  }

  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-visible")) {
      e.preventDefault();
      close();
    }
  });

  app.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".track-btn");
    if (!btn) return;
    e.preventDefault();
    const ai = Number(btn.dataset.albumIdx);
    const ti = Number(btn.dataset.trackIdx);
    const album = albums[ai];
    const song = album?.songs[ti];
    if (!album || !song) return;
    lastAnchor = btn;
    panel.innerHTML = popoverHtml(album, song);
    wireInstrumentIconFallbacks(panel);
    root.classList.add("is-visible");
    requestAnimationFrame(() => positionPopover(panel, btn));
  });

  window.addEventListener("resize", () => {
    if (!root.classList.contains("is-visible") || !lastAnchor) return;
    positionPopover(panel, lastAnchor);
  });
}

function buildApp(
  albums: AlbumBundle[],
  themesByAlbum: Record<number, AlbumThemeConfig>,
  landingLayout: Record<string, LandingCoverLayoutOverride> = {}
): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const timelineGroups = groupAlbumsByEraForTimeline(albums);
  const timelineHtml = timelineGroups
    .map(
      (g) => `
        <li class="timeline-era-block" style="flex: ${g.albums.length} 1 0%; min-width: 0" aria-label="${escapeHtml(g.era)}">
          <div class="timeline-era-heading">${escapeHtml(g.era)}</div>
          <ul class="timeline-era-albums" role="list">
            ${g.albums
              .map(
                (t) => `
              <li>
                <button type="button" class="timeline-item" data-era-index="${t.i}" aria-current="false">
                  <span class="timeline-dot" aria-hidden="true"></span>
                  <span class="timeline-label">${escapeHtml(t.label)}</span>
                  ${t.year ? `<span class="timeline-year">${escapeHtml(t.year)}</span>` : ""}
                </button>
              </li>`
              )
              .join("")}
          </ul>
        </li>`
    )
    .join("");

  app.innerHTML = `
    ${landingHeroHtml(albums, albumCoverSrc, landingLayout)}
    <div class="timeline-spacer" aria-hidden="true"></div>
    <header class="timeline">
      <nav aria-label="Album timeline">
        <ul class="timeline-track" role="list">${timelineHtml}</ul>
      </nav>
    </header>
    <main>
      ${albums
        .map((album, eraIndex) => {
          const tracks = album.songs
            .map(
              (tr, ti) =>
                `<li class="track-row"><button type="button" class="track-btn" data-album-idx="${eraIndex}" data-track-idx="${ti}"><span class="track-idx">${ti + 1}.</span><span class="track-title">${escapeHtml(tr.title)}</span></button></li>`
            )
            .join("");
          const coverSrc = albumCoverSrc(album.albumNumber, album.albumName);
          const cover = `<img src="${escapeHtml(coverSrc)}" alt="Cover: ${escapeHtml(album.albumName)}" loading="lazy" />`;
          return `
        <section class="era" data-era-index="${eraIndex}" id="era-section-${eraIndex}">
          <div class="era-grid">
            <div class="era-parallax">
            <div class="col col-album">
              <h2 class="col-title">${escapeHtml(album.albumName)}</h2>
              <div class="album-body">
                <div class="cover-wrap">${cover}</div>
                <ol class="track-list" aria-label="Tracks">${tracks}</ol>
              </div>
            </div>
            <div class="col col-narrative">
              <h2 class="col-title">Taylor’s journey</h2>
              <div class="narrative-scroll" tabindex="0" data-narrative-for="${eraIndex}">
                ${experienceColumnHtml(album)}
              </div>
            </div>
            </div>
          </div>
        </section>`;
        })
        .join("")}
    </main>
    ${closingHeroHtml(albums, albumCoverSrc, landingLayout)}
  `;

  const buttons = [...app.querySelectorAll<HTMLButtonElement>(".timeline-item")];

  function setActiveEra(index: number): void {
    buttons.forEach((b) => {
      const on = Number(b.dataset.eraIndex) === index;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-current", on ? "true" : "false");
    });
    app.querySelectorAll<HTMLElement>(".timeline-era-block").forEach((block) => {
      block.classList.toggle("has-active", !!block.querySelector(".timeline-item.is-active"));
    });
  }

  const albumAudio = createAlbumAudioController({ maxAlbum: ALBUM_AUDIO_MAX });

  function onVisibleEraIndex(idx: number): void {
    if (!Number.isFinite(idx)) return;
    setActiveEra(idx);
    if (!document.body.classList.contains("landing-past")) return;
    const albumNum = albums[idx]?.albumNumber;
    if (albumNum != null) {
      albumAudio.crossfadeTo(albumNum);
    }
  }

  const sections = [...app.querySelectorAll<HTMLElement>(".era")];
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
      if (!visible?.target) return;
      const sec = visible.target as HTMLElement;
      const idx = Number(sec.dataset.eraIndex);
      onVisibleEraIndex(idx);
    },
    { root: null, threshold: [0.15, 0.35, 0.55, 0.75] }
  );
  sections.forEach((s) => io.observe(s));

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.eraIndex);
      document.getElementById(`era-section-${idx}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  attachScrollThemeListeners(albums, themesByAlbum);
  attachTimelineLayoutSync();
  requestAnimationFrame(() => {
    syncTimelineHeightCssVar();
    requestAnimationFrame(() => syncTimelineHeightCssVar());
  });
  attachNarrativeFirstWheel();
  attachEraParallax();
  attachVizDock(app, albums, parseAchievementCsv(tsData02Csv));

  attachLandingHero(app, (past) => {
    if (past) {
      syncTimelineHeightCssVar();
      onVisibleEraIndex(getEraIndexForViewportRef());
      updatePageGradientForScroll(albums, themesByAlbum);
    }
  });

  attachClosingHero(app);

  const hint = document.createElement("div");
  hint.className = "audio-unlock-hint";
  hint.setAttribute("role", "status");
  hint.textContent = "Tap or click anywhere to play sound";
  document.body.appendChild(hint);

  let audioHintDismissed = false;
  const onAudioHintKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") dismissAudioHint();
  };
  const dismissAudioHint = (): void => {
    if (audioHintDismissed) return;
    audioHintDismissed = true;
    document.removeEventListener("keydown", onAudioHintKey);
    hint.remove();
    albumAudio.unlock();
  };
  document.addEventListener("pointerdown", dismissAudioHint, {
    once: true,
    capture: true,
  });
  document.addEventListener("keydown", onAudioHintKey);

  attachSongPopover(app, albums);
  wireInstrumentIconFallbacks(app);
}

async function boot(): Promise<void> {
  const app = document.querySelector("#app");
  if (!app) return;
  try {
    const albums = buildAlbumsFromCsv(tsDataCsv);
    if (!albums.length) {
      app.innerHTML = `<div class="error">No albums parsed from TS Data.csv. Check column headers.</div>`;
      return;
    }
    const [experienceByAlbum, themesByAlbum, landingLayout] = await Promise.all([
      loadExperienceByAlbum(),
      loadAlbumThemes(),
      loadLandingCoverLayout(),
    ]);
    for (const a of albums) {
      const block = experienceByAlbum[a.albumNumber];
      if (block) a.experience = block;
    }
    buildApp(albums, themesByAlbum, landingLayout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    app.innerHTML = `<div class="error">Could not load data: ${escapeHtml(msg)}</div>`;
  }
}

void boot();
