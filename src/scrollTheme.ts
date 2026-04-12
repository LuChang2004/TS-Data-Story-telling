import {
  applyAlbumVisualBlendWithLandingIntro,
  resolveAlbumTheme,
  type AlbumThemeConfig,
} from "./albumThemes";

/** Viewport position (0 = top, 1 = bottom) used as the “focus” line for theme blending. */
export const SCROLL_THEME_ANCHOR_RATIO = 0.38;

/** Same breakpoint as sticky `.era-grid` + fixed Analysis column layout. */
export const STICKY_DESKTOP_MIN_WIDTH_PX = 1025;

/** Pixel tolerance when comparing `.era-grid` top to timeline bottom. */
export const STUCK_TOP_EPS_PX = 4;

/**
 * Wider than {@link STUCK_TOP_EPS_PX}: while the grid sits this close to the pin line,
 * era parallax targets 0 so `transform` does not fight `position: sticky` (avoids subpixel bounce).
 */
export const STICKY_PARALLAX_OFF_PX = 14;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * 0 at top of landing hero → 1 at end of hero scroll range (same as landing intro progress).
 * Linear in scroll so background tracks finger / wheel gradually through the intro.
 */
export function getLandingHeroThemeIntroMix(): number {
  if (typeof document === "undefined") return 1;
  const hero = document.getElementById("landing-hero");
  if (!hero) return 1;
  const scrollRange = Math.max(1, hero.offsetHeight - window.innerHeight);
  const raw = (window.scrollY - hero.offsetTop) / scrollRange;
  return clamp01(raw);
}

/**
 * Writes measured `.timeline` height to `--timeline-h` so `top: var(--timeline-h)` on
 * Analysis + sticky `.era-grid` matches the real nav bar (avoids min-height vs content mismatch).
 */
export function syncTimelineHeightCssVar(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(".timeline");
  if (!el) return;
  const h = el.offsetHeight;
  if (!Number.isFinite(h) || h < 1) return;
  document.documentElement.style.setProperty("--timeline-h", `${h}px`);
}

export function attachTimelineLayoutSync(): () => void {
  const run = (): void => {
    syncTimelineHeightCssVar();
  };
  run();
  let ro: ResizeObserver | null = null;
  const tl = document.querySelector<HTMLElement>(".timeline");
  if (typeof ResizeObserver !== "undefined" && tl) {
    ro = new ResizeObserver(() => run());
    ro.observe(tl);
  }
  window.addEventListener("resize", run, { passive: true });
  return () => {
    ro?.disconnect();
    window.removeEventListener("resize", run);
  };
}

/** Y coordinate of timeline bottom edge in viewport (for sticky checks). */
export function getTimelineBottomY(): number {
  const el = document.querySelector<HTMLElement>(".timeline");
  if (el) return el.getBoundingClientRect().bottom;
  const raw = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--timeline-h")
  );
  return Number.isFinite(raw) ? raw : 118;
}

export function isStickyDesktopLayout(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= STICKY_DESKTOP_MIN_WIDTH_PX;
}

export function isEraGridStuckUnderTimeline(grid: HTMLElement | null): boolean {
  if (!grid || !isStickyDesktopLayout()) return false;
  const want = getTimelineBottomY();
  const t = grid.getBoundingClientRect().top;
  return Math.abs(t - want) <= STUCK_TOP_EPS_PX;
}

export function isEraGridNearStickyPin(grid: HTMLElement | null): boolean {
  if (!grid || !isStickyDesktopLayout()) return false;
  const want = getTimelineBottomY();
  const t = grid.getBoundingClientRect().top;
  return Math.abs(t - want) <= STICKY_PARALLAX_OFF_PX;
}

/** True when the viewport’s active era has its `.era-grid` pinned under the timeline. */
export function isViewportEraStuckOnDesktop(): boolean {
  const idx = getEraIndexForViewportRef();
  const sec = document.getElementById(`era-section-${idx}`);
  const grid = sec?.querySelector<HTMLElement>(".era-grid") ?? null;
  return isEraGridStuckUnderTimeline(grid);
}

/**
 * Between consecutive section midpoints (same geometry as theme blend), returns album
 * indices `a`→`b` and linear `t` in [0,1]. When `a === b`, you are outside the blend range.
 */
