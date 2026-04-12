import {
  resolveLandingCoverLayout,
  type LandingCoverLayoutOverride,
} from "./landingCoverLayout";
import type { AlbumBundle } from "./types";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Full-viewport intro: scattered covers + copy; scroll progress drives outward scatter.
 */
export function landingHeroHtml(
  albums: AlbumBundle[],
  coverSrc: (albumNumber: number, albumName: string) => string,
  layoutByAlbum: Record<string, LandingCoverLayoutOverride> = {}
): string {
  const list = albums.slice(0, 12);
  const imgs = list
    .map((a, i) => {
      const src = coverSrc(a.albumNumber, a.albumName);
      const L = resolveLandingCoverLayout(i, a.albumNumber, layoutByAlbum);
      return `<img class="landing-cover" src="${escapeAttr(src)}" alt="" width="240" height="240" decoding="async" loading="eager" data-album="${a.albumNumber}" data-ax="${L.ax.toFixed(4)}" data-ay="${L.ay.toFixed(4)}" data-rad="${L.rad.toFixed(4)}" data-rot="${L.rot.toFixed(1)}" data-sc="${L.sc.toFixed(3)}" data-z="${L.z}" />`;
    })
    .join("");

  return `
<section class="landing-hero" id="landing-hero" aria-label="Introduction">
  <div class="landing-hero__sticky">
    <div class="landing-hero__covers" aria-hidden="true">${imgs}</div>
    <div class="landing-hero__veil" aria-hidden="true"></div>
    <div class="landing-hero__content">
      <h1 class="landing-hero__title">Taylor Swift With Her Music</h1>
      <p class="landing-hero__sub">A data visualization of Taylor Swift’s career through her twelve major studio albums (through 2026).</p>
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

    const spread = st * Math.min(vw, vh) * 0.72;
    /* st²: arc + spin ramp up mid-scroll so motion feels less “linear slide”. */
    const st2 = st * st;

    covers.forEach((img, idx) => {
      const ax = parseFloat(img.dataset.ax ?? "0");
      const ay = parseFloat(img.dataset.ay ?? "0");
      const rad = parseFloat(img.dataset.rad ?? "0.2");
      const rot = parseFloat(img.dataset.rot ?? "0");
      const sc = parseFloat(img.dataset.sc ?? "0.6");
      const z = parseInt(img.dataset.z ?? "3", 10);
      const albumNum = parseInt(img.dataset.album ?? String(idx), 10) || idx + 1;

      const baseX = ax * rad * vw * 0.85;
      const baseY = ay * rad * vh * 0.78;

      const spinSign = albumNum % 2 === 0 ? 1 : -1;
      /* Perpendicular offset → slight arc instead of a straight radial line. */
      const arcLean = spread * 0.11 * st2 * spinSign;
      const px = -ay * arcLean;
      const py = ax * arcLean;

      const extraX = ax * spread + px;
      const extraY = ay * spread + py;
      const tx = baseX + extraX;
      const ty = baseY + extraY;

      /* Continuous rotation build-up while spreading (linear + quadratic in st). */
      const rotDriftLinear = st * spinSign * (16 + (idx % 7) * 5);
      const rotDriftQuad = st2 * spinSign * (22 + (albumNum % 5) * 4);
      const rotTiltFromDir = st * (ax * 7 - ay * 5);
      const rotExtra = rot + rotTiltFromDir + rotDriftLinear + rotDriftQuad;

      const scEff = sc * (1 - st * 0.1);
      img.style.zIndex = String(z);
      img.style.opacity = String(Math.max(0.2, 1 - st * 0.38));
      img.style.transform = `translate3d(calc(-50% + ${tx.toFixed(1)}px), calc(-50% + ${ty.toFixed(1)}px), 0) rotate(${rotExtra.toFixed(2)}deg) scale(${scEff.toFixed(4)})`;
    });

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
      document.body.classList.remove("landing-past");
    },
  };
}
