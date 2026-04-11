import {
  applyAlbumVisualBlend,
  resolveAlbumTheme,
  type AlbumThemeConfig,
} from "./albumThemes";

/** Viewport position (0 = top, 1 = bottom) used as the “focus” line for theme blending. */
export const SCROLL_THEME_ANCHOR_RATIO = 0.38;

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
    applyAlbumVisualBlend(t, t, 0);
    return;
  }
  if (yRef >= mids[count - 1]) {
    const t = resolveAlbumTheme(lastNum, themes);
    applyAlbumVisualBlend(t, t, 0);
    return;
  }

  for (let i = 0; i < count - 1; i++) {
    if (yRef >= mids[i] && yRef < mids[i + 1]) {
      const span = mids[i + 1] - mids[i];
      const t = span > 0 ? (yRef - mids[i]) / span : 0;
      const ta = resolveAlbumTheme(albums[i].albumNumber, themes);
      const tb = resolveAlbumTheme(albums[i + 1].albumNumber, themes);
      applyAlbumVisualBlend(ta, tb, t);
      return;
    }
  }

  const t = resolveAlbumTheme(lastNum, themes);
  applyAlbumVisualBlend(t, t, 0);
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
