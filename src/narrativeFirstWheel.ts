import {
  getEraIndexForViewportRef,
  isEraGridStuckUnderTimeline,
  isStickyDesktopLayout,
} from "./scrollTheme";

function normalizeWheelDeltaY(e: WheelEvent): number {
  let y = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) y *= 16;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) y *= window.innerHeight * 0.9;
  return y;
}

function scrollElementByDelta(el: HTMLElement, dy: number): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  if (maxScroll < 1) return false;
  const eps = 2;

  if (dy > 0) {
    if (scrollTop + clientHeight >= maxScroll - eps) return false;
    el.scrollTop = Math.min(maxScroll, scrollTop + dy);
    return true;
  }
  if (scrollTop <= eps) return false;
  el.scrollTop = Math.max(0, scrollTop + dy);
  return true;
}

/**
 * When cols 1–2 are stuck: wheel (outside col 1) scrolls the narrative column only, then the page.
 * Pointer over column 1 → no capture; `.album-body` scrolls natively without affecting routing.
 */
export function attachNarrativeFirstWheel(): () => void {
  const onWheel = (e: WheelEvent): void => {
    if (!isStickyDesktopLayout()) return;

    const idx = getEraIndexForViewportRef();
    const sec = document.getElementById(`era-section-${idx}`) as HTMLElement | null;
    if (!sec) return;

    const grid = sec.querySelector<HTMLElement>(".era-grid");
    if (!grid || !isEraGridStuckUnderTimeline(grid)) return;

    const t = e.target;
    if (t instanceof Element) {
      if (t.closest(".viz-dock")) return;
      if (t.closest(".timeline")) return;
      if (t.closest("#landing-hero")) return;
      if (t.closest(`#era-section-${idx} .col-album`)) return;
    }

    const dy = normalizeWheelDeltaY(e);
    if (dy === 0) return;

    const narr = sec.querySelector<HTMLElement>(`[data-narrative-for="${idx}"]`);
    if (narr && scrollElementByDelta(narr, dy)) {
      e.preventDefault();
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () =>
    window.removeEventListener("wheel", onWheel, { capture: true });
}
