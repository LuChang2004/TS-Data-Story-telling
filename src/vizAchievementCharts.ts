function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type AchievementPaintPoint = {
  shortLabel: string;
  sales: number;
  wins: number;
  noms: number;
};

function shortAlbumLabel(name: string, maxLen = 13): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * Albums from index 0 through the current viewport era (inclusive).
 * When the user scrolls back up, `throughEraInclusive` drops — later albums drop off the charts.
 */
export function buildAchievementPaintPoints(
  albums: { albumNumber: number; albumName: string }[],
  byNum: Map<number, { sales: number; grammyWins: number; grammyNominations: number }>,
  throughEraInclusive: number
): AchievementPaintPoint[] {
  const out: AchievementPaintPoint[] = [];
  const hi = Math.min(throughEraInclusive, albums.length - 1);
  for (let i = 0; i <= hi; i++) {
    const a = albums[i];
    const row = byNum.get(a.albumNumber);
    out.push({
      shortLabel: shortAlbumLabel(a.albumName),
      sales: row?.sales ?? 0,
      wins: row?.grammyWins ?? 0,
      noms: row?.grammyNominations ?? 0,
    });
  }
  return out;
}

const VB_W = 360;
/** Taller viewBox so rotated album names fit inside the SVG (no clipping). */
const VB_H = 192;
const PAD_L = 4;
const PAD_R = 8;
const PAD_T = 10;
/** Bottom margin: space below x-axis for tilted labels (not tied to viewBox bottom). */
const PAD_B = 30;
const X_LABEL_ROT = -22;

function albumXLabelsHtml(
  points: AchievementPaintPoint[],
  getX: (i: number) => number,
  yPlotBottom: number,
  delayForIndex: (i: number) => string
): string {
  const pivotY = yPlotBottom + 5;
  const textY = pivotY + 2;
  return points
    .map((p, i) => {
      const x = getX(i);
      return `<text class="viz-ach-xlabel" style="--ach-d:${delayForIndex(
        i
      )}" dominant-baseline="hanging" x="${x.toFixed(1)}" y="${textY.toFixed(
        1
      )}" text-anchor="middle" transform="rotate(${X_LABEL_ROT} ${x.toFixed(
        1
      )} ${pivotY.toFixed(1)})">${esc(p.shortLabel)}</text>`;
    })
    .join("");
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function salesLineSvg(points: AchievementPaintPoint[], animate: boolean): string {
  const innerW = VB_W - PAD_L - PAD_R;
  const innerH = VB_H - PAD_T - PAD_B;
  const n = points.length;
  const maxSales = Math.max(1, ...points.map((p) => p.sales));
  const maxM = maxSales / 1_000_000;
  const y0 = PAD_T + innerH;

  const yTick = (v: number) => PAD_T + innerH * (1 - v / maxSales);

  let pathD = "";
  const dots: string[] = [];
  for (let i = 0; i < n; i++) {
    const x =
      n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);
    const y = yTick(points[i].sales);
    pathD += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    dots.push(
      `<circle class="viz-ach-line-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" style="--ach-dot-d:${(0.28 + i * 0.07).toFixed(2)}s" />`
    );
  }

  const yMid = maxSales / 2;
  const fmtM = (v: number) =>
    v >= 10 ? `${Math.round(v)}M` : `${v.toFixed(1)}M`.replace(/\.0M$/, "M");

  const svgCls = animate ? "viz-ach-svg viz-ach-svg--enter" : "viz-ach-svg";
  const pathPre = animate ? ' style="opacity:0"' : "";
  return `<svg class="${svgCls}" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Estimated worldwide sales by album, chronological">
  <g class="viz-ach-grid">
    <line x1="${PAD_L}" y1="${y0.toFixed(1)}" x2="${VB_W - PAD_R}" y2="${y0.toFixed(1)}" />
    <line x1="${PAD_L}" y1="${yTick(yMid).toFixed(1)}" x2="${VB_W - PAD_R}" y2="${yTick(yMid).toFixed(1)}" />
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${VB_W - PAD_R}" y2="${PAD_T}" />
  </g>
  <text class="viz-ach-axis" x="${PAD_L - 4}" y="${PAD_T + 4}" text-anchor="end">${esc(fmtM(maxM))}</text>
  <text class="viz-ach-axis" x="${PAD_L - 4}" y="${(yTick(yMid) + 4).toFixed(1)}" text-anchor="end">${esc(fmtM(maxM / 2))}</text>
  <text class="viz-ach-axis" x="${PAD_L - 4}" y="${(y0 + 4).toFixed(1)}" text-anchor="end">0</text>
  <path class="viz-ach-line-path"${pathPre} d="${pathD}" />
  <g class="viz-ach-dots">${dots.join("")}</g>
  ${albumXLabelsHtml(
    points,
    (i) =>
      n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1),
    y0,
    (i) => `${(0.12 + i * 0.042).toFixed(3)}s`
  )}
</svg>`;
}

