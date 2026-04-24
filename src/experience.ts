/**
 * Taylor’s journey (column 1): optional `public/data/experience.json`.
 *
 * Format (UTF-8 JSON object, keys = album number as string):
 * {
 *   "1": {
 *     "paragraphs": ["First paragraph.", "Second paragraph."],
 *     "images": [
 *       { "src": "/journey/1/01.jpg", "caption": "…", "alt": "…", "afterParagraph": 0 }
 *     ]
 * `afterParagraph` = index of the paragraph after which the image block is shown (`0` = after `paragraphs[0]`). Any number of `paragraphs` is allowed; after editing copy, run `npm run journey:sync` to re-score filenames against all paragraphs (sync copies **every** file in each `assets-src/pics-for-journey/NN` folder). Album **7 (Lover)** keeps the first four `images` entries’ captions, alts, and paragraph slots; extra files in `07/` are appended after those within each paragraph.
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
      const images: ExperienceBlock["images"] = [];
      if (Array.isArray(o.images)) {
        for (const raw of o.images) {
          if (!raw || typeof raw !== "object") continue;
          const im = raw as Record<string, unknown>;
          const src = String(im.src ?? "").trim();
          if (!src) continue;
          const ap = im.afterParagraph;
          images.push({
            src,
            caption: im.caption ? String(im.caption) : undefined,
            alt: im.alt ? String(im.alt) : undefined,
            afterParagraph:
              typeof ap === "number" && Number.isFinite(ap) ? ap : undefined,
            layoutRowWithNext: im.layoutRowWithNext === true ? true : undefined,
          });
        }
      }

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

      if (paragraphs.length || images.length || image) {
        out[n] = { paragraphs, images: images.length ? images : undefined, image };
      }
    }
    return out;
  } catch {
    return {};
  }
}
