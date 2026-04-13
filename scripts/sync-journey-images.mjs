/**
 * Copies **all** images from `Pics for journey/01` … `12` into `public/journey/{n}/`,
 * scores filenames against every paragraph, assigns `afterParagraph` (with rebalance).
 *
 * **Lover (album 7):** keeps the first 4 entries from `experience.json` (caption, alt,
 * `afterParagraph`, and matching source files); additional files in `07/` are appended
 * **after** those within each paragraph group.
 *
 * Run: `npm run journey:sync`
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PICS_ROOT = path.join(ROOT, "Pics for journey");
const EXP_PATH = path.join(ROOT, "public", "data", "experience.json");
const OUT_ROOT = path.join(ROOT, "public", "journey");

const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
const LOVER_ALBUM = 7;
const LOVER_LOCK_COUNT = 4;

function extractQuoted(text) {
  const out = [];
  if (!text) return out;
  const re = /"([^"]{2,120})"/g;
  let m;
  while ((m = re.exec(text))) {
    out.push(
      m[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    );
  }
  return out;
}

function scoreNameAgainstParagraph(nameStem, paragraph) {
  if (!paragraph) return 0;
  const n = nameStem.toLowerCase();
  const h = paragraph.toLowerCase();
  let s = 0;
  for (const w of n.match(/[a-z]{4,}/g) || []) {
    if (h.includes(w)) s += w.length >= 7 ? 2 : 1;
  }
  for (const q of extractQuoted(paragraph)) {
    if (q.length < 4) continue;
    const compact = q.replace(/\s+/g, "");
    const nCompact = n.replace(/[^a-z0-9]+/g, "");
    if (compact.length >= 5 && nCompact.includes(compact)) s += 10;
    else if (n.includes(q)) s += 8;
    else {
      for (const part of q.split(/\s+/)) {
        if (part.length >= 5 && n.includes(part)) s += 4;
      }
    }
  }
  return s;
}

function scoreFile(basename, paragraphs) {
  const stem = basename.replace(IMG_EXT, "");
  const scores = paragraphs.map((p) => scoreNameAgainstParagraph(stem, p));
  const total = scores.reduce((a, b) => a + b, 0);
  return { basename, stem, scores, total };
}

function argmaxScores(scores) {
  let bi = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bi]) bi = i;
  }
  return bi;
}

function captionFromStem(stem) {
  let s = stem.replace(/\s+/g, " ").trim();
  if (s.length > 110) s = s.slice(0, 107) + "…";
  return s;
}

function assignAllImages(scored, numParas) {
  const assigned = scored.map((r) => ({
    ...r,
    afterParagraph: argmaxScores(r.scores),
  }));

  function counts() {
    const c = new Array(numParas).fill(0);
    for (const a of assigned) {
      if (a.afterParagraph >= 0 && a.afterParagraph < numParas) {
        c[a.afterParagraph]++;
      }
    }
    return c;
  }

  let c = counts();
  for (let iter = 0; iter < 64; iter++) {
    const emptyIdx = c.findIndex((n) => n === 0);
    if (emptyIdx === -1) break;
    const donorIdx = c.findIndex((n) => n >= 2);
    if (donorIdx === -1) break;
    const donors = assigned.filter((a) => a.afterParagraph === donorIdx);
    let bestMove = null;
    for (const a of donors) {
      const margin = a.scores[emptyIdx] - a.scores[donorIdx];
      if (!bestMove || margin > bestMove.margin) bestMove = { a, margin };
    }
    if (bestMove && bestMove.margin >= -4) {
      bestMove.a.afterParagraph = emptyIdx;
      c = counts();
    } else break;
  }

  return assigned;
}

function pickSourceForLockedCaption(files, used, caption, hay) {
  const candidates = files.filter((f) => !used.has(f));
  if (!candidates.length) return null;
  let best = null;
  let bestS = -1;
  for (const f of candidates) {
    const stem = f.replace(IMG_EXT, "");
    const cap = caption.trim();
    const s =
      scoreNameAgainstParagraph(stem, cap) * 18 +
      scoreNameAgainstParagraph(stem, hay) * 1;
    if (s > bestS) {
      bestS = s;
      best = f;
    }
  }
  if (best) return best;
  return [...candidates].sort()[0] ?? null;
}

function buildLoverOrderedRows(files, paragraphs, prevImages) {
  const hay = paragraphs.join(" ");
  const used = new Set();
  const lockedRows = [];
  const lockSlice = prevImages.slice(0, LOVER_LOCK_COUNT);

  for (const im of lockSlice) {
    const cap = String(im.caption ?? "");
    const ap =
      typeof im.afterParagraph === "number" && Number.isFinite(im.afterParagraph)
        ? im.afterParagraph
        : 0;
    const srcFile = pickSourceForLockedCaption(files, used, cap, hay);
    if (!srcFile) break;
    used.add(srcFile);
    lockedRows.push({
      basename: srcFile,
      stem: srcFile.replace(IMG_EXT, ""),
      afterParagraph: ap,
      caption: cap,
      alt:
        String(im.alt ?? "").trim() ||
        `Journey image: ${cap.slice(0, 100)}`,
      locked: true,
    });
  }

  const remainingFiles = files.filter((f) => !used.has(f)).sort();
  let newRows = remainingFiles.map((f) => scoreFile(f, paragraphs));
  newRows = assignAllImages(newRows, paragraphs.length);
  newRows.sort(
    (a, b) =>
      a.afterParagraph - b.afterParagraph ||
      a.basename.localeCompare(b.basename)
  );

  const numParas = paragraphs.length;
  const ordered = [];
  for (let p = 0; p < numParas; p++) {
    for (const r of lockedRows) {
      if (r.afterParagraph === p) ordered.push(r);
    }
    for (const r of newRows) {
      if (r.afterParagraph === p) ordered.push(r);
    }
  }
  for (const r of newRows) {
    if (r.afterParagraph >= numParas) ordered.push(r);
  }

  return ordered;
}

function copyRowsToJourney(key, srcDir, outDir, orderedRows) {
  fs.mkdirSync(outDir, { recursive: true });
  const images = [];
  let idx = 0;
  for (const row of orderedRows) {
    idx += 1;
    const ext = path.extname(row.basename).toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    const destName = `${String(idx).padStart(2, "0")}${safeExt}`;
    const destPath = path.join(outDir, destName);
    fs.copyFileSync(path.join(srcDir, row.basename), destPath);

    if (row.locked) {
      images.push({
        src: `/journey/${key}/${destName}`,
        caption: row.caption,
        alt: row.alt,
        afterParagraph: row.afterParagraph,
      });
    } else {
      const cap = captionFromStem(row.stem);
      images.push({
        src: `/journey/${key}/${destName}`,
        caption: cap,
        alt: `Journey image: ${cap.slice(0, 100)}`,
        afterParagraph: row.afterParagraph,
      });
    }
  }
  return images;
}

function main() {
  const raw = fs.readFileSync(EXP_PATH, "utf8");
  const data = JSON.parse(raw);

  for (let albumNum = 1; albumNum <= 12; albumNum++) {
    const key = String(albumNum);
    const block = data[key];
    if (!block || !Array.isArray(block.paragraphs) || block.paragraphs.length < 1) {
      console.warn(`Skip album ${key}: missing paragraphs`);
      continue;
    }

    const paragraphs = block.paragraphs.map(String);
    const srcDir = path.join(PICS_ROOT, String(albumNum).padStart(2, "0"));
    if (!fs.existsSync(srcDir)) {
      console.warn(`Skip album ${key}: missing folder ${srcDir}`);
      continue;
    }

    const files = fs
      .readdirSync(srcDir)
      .filter((f) => IMG_EXT.test(f) && !f.startsWith("."))
      .sort();

    if (!files.length) {
      console.warn(`Skip album ${key}: no images in ${srcDir}`);
      continue;
    }

    const outDir = path.join(OUT_ROOT, key);

    if (albumNum === LOVER_ALBUM && Array.isArray(block.images)) {
      const ordered = buildLoverOrderedRows(
        files,
        paragraphs,
        block.images
      );
      block.images = copyRowsToJourney(key, srcDir, outDir, ordered);
    } else {
      const scored = files.map((f) => scoreFile(f, paragraphs));
      const chosen = assignAllImages(scored, paragraphs.length);
      chosen.sort(
        (a, b) =>
          a.afterParagraph - b.afterParagraph ||
          a.basename.localeCompare(b.basename)
      );
      block.images = copyRowsToJourney(key, srcDir, outDir, chosen);
    }

    delete block.image;
  }

  fs.writeFileSync(EXP_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Updated", EXP_PATH);
  console.log("Copied assets under public/journey/");
}

main();
