/**
 * Scroll-linked differential motion: the album leaving the viewport lags slightly
 * (slower upward motion), while the one entering from below leads slightly (faster upward).
 * Symmetric behaviour when scrolling up.
 */

const LAG_PX = 52;
const PULL_PX = 40;
const LERP = 0.22;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function attachEraParallax(): () => void {
  if (typeof window === "undefined") return () => {};

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  let raf = 0;
  let lastScrollY = window.scrollY;
  let scrollDir: 1 | -1 = 1;
  const tyByEl = new WeakMap<HTMLElement, number>();

  function targetOffset(
    r: DOMRect,
    vh: number,
    dir: 1 | -1
  ): number {
    let ty = 0;

    if (dir >= 0) {
      /* Scrolling down: previous block exits top → lag (+ty); next enters from bottom → pull (-ty). */
      if (r.top < 0 && r.bottom > 0) {
        const u = smoothstep01(r.bottom / (vh * 0.4));
        ty += LAG_PX * u;
      }
      if (r.top > 0 && r.top < vh * 0.88) {
        const band = vh * 0.55;
        const u = smoothstep01(1 - r.top / band);
        ty -= PULL_PX * u * u * clamp(1 - r.top / (vh * 0.92), 0, 1);
      }
    } else {
      /* Scrolling up: mirror — exiting bottom lags; entering from top pulls. */
      if (r.bottom > vh && r.top < vh * 0.92) {
        const u = smoothstep01((r.bottom - vh) / (vh * 0.38));
        ty -= LAG_PX * u;
      }
      if (r.top < 0 && r.bottom > 0 && r.bottom < vh * 0.72) {
        const u = smoothstep01(r.bottom / (vh * 0.48));
        ty += PULL_PX * (1 - u) * (1 - u);
      }
    }

    return clamp(ty, -PULL_PX * 1.15, LAG_PX * 1.15);
  }

  function tick(): void {
    raf = 0;
    const vh = window.innerHeight;
    const sy = window.scrollY;
    const dy = sy - lastScrollY;
    if (Math.abs(dy) > 0.2) scrollDir = dy > 0 ? 1 : -1;
    lastScrollY = sy;

    document.querySelectorAll<HTMLElement>(".era").forEach((sec) => {
      const inner = sec.querySelector<HTMLElement>(".era-parallax");
      if (!inner) return;

      const r = sec.getBoundingClientRect();
      const target = targetOffset(r, vh, scrollDir);
      const prev = tyByEl.get(inner) ?? 0;
      const next = prev + (target - prev) * LERP;
      tyByEl.set(inner, next);
      inner.style.transform = `translate3d(0, ${next.toFixed(2)}px, 0)`;
    });
  }

  const schedule = (): void => {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  schedule();

  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (raf) cancelAnimationFrame(raf);
  };
}