function awardsBarsSvg(points: AchievementPaintPoint[], animate: boolean): string {
  const innerW = VB_W - PAD_L - PAD_R;
  const innerH = VB_H - PAD_T - PAD_B;
  const n = points.length;
  const maxY = Math.max(1, ...points.flatMap((p) => [p.wins, p.noms]));
  const slot = innerW / Math.max(1, n);
  /** Pair width: two equal bars side by side (flush, no gap). */
  const pairW = Math.min(30, Math.max(10, slot * 0.62));
  const barW = pairW / 2;
  const y0 = PAD_T + innerH;

  const groups: string[] = [];
  for (let i = 0; i < n; i++) {
    const cx = PAD_L + slot * i + slot / 2;
    const xWins = cx - pairW / 2;
    const xNoms = xWins + barW;
    const { wins, noms } = points[i];
    const hWins = wins > 0 ? Math.max(2, (wins / maxY) * innerH) : 0;
    const hNoms = noms > 0 ? Math.max(2, (noms / maxY) * innerH) : 0;
    const yWinsTop = y0 - hWins;
    const yNomsTop = y0 - hNoms;
    const inner: string[] = [];
    if (wins > 0) {
      inner.push(
        `<rect class="viz-ach-bar-wins" x="${xWins.toFixed(2)}" y="${yWinsTop.toFixed(2)}" width="${barW.toFixed(2)}" height="${hWins.toFixed(2)}" rx="1" />`
      );
    } else {
      inner.push(
        `<rect class="viz-ach-bar-empty" x="${xWins.toFixed(2)}" y="${(y0 - 2).toFixed(2)}" width="${barW.toFixed(2)}" height="2" rx="0.5" />`
      );
    }
    if (noms > 0) {
      inner.push(
        `<rect class="viz-ach-bar-noms" x="${xNoms.toFixed(2)}" y="${yNomsTop.toFixed(2)}" width="${barW.toFixed(2)}" height="${hNoms.toFixed(2)}" rx="1" />`
      );
    } else {
      inner.push(
        `<rect class="viz-ach-bar-empty" x="${xNoms.toFixed(2)}" y="${(y0 - 2).toFixed(2)}" width="${barW.toFixed(2)}" height="2" rx="0.5" />`
      );
    }
    groups.push(
      `<g class="viz-ach-bar-group" style="--viz-ach-d:${(i * 0.055).toFixed(3)}s">${inner.join("")}</g>`
    );
  }

  const xLabels = albumXLabelsHtml(
    points,
    (i) => PAD_L + slot * i + slot / 2,
    y0,
    (i) => `${(0.1 + i * 0.042).toFixed(3)}s`
  );

  const svgCls = animate ? "viz-ach-svg viz-ach-svg--enter" : "viz-ach-svg";
  return `<svg class="${svgCls}" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Grammy wins and nominations by album">
  <g class="viz-ach-grid">
    <line x1="${PAD_L}" y1="${y0}" x2="${VB_W - PAD_R}" y2="${y0}" />
  </g>
  <text class="viz-ach-axis" x="${VB_W - PAD_R}" y="${PAD_T + 5}" text-anchor="end">max ${maxY}</text>
  <g class="viz-ach-legend" transform="translate(${PAD_L - 36}, ${PAD_T - 4})">
    <rect class="viz-ach-bar-wins" x="0" y="0" width="10" height="6" rx="1" />
    <text class="viz-ach-legend-t" x="14" y="5.5">Wins</text>
    <rect class="viz-ach-bar-noms" x="0" y="10" width="10" height="6" rx="1" />
    <text class="viz-ach-legend-t" x="14" y="15.5">Noms</text>
  </g>
  ${groups.join("")}
  ${xLabels}
</svg>`;
}

function runSalesLineDrawAnimation(host: HTMLElement): void {
  const path = host.querySelector<SVGPathElement>(".viz-ach-line-path");
  if (!path) return;
  const len = path.getTotalLength();
  if (!Number.isFinite(len) || len < 0.5) {
    path.style.opacity = "1";
    return;
  }
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  path.style.transition = "none";
  void path.getBoundingClientRect();
  requestAnimationFrame(() => {
    path.style.transition =
      "stroke-dashoffset 0.78s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease";
    path.style.opacity = "1";
    path.style.strokeDashoffset = "0";
  });
}

export function paintAchievementCharts(
  salesHost: HTMLElement,
  awardsHost: HTMLElement,
  points: AchievementPaintPoint[]
): void {
  if (points.length === 0) {
    const msg =
      '<p class="viz-empty">Scroll through the eras — sales and awards fill in as you discover each album.</p>';
    salesHost.innerHTML = msg;
    awardsHost.innerHTML = msg;
    return;
  }
  const motion = !prefersReducedMotion();
  salesHost.innerHTML = salesLineSvg(points, motion);
  awardsHost.innerHTML = awardsBarsSvg(points, motion);
  if (!motion) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => runSalesLineDrawAnimation(salesHost));
  });
}
