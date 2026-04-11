import { numberedInstrumentIconUrl } from "./instrumentIconMap";
import { cleanInstrumentName, instrumentIconUrl } from "./instrumentNames";

export const INSTRUMENT_ICON_FALLBACK = "🎵";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * Custom set: `public/instruments-icons/Ins-01.png` … `Ins-14.png` (see `instrumentIconMap.ts`).
 * Fallback: `public/instrument-icons/{name}.png`. On load error → emoji in `wireInstrumentIconFallbacks`.
 */
export function instrumentIconImgHtml(name: string): string {
  const clean = cleanInstrumentName(name);
  const url = numberedInstrumentIconUrl(clean) ?? instrumentIconUrl(name);
  return `<img class="inst-icon-img" src="${escapeAttr(url)}" alt="" decoding="async" loading="lazy" data-fallback="${INSTRUMENT_ICON_FALLBACK}" />`;
}

export function wireInstrumentIconFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("img.inst-icon-img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const span = document.createElement("span");
        span.className = "inst-icon-fallback";
        span.textContent = img.dataset.fallback || INSTRUMENT_ICON_FALLBACK;
        span.setAttribute("aria-hidden", "true");
        img.replaceWith(span);
      },
      { once: true }
    );
  });
}
