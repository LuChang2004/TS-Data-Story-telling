import {
  resolveLandingCoverLayout,
  type LandingCoverLayoutOverride,
} from "./landingCoverLayout";
import { applyCoverScatterStyles, smoothstep01 } from "./landingScatter";
import type { AlbumBundle } from "./types";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Reusable cover `<img>` list (same layout JSON as landing). */
export function buildLandingCoversImgTags(
  albums: AlbumBundle[],
  coverSrc: (albumNumber: number, albumName: string) => string,
  layoutByAlbum: Record<string, LandingCoverLayoutOverride>,
  imgClassName: string,
  loading: "eager" | "lazy" = "lazy"
): string {
  const list = albums.slice(0, 12);
  const loadAttr = loading === "eager" ? "eager" : "lazy";
  return list
    .map((a, i) => {
      const src = coverSrc(a.albumNumber, a.albumName);
      const L = resolveLandingCoverLayout(i, a.albumNumber, layoutByAlbum);
      return `<img class="${escapeAttr(imgClassName)}" src="${escapeAttr(src)}" alt="" width="240" height="240" decoding="async" loading="${loadAttr}" data-album="${a.albumNumber}" data-ax="${L.ax.toFixed(4)}" data-ay="${L.ay.toFixed(4)}" data-rad="${L.rad.toFixed(4)}" data-rot="${L.rot.toFixed(1)}" data-sc="${L.sc.toFixed(3)}" data-z="${L.z}" />`;
    })
    .join("");
}

/**
 * Full-viewport intro: scattered covers + copy; scroll progress drives outward scatter.
 */
export function landingHeroHtml(
  albums: AlbumBundle[],
  coverSrc: (albumNumber: number, albumName: string) => string,
  layoutByAlbum: Record<string, LandingCoverLayoutOverride> = {}
): string {
  const imgs = buildLandingCoversImgTags(
    albums,
    coverSrc,
    layoutByAlbum,
    "landing-cover",
    "eager"
  );

  return `
<section class="landing-hero" id="landing-hero" aria-label="Introduction">
  <div class="landing-hero__sticky">
    <div class="landing-hero__covers" aria-hidden="true">${imgs}</div>
    <div class="landing-hero__veil" aria-hidden="true"></div>
    <div class="landing-hero__content">
      <h1 class="landing-hero__title">Taylor Swift With Her Music</h1>
      <p class="landing-hero__sub">A data visualization of Taylor Swift’s career through her twelve major studio albums (through 2026).</p>
      <div class="landing-hero__credit-row">
        <p class="landing-hero__credit">By LucasLu</p>
      </div>
    </div>
    <p class="landing-hero__hint">Scroll to explore</p>
  </div>
</section>`;
}

export type LandingHeroController = {
  /** 0 = rest, 1 = end of hero scroll range */
  getProgress: () => number;
  /** True once the hero block has scrolled past the viewport */
  isPastHero: () => boolean;
  destroy: () => void;
};

export function attachLandingHero(
  root: HTMLElement,
  onPastHeroChange?: (past: boolean) => void
): LandingHeroController {
  const hero = root.querySelector<HTMLElement>("#landing-hero");
  const sticky = root.querySelector<HTMLElement>(".landing-hero__sticky");
  const covers = root.querySelectorAll<HTMLImageElement>(".landing-cover");
  const content = root.querySelector<HTMLElement>(".landing-hero__content");
  const hint = root.querySelector<HTMLElement>(".landing-hero__hint");
  const veil = root.querySelector<HTMLElement>(".landing-hero__veil");

  if (!hero || !sticky || !covers.length) {
    return {
      getProgress: () => 1,
      isPastHero: () => true,
      destroy: () => {},
    };
  }

  const heroEl = hero;

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;
  let lastPast = false;

  function progress(): number {
    const vh = window.innerHeight;
    const scrollRange = Math.max(1, heroEl.offsetHeight - vh);
    const raw = (window.scrollY - heroEl.offsetTop) / scrollRange;
    return Math.min(1, Math.max(0, raw));
  }

  function pastHero(): boolean {
    const rect = heroEl.getBoundingClientRect();
    /* Subpixel / fractional layout: treat as past when hero has cleared the viewport */
    return rect.bottom < 1;
  }

  function tick(): void {
    raf = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const t = reduceMotion ? (pastHero() ? 1 : 0) : progress();
    const st = smoothstep01(t);

    if (content) {
      content.style.opacity = String(Math.max(0, 1 - st * 1.05));
      content.style.transform = `translate3d(0, ${(-st * 18).toFixed(1)}px, 0) scale(${1 - st * 0.04})`;
    }
    if (hint) {
      hint.style.opacity = String(Math.max(0, 1 - st * 1.2));
    }
    if (veil) {
      veil.style.opacity = String(0.55 + st * 0.2);
    }

    applyCoverScatterStyles(covers, vw, vh, st);

    const nowPast = pastHero();
    if (nowPast !== lastPast) {
      lastPast = nowPast;
      document.body.classList.toggle("landing-past", nowPast);
      onPastHeroChange?.(nowPast);
    }
  }

  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  schedule();

  return {
    getProgress: progress,
    isPastHero: pastHero,
    destroy: () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      document.body.classList.remove("landing-past", "closing-epilogue");
    },
  };
}
