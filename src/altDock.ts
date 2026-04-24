import {
  getVizScrollBlend,
  getEraIndexForViewportRef,
  isViewportEraStuckOnDesktop,
} from "./scrollTheme";
import type { AlbumThemeConfig } from "./albumThemes";
import type { AlbumBundle } from "./types";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hash01(s: string): number {
  // Deterministic pseudo-random in [0,1) from a string.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function clamp11(x: number): number {
  return Math.max(-1, Math.min(1, x));
}

type SongDims = { x: number; y: number; z: number };
type SongPoint = SongDims & { title: string };
type Vec3 = { x: number; y: number; z: number };
type HoveredPoint = SongDims;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function songDims(
  songTitle: string,
  instr: { name: string; percent: number }[],
  selfFictionScore?: number,
  calmIntenseScore?: number
): SongDims {
  // 1) 配器质感：原声(-1) ↔ 合成(+1)
  // 2) 节奏律动：舒缓(-1) ↔ 强劲(+1)
  // 3) 叙事视角：自我(-1) ↔ 虚构(+1) —— 暂时用可复现 hash 虚构
  //
  // NOTE: 数据不足时允许“编造”，但必须可复现（避免每次刷新都变）。
  const acousticKeys = new Set([
    "AcousticGuitar",
    "Banjo",
    "Fiddle",
    "Piano",
    "Strings",
    "Brass",
    "Harp",
    "Violin",
    "Cello",
  ]);
  const synthKeys = new Set(["Synth", "DrumMachine", "ElectronicDrums", "SynthBass", "Sampler"]);
  const strongRhythmKeys = new Set(["Drums", "ElectronicDrums", "DrumMachine", "Bass"]);

  let a = 0;
  let s = 0;
  let r = 0;
  let total = 0;
  for (const it of instr) {
    const name = (it.name || "").trim();
    const pct = Number(it.percent) || 0;
    total += pct;
    if (acousticKeys.has(name)) a += pct;
    if (synthKeys.has(name)) s += pct;
    if (strongRhythmKeys.has(name)) r += pct;
  }
  const denom = total > 0 ? total : 100;
  const texture = clamp11(((s - a) / denom) * 2); // widen a bit
  const rhythm =
    typeof calmIntenseScore === "number" && Number.isFinite(calmIntenseScore)
      ? clamp11(calmIntenseScore)
      : total > 0
        ? clamp11((r / denom) * 2 - 1)
        : clamp11(hash01(songTitle) * 2 - 1);

  // Narrative: prefer merged lyrics score; fallback to title heuristics if missing.
  let narrative: number;
  if (typeof selfFictionScore === "number" && Number.isFinite(selfFictionScore)) {
    narrative = clamp11(selfFictionScore);
  } else {
    const t = songTitle.toLowerCase();
    const selfBoost =
      /\b(i|i'm|im|me|my|mine)\b/.test(t) || /\b(we|us|our|ours)\b/.test(t)
        ? -0.35
        : 0;
    const fictionBoost = /\b(he|she|they|him|her|them)\b/.test(t) ? 0.25 : 0;
    const base = hash01(songTitle) * 2 - 1;
    narrative = clamp11(base + selfBoost + fictionBoost);
  }

  return { x: texture, y: rhythm, z: narrative };
}

function projectPoint(
  p: Vec3,
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
  scale: number,
  depth: number,
  cx: number,
  cy: number
): { x: number; y: number; z: number; k: number } {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const roll = (rollDeg * Math.PI) / 180;
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  // Yaw around Y
  const x1 = p.x * cyaw + p.z * syaw;
  const z1 = -p.x * syaw + p.z * cyaw;
  const y1 = p.y;

  // Pitch around X
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  const x2 = x1;

  // Roll around Z
  const x3 = x2 * cr - y2 * sr;
  const y3 = x2 * sr + y2 * cr;

  // Perspective scale: nearer points should be larger, farther points smaller.
  const k = depth / (depth - z2 * scale);
  return {
    x: cx + x3 * scale * k,
    y: cy - y3 * scale * k,
    z: z2,
    k,
  };
}

/**
 * Alternate fixed panel that replaces column 2 + 3 in "alt mode".
 *
 * Behavior matches `.viz-dock`: fixed under the timeline, does not scroll vertically,
 * but updates its internal content driven by scroll blend / active era.
 */
export function attachAltDock(
  app: HTMLElement,
  albums: AlbumBundle[],
  themesByAlbum?: Record<number, AlbumThemeConfig>
): () => void {
  const dock = document.createElement("aside");
  dock.className = "alt-dock";
  dock.setAttribute("aria-label", "Alt panel");
  dock.innerHTML = `
    <div class="alt-dock-panel col">
      <h2 class="col-title alt-dock-heading">3D Song Map</h2>
      <div class="alt-dock-body">
        <div class="alt-dock-stack" aria-label="3D songs chart">
          <div class="alt-chart-host" data-alt-chart-host></div>
          <div class="alt-tooltip" data-alt-tooltip hidden></div>
        </div>
      </div>
    </div>
  `;
  app.appendChild(dock);

  const host = dock.querySelector<HTMLElement>("[data-alt-chart-host]")!;
  const tooltip = dock.querySelector<HTMLElement>("[data-alt-tooltip]")!;

  // Camera
  let yaw = 38;
  let pitch = 24;
  let roll = 0;
  const autoYawDegPerMs = 0.0042;
  const autoPitchAmp = 9;
  const autoPitchOscPerMs = 0.0012;
  const autoRollDegPerMs = 0.0011;
  let autoBaseYaw = yaw;
  let autoBasePitch = pitch;
  let autoBaseRoll = roll;
  let autoPhaseMs = 0;
  let lastFrameTs = 0;

  let dragging = false;
  let sx = 0;
  let sy = 0;
  let baseYaw = 0;
  let basePitch = 0;
  let baseRoll = 0;
  let hoveredPoint: HoveredPoint | null = null;
  let activePointerId: number | null = null;

  const isAltInteractive = (): boolean =>
    document.body.classList.contains("alt-mode") &&
    document.body.classList.contains("landing-past") &&
    !document.body.classList.contains("closing-epilogue");

  const syncHostInteractivity = (): void => {
    const on = isAltInteractive();
    host.style.pointerEvents = on ? "auto" : "none";
    host.style.cursor = on ? "grab" : "default";
    if (!on) {
      dragging = false;
      if (activePointerId !== null) {
        try {
          if (host.hasPointerCapture(activePointerId)) {
            host.releasePointerCapture(activePointerId);
          }
        } catch {
          // ignore
        }
        activePointerId = null;
      }
    }
  };

  host.addEventListener("pointerdown", (e) => {
    if (!isAltInteractive()) {
      return;
    }
    dragging = true;
    activePointerId = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    baseYaw = yaw;
    basePitch = pitch;
    baseRoll = roll;
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    yaw = baseYaw + dx * 0.22;
    pitch = Math.max(-35, Math.min(70, basePitch + dy * 0.2));
    roll = baseRoll + dx * 0.06;
    schedule();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    // Resume auto-rotation from the exact dragged camera pose.
    autoBaseYaw = yaw;
    autoBasePitch = pitch;
    autoBaseRoll = roll;
    autoPhaseMs = 0;
    try {
      host.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    activePointerId = null;
  };
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);

  const albumAccentByIndex = new Map<number, string>();
  const songPointsByAlbum = new Map<number, SongPoint[]>();

  const ensureAlbumData = (idx: number): SongPoint[] | null => {
    const album = albums[idx];
    if (!album) return null;
    if (songPointsByAlbum.has(idx)) return songPointsByAlbum.get(idx)!;

    const theme = themesByAlbum?.[album.albumNumber];
    const accent = theme?.accent
      ? theme.accent
      : theme?.darkMode
        ? "#e8c547"
        : "#b8860b";
    albumAccentByIndex.set(idx, accent);

    const pts = album.songs.map((s) => {
      const d = songDims(
        s.title,
        s.instrumentation,
        s.selfFictionScore,
        s.calmIntenseScore
      );
      return { ...d, title: s.title };
    });
    songPointsByAlbum.set(idx, pts);
    return pts;
  };

  const renderSvg = (a: number, b: number, t: number): void => {
    const rect = host.getBoundingClientRect();
    const w = Math.max(100, rect.width);
    const h = Math.max(100, rect.height);
    const cx = w * 0.5;
    // Keep chart slightly upper-centered within the visible region.
    const cy = h * 0.46;
    // Slightly shrink the full 3D footprint for a less crowded look.
    const scale = Math.min(w, h) * 0.27;
    const depth = 440;

    const axisLen = 1.18;
    const o = projectPoint({ x: 0, y: 0, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
    const xMin = projectPoint({ x: -axisLen, y: 0, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
    const xMax = projectPoint({ x: axisLen, y: 0, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
    const yMin = projectPoint({ x: 0, y: -axisLen, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
    const yMax = projectPoint({ x: 0, y: axisLen, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
    const zMin = projectPoint({ x: 0, y: 0, z: -axisLen }, yaw, pitch, roll, scale, depth, cx, cy);
    const zMax = projectPoint({ x: 0, y: 0, z: axisLen }, yaw, pitch, roll, scale, depth, cx, cy);

    let hoverProjSvg = "";
    if (hoveredPoint) {
      const p = projectPoint(
        { x: hoveredPoint.x, y: hoveredPoint.y, z: hoveredPoint.z },
        yaw,
        pitch,
        roll,
        scale,
        depth,
        cx,
        cy
      );
      const px = projectPoint({ x: hoveredPoint.x, y: 0, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
      const py = projectPoint({ x: 0, y: hoveredPoint.y, z: 0 }, yaw, pitch, roll, scale, depth, cx, cy);
      const pz = projectPoint({ x: 0, y: 0, z: hoveredPoint.z }, yaw, pitch, roll, scale, depth, cx, cy);
      hoverProjSvg = `
        <g class="alt-proj-layer" aria-hidden="true">
          <line x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${px.x.toFixed(2)}" y2="${px.y.toFixed(
        2
      )}" class="axis-proj axis-proj-x" />
          <line x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${py.x.toFixed(2)}" y2="${py.y.toFixed(
        2
      )}" class="axis-proj axis-proj-y" />
          <line x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${pz.x.toFixed(2)}" y2="${pz.y.toFixed(
        2
      )}" class="axis-proj axis-proj-z" />
          <circle cx="${px.x.toFixed(2)}" cy="${px.y.toFixed(2)}" r="2.2" class="axis-proj-dot" />
          <circle cx="${py.x.toFixed(2)}" cy="${py.y.toFixed(2)}" r="2.2" class="axis-proj-dot" />
          <circle cx="${pz.x.toFixed(2)}" cy="${pz.y.toFixed(2)}" r="2.2" class="axis-proj-dot" />
        </g>
      `;
    }

    const albumSvgs: string[] = [];
    const currentAlbumNumber = albums[a]?.albumNumber;
    const currentTheme = currentAlbumNumber != null ? themesByAlbum?.[currentAlbumNumber] : undefined;
    const monoColor = currentTheme?.darkMode ? "#f4f1f8" : "#171421";
    for (let idx = 0; idx < albums.length; idx++) {
      if (idx > Math.max(a, b)) continue;
      const pts = ensureAlbumData(idx);
      if (!pts) continue;
      const accent = albumAccentByIndex.get(idx) || "#b8860b";

      let op = 0;
      if (idx === a) op = 1;
      else if (idx === b && b !== a) op = 0.35 + 0.65 * clamp01(t);
      else if (idx < a) op = 0.22;
      if (op <= 0) continue;
      const pointColor = idx === a ? accent : monoColor;

      const marks = pts
        .map((p) => {
          const pr = projectPoint({ x: p.x, y: p.y, z: p.z }, yaw, pitch, roll, scale, depth, cx, cy);
          const s = Math.max(4, 8 * pr.k);
          const x = pr.x - s / 2;
          const y = pr.y - s / 2;
          const safeTitle = escapeHtml(p.title);
          return `<rect class="alt-pt" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${s.toFixed(
            2
          )}" height="${s.toFixed(
            2
          )}" fill="${pointColor}" fill-opacity="${(0.9 * op).toFixed(
            3
          )}" data-album="${escapeHtml(albums[idx].albumName)}" data-song="${safeTitle}" data-x="${p.x.toFixed(
            2
          )}" data-y="${p.y.toFixed(2)}" data-z="${p.z.toFixed(2)}" />`;
        })
        .join("");
      albumSvgs.push(marks);
    }

    host.innerHTML = `
      <svg class="alt-chart-svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(
      2
    )}" preserveAspectRatio="none" aria-label="3D song scatter">
        <g class="alt-axis-layer">
          <line x1="${xMin.x.toFixed(2)}" y1="${xMin.y.toFixed(2)}" x2="${xMax.x.toFixed(
      2
    )}" y2="${xMax.y.toFixed(2)}" class="axis axis-x" />
          <line x1="${yMin.x.toFixed(2)}" y1="${yMin.y.toFixed(2)}" x2="${yMax.x.toFixed(
      2
    )}" y2="${yMax.y.toFixed(2)}" class="axis axis-y" />
          <line x1="${zMin.x.toFixed(2)}" y1="${zMin.y.toFixed(2)}" x2="${zMax.x.toFixed(
      2
    )}" y2="${zMax.y.toFixed(2)}" class="axis axis-z" />
          <circle cx="${o.x.toFixed(2)}" cy="${o.y.toFixed(2)}" r="2.2" class="axis-origin"/>
          <text x="${xMin.x.toFixed(2)}" y="${(xMin.y - 8).toFixed(2)}" class="axis-label">Acoustic</text>
          <text x="${xMax.x.toFixed(2)}" y="${(xMax.y - 8).toFixed(2)}" class="axis-label">Synthetic</text>
          <text x="${yMin.x.toFixed(2)}" y="${(yMin.y - 8).toFixed(2)}" class="axis-label">Calm</text>
          <text x="${yMax.x.toFixed(2)}" y="${(yMax.y - 8).toFixed(2)}" class="axis-label">Intense</text>
          <text x="${zMin.x.toFixed(2)}" y="${(zMin.y - 8).toFixed(2)}" class="axis-label">Self</text>
          <text x="${zMax.x.toFixed(2)}" y="${(zMax.y - 8).toFixed(2)}" class="axis-label">Fictional</text>
        </g>
        <g class="alt-points-layer">
          ${albumSvgs.join("")}
        </g>
        ${hoverProjSvg}
      </svg>
    `;
  };

  const hideTooltip = (): void => {
    tooltip.hidden = true;
    hoveredPoint = null;
  };

  host.addEventListener("pointerleave", hideTooltip);
  host.addEventListener("pointermove", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.classList?.contains("alt-pt")) {
      hideTooltip();
      schedule();
      return;
    }
    const song = target.getAttribute("data-song") || "Unknown song";
    const album = target.getAttribute("data-album") || "Unknown album";
    const x = Number(target.getAttribute("data-x") || "0");
    const y = Number(target.getAttribute("data-y") || "0");
    const z = Number(target.getAttribute("data-z") || "0");
    hoveredPoint = { x, y, z };
    tooltip.innerHTML = `
      <div class="alt-tooltip-song">${song}</div>
      <div class="alt-tooltip-album">${album}</div>
      <div class="alt-tooltip-dims">X ${x.toFixed(2)} · Y ${y.toFixed(2)} · Z ${z.toFixed(2)}</div>
    `;
    tooltip.hidden = false;
    const rect = host.getBoundingClientRect();
    const tx = e.clientX - rect.left + 12;
    const ty = e.clientY - rect.top + 12;
    tooltip.style.left = `${tx}px`;
    tooltip.style.top = `${ty}px`;
  });

  let raf = 0;
  const tick = (ts: number): void => {
    raf = 0;

    if (!document.body.classList.contains("alt-mode")) return;
    if (lastFrameTs <= 0) lastFrameTs = ts;
    const dt = Math.max(0, Math.min(48, ts - lastFrameTs));
    lastFrameTs = ts;

    // Auto-orbit: only pressing/dragging interrupts. Resume immediately on release.
    if (!dragging) {
      autoPhaseMs += dt;
      yaw = autoBaseYaw + autoPhaseMs * autoYawDegPerMs;
      roll = autoBaseRoll + autoPhaseMs * autoRollDegPerMs;
      pitch = autoBasePitch + Math.sin(autoPhaseMs * autoPitchOscPerMs) * autoPitchAmp;
    }

    let blend = getVizScrollBlend(albums.length);
    if (isViewportEraStuckOnDesktop()) {
      const i = getEraIndexForViewportRef();
      blend = { a: i, b: i, t: 0 };
    }
    const { a, b, t } = blend;

    renderSvg(a, b, t);

    // Keep animating while alt mode is active.
    schedule();
  };

  const schedule = (): void => {
    if (!document.body.classList.contains("alt-mode")) return;
    if (raf) return;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  const bodyClassMo = new MutationObserver(() => {
    syncHostInteractivity();
    schedule();
  });
  bodyClassMo.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  syncHostInteractivity();
  schedule();

  return () => {
    bodyClassMo.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (raf) cancelAnimationFrame(raf);
    dock.remove();
  };
}

