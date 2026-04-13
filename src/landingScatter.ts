/**
 * Shared scroll-driven scatter for landing intro & closing epilogue (inverse scroll).
 * `st` 0 = clustered (initial layout), 1 = fully spread (outward).
 */

export function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function applyCoverScatterStyles(
  covers: Iterable<HTMLImageElement>,
  vw: number,
  vh: number,
  st: number
): void {
  const spread = st * Math.min(vw, vh) * 0.72;
  const st2 = st * st;
  let idx = 0;
  for (const img of covers) {
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
    const arcLean = spread * 0.11 * st2 * spinSign;
    const px = -ay * arcLean;
    const py = ax * arcLean;

    const extraX = ax * spread + px;
    const extraY = ay * spread + py;
    const tx = baseX + extraX;
    const ty = baseY + extraY;

    const rotDriftLinear = st * spinSign * (16 + (idx % 7) * 5);
    const rotDriftQuad = st2 * spinSign * (22 + (albumNum % 5) * 4);
    const rotTiltFromDir = st * (ax * 7 - ay * 5);
    const rotExtra = rot + rotTiltFromDir + rotDriftLinear + rotDriftQuad;

    const scEff = sc * (1 - st * 0.1);
    img.style.zIndex = String(z);
    img.style.opacity = String(Math.max(0.2, 1 - st * 0.38));
    img.style.transform = `translate3d(calc(-50% + ${tx.toFixed(1)}px), calc(-50% + ${ty.toFixed(1)}px), 0) rotate(${rotExtra.toFixed(2)}deg) scale(${scEff.toFixed(4)})`;
    idx += 1;
  }
}
