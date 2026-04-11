/**
 * Taylor’s journey (column 1): optional `public/data/experience.json`.
 *
 * Format (UTF-8 JSON object, keys = album number as string):
 * {
 *   "1": {
 *     "paragraphs": ["First paragraph.", "Second paragraph."],
 *     "image": {
 *       "src": "/experience/debut-photo.jpg",
 *       "caption": "Optional caption under the image.",
 *       "alt": "Short description for accessibility"
 *     }
 *   },
 *   "2": { "paragraphs": ["..."] }
 * }
 *
 * Put assets under `public/` so URLs start with `/` (e.g. `public/experience/photo.jpg` → `src: "/experience/photo.jpg"`).
 */
import type { ExperienceBlock } from "./types";

export type { ExperienceBlock };

export async function loadExperienceByAlbum(): Promise<
  Record<number, ExperienceBlock>
> {
  try {
    const res = await fetch("/data/experience.json", { cache: "no-store" });
    if (!res.ok) return {};
    const j = (await res.json()) as Record<string, unknown>;
    const out: Record<number, ExperienceBlock> = {};
    for (const [key, val] of Object.entries(j)) {
      const n = parseInt(key, 10);
      if (!Number.isFinite(n) || val === null || typeof val !== "object") continue;
      const o = val as Record<string, unknown>;
      const paragraphs = Array.isArray(o.paragraphs)
        ? o.paragraphs.map(String).filter((p) => p.trim())
        : [];
      let image: ExperienceBlock["image"];
      if (o.image && typeof o.image === "object" && o.image !== null) {
        const im = o.image as Record<string, unknown>;
        const src = String(im.src ?? "").trim();
        if (src) {
          image = {
            src,
            caption: im.caption ? String(im.caption) : undefined,
            alt: im.alt ? String(im.alt) : undefined,
          };
        }
      }
      if (paragraphs.length || image) {
        out[n] = { paragraphs, image };
      }
    }
    return out;
  } catch {
    return {};
  }
}
