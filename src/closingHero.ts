import type { LandingCoverLayoutOverride } from "./landingCoverLayout";
import { buildLandingCoversImgTags } from "./landingHero";
import { applyCoverScatterStyles, smoothstep01 } from "./landingScatter";
import type { AlbumBundle } from "./types";

/**
 * After the last album: white field, covers fly in from the edges to match the opening layout.
 */
export function closingHeroHtml(
  albums: AlbumBundle[],
  coverSrc: (albumNumber: number, albumName: string) => string,
  layoutByAlbum: Record<string, LandingCoverLayoutOverride> = {}
): string {
  const imgs = buildLandingCoversImgTags(
    albums,
    coverSrc,
    layoutByAlbum,
    "closing-cover",
    "lazy"
  );

  return `
<section class="closing-hero" id="closing-hero" aria-label="Closing">
  <div class="closing-hero__sticky">
    <div class="closing-hero__covers" aria-hidden="true">${imgs}</div>
    <div class="closing-hero__veil" aria-hidden="true"></div>
    <div class="closing-hero__content">
      <p class="closing-hero__gift">
        <span class="closing-hero__gift-main">A gift to Taylor and those people who love her and her music</span><br />
        <span class="closing-hero__byline">LucasLu</span>
      </p>
    </div>
  </div>
</section>`;
}

export type ClosingHeroController = { destroy: () => void };

export function attachClosingHero(root: HTMLElement): ClosingHeroController {
  const section = root.querySelector<HTMLElement>("#closing-hero");
  const covers = root.querySelectorAll<HTMLImageElement>(".closing-cover");
  const content = root.querySelector<HTMLElement>(".closing-hero__content");
  const veil = root.querySelector<HTMLElement>(".closing-hero__veil");

  if (!section || !covers.length) {
    return { destroy: () => {} };
  }

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;

  function progress(): number {
    const vh = window.innerHeight;
    const scrollRange = Math.max(1, section.offsetHeight - vh);
    const raw = (window.scrollY - section.offsetTop) / scrollRange;
    return Math.min(1, Math.max(0, raw));
  }

  function tick(): void {
    raf = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const raw = progress();
    /* Inverse of landing: start scattered (st≈1), end clustered (st≈0). */
    const st = reduceMotion ? 0 : smoothstep01(1 - raw);
    applyCoverScatterStyles(covers, vw, vh, st);

    /* Match landing hero veil (see attachLandingHero): same opacity vs scatter amount. */
    if (veil) {
      veil.style.opacity = String(0.55 + st * 0.2);
    }

    if (content) {
      const giftIn = reduceMotion ? 1 : smoothstep01(Math.max(0, (raw - 0.35) / 0.45));
      content.style.opacity = String(giftIn);
      content.style.transform = `translate3d(0, ${((1 - giftIn) * 14).toFixed(1)}px, 0)`;
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
    destroy: () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
