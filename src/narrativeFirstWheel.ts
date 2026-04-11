import { getEraIndexForViewportRef } from "./scrollTheme";

function normalizeWheelDeltaY(e: WheelEvent): number {
  let y = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) y *= 16;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) y *= window.innerHeight;
  return y;
}

/**
 * While the viewport “belongs” to an album, vertical wheel scroll is applied to that album’s
 * left `.narrative-scroll` until it reaches top/bottom; only then does the page scroll.
 */
export function attachNarrativeFirstWheel(): () => void {
  const onWheel = (e: WheelEvent): void => {
    const idx = getEraIndexForViewportRef();
    const narr = document.querySelector<HTMLElement>(
      `[data-narrative-for="${idx}"]`
    );
    if (!narr) return;

    const dy = normalizeWheelDeltaY(e);
    if (dy === 0) return;

    const { scrollTop, scrollHeight, clientHeight } = narr;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const eps = 2;

    if (maxScroll <= eps) return;

    if (dy > 0) {
      if (scrollTop + clientHeight < scrollHeight - eps) {
        e.preventDefault();
        narr.scrollTop = Math.min(maxScroll, scrollTop + dy);
      }
    } else if (scrollTop > eps) {
      e.preventDefault();
      narr.scrollTop = Math.max(0, scrollTop + dy);
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () =>
    window.removeEventListener("wheel", onWheel, { capture: true });
}