export function getVizScrollBlend(
  sectionCount: number,
  anchorRatio: number = SCROLL_THEME_ANCHOR_RATIO
): { a: number; b: number; t: number } {
  const secs = document.querySelectorAll<HTMLElement>(".era");
  const count = Math.min(secs.length, sectionCount);
  if (count === 0) return { a: 0, b: 0, t: 0 };

  const yRef = window.scrollY + window.innerHeight * anchorRatio;
  const mids: number[] = [];
  for (let i = 0; i < count; i++) {
    const el = secs[i];
    const top = el.getBoundingClientRect().top + window.scrollY;
    mids.push(top + el.offsetHeight / 2);
  }

  if (yRef <= mids[0]) return { a: 0, b: 0, t: 0 };
  if (yRef >= mids[count - 1]) return { a: count - 1, b: count - 1, t: 0 };

  for (let i = 0; i < count - 1; i++) {
    if (yRef >= mids[i] && yRef < mids[i + 1]) {
      const span = mids[i + 1] - mids[i];
      const t = span > 0 ? (yRef - mids[i]) / span : 0;
      return { a: i, b: i + 1, t };
    }
  }

  return { a: count - 1, b: count - 1, t: 0 };
}

/** Which `.era` section contains the viewport anchor (same rule as theme scroll). */
export function getEraIndexForViewportRef(
  anchorRatio: number = SCROLL_THEME_ANCHOR_RATIO
): number {
  const secs = document.querySelectorAll<HTMLElement>(".era");
  if (!secs.length) return 0;
  const yRef = window.scrollY + window.innerHeight * anchorRatio;
  for (let i = 0; i < secs.length; i++) {
    const el = secs[i];
    const top = el.getBoundingClientRect().top + window.scrollY;
    const bot = top + el.offsetHeight;
    if (yRef >= top && yRef < bot) return i;
  }
  const firstTop = secs[0].getBoundingClientRect().top + window.scrollY;
  if (yRef < firstTop) return 0;
  return secs.length - 1;
}

/**
 * Sets page gradient + UI colors by interpolating between adjacent albums.
 * Between section midpoints, `t` is linear in scroll space; colors use smoothstep inside `applyAlbumVisualBlend`.
 */
export function updatePageGradientForScroll(
  albums: { albumNumber: number }[],
  themes: Record<number, AlbumThemeConfig>
): void {
  const introMix =
    typeof document !== "undefined" ? getLandingHeroThemeIntroMix() : 1;

  const secs = document.querySelectorAll<HTMLElement>(".era");
  const count = Math.min(secs.length, albums.length);
  if (count === 0) return;

  const yRef = window.scrollY + window.innerHeight * SCROLL_THEME_ANCHOR_RATIO;
  const mids: number[] = [];
  for (let i = 0; i < count; i++) {
    const el = secs[i];
    const top = el.getBoundingClientRect().top + window.scrollY;
    mids.push(top + el.offsetHeight / 2);
  }

  const firstNum = albums[0].albumNumber;
  const lastNum = albums[count - 1].albumNumber;

  if (yRef <= mids[0]) {
    const t = resolveAlbumTheme(firstNum, themes);
    applyAlbumVisualBlendWithLandingIntro(t, t, 0, introMix);
    return;
  }
  if (yRef >= mids[count - 1]) {
    const t = resolveAlbumTheme(lastNum, themes);
    applyAlbumVisualBlendWithLandingIntro(t, t, 0, introMix);
    return;
  }

  for (let i = 0; i < count - 1; i++) {
    if (yRef >= mids[i] && yRef < mids[i + 1]) {
      const span = mids[i + 1] - mids[i];
      const t = span > 0 ? (yRef - mids[i]) / span : 0;
      const ta = resolveAlbumTheme(albums[i].albumNumber, themes);
      const tb = resolveAlbumTheme(albums[i + 1].albumNumber, themes);
      applyAlbumVisualBlendWithLandingIntro(ta, tb, t, introMix);
      return;
    }
  }

  const t = resolveAlbumTheme(lastNum, themes);
  applyAlbumVisualBlendWithLandingIntro(t, t, 0, introMix);
}

export function attachScrollThemeListeners(
  albums: { albumNumber: number }[],
  themes: Record<number, AlbumThemeConfig>
): () => void {
  let raf = 0;
  const tick = (): void => {
    raf = 0;
    updatePageGradientForScroll(albums, themes);
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
  };
}
