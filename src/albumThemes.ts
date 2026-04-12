/**
 * Per-album page background (vertical gradient) + light/dark UI mode.
 *
 * Edit: `public/data/album-themes.json` — keys are CSV **Album Number** strings ("1" … "12").
 * Optional `accent` / `accent2` set per-album `--accent` / `--accent2`; omit to use palette defaults for `darkMode`.
 *
 * UI tokens are driven entirely from JS (no `theme-album-dark` class) so light↔dark can
 * interpolate smoothly with scroll, same as the gradient.
 */
export interface AlbumThemeConfig {
  gradientTop: string;
  gradientBottom: string;
  darkMode: boolean;
  /** Overrides `--accent` when set (e.g. chart highlights, links). */
  accent?: string;
  /** Overrides `--accent2` when set (secondary highlight). */
  accent2?: string;
}

export const DEFAULT_ALBUM_THEME: AlbumThemeConfig = {
  gradientTop: "#f5f4f8",
  gradientBottom: "#ebe8f2",
  darkMode: false,
};

const UI_KEYS = [
  "--text",
  "--muted",
  "--surface",
  "--surface2",
  "--accent",
  "--accent2",
  "--bg",
] as const;

type UIKey = (typeof UI_KEYS)[number];

const PALETTE_LIGHT: Record<UIKey, string> = {
  "--text": "#1a1628",
  "--muted": "#5c566f",
  "--surface": "#ffffff",
  "--surface2": "#eceaf1",
  "--accent": "#b8860b",
  "--accent2": "#b84d7a",
  "--bg": "#f5f4f8",
};

const PALETTE_DARK: Record<UIKey, string> = {
  "--text": "#f4f1f8",
  "--muted": "#a8a0b8",
  "--surface": "#1f1d28",
  "--surface2": "#2a2835",
  "--accent": "#e8c547",
  "--accent2": "#d472a8",
  "--bg": "#121018",
};

const LINE_LIGHT = "rgba(26, 22, 40, 0.1)";
const LINE_DARK = "rgba(255, 255, 255, 0.1)";

function uiPalette(dark: boolean): Record<UIKey, string> {
  return dark ? PALETTE_DARK : PALETTE_LIGHT;
}

function uiPaletteForTheme(theme: AlbumThemeConfig): Record<UIKey, string> {
  const base = uiPalette(theme.darkMode);
  return {
    ...base,
    ...(theme.accent ? { "--accent": theme.accent } : {}),
    ...(theme.accent2 ? { "--accent2": theme.accent2 } : {}),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Ease: scroll-driven `t` stays linear; this smooths the actual color motion. */
function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

const rgbProbeCache = new Map<string, { r: number; g: number; b: number }>();

function probeRgb(cssColor: string): { r: number; g: number; b: number } | null {
  const cached = rgbProbeCache.get(cssColor);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const el = document.createElement("span");
  el.style.cssText = `position:fixed;left:-9999px;top:0;color:${cssColor};visibility:hidden;pointer-events:none`;
  document.documentElement.appendChild(el);
  const rgb = getComputedStyle(el).color;
  el.remove();
  const m = rgb.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return null;
  const v = { r: +m[1], g: +m[2], b: +m[3] };
  rgbProbeCache.set(cssColor, v);
  return v;
}

function lerpCssColor(a: string, b: string, k: number): string {
  const ra = probeRgb(a);
  const rb = probeRgb(b);
  if (!ra || !rb) return k < 0.5 ? a : b;
  const r = Math.round(ra.r + (rb.r - ra.r) * k);
  const g = Math.round(ra.g + (rb.g - ra.g) * k);
  const bl = Math.round(ra.b + (rb.b - ra.b) * k);
  return `rgb(${r}, ${g}, ${bl})`;
}

function parseRgba(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (!m) return null;
  return {
    r: +m[1],
    g: +m[2],
    b: +m[3],
    a: m[4] !== undefined ? +m[4] : 1,
  };
}

function lerpRgba(a: string, b: string, k: number): string {
  const pa = parseRgba(a);
  const pb = parseRgba(b);
  if (!pa || !pb) return k < 0.5 ? a : b;
  const r = Math.round(pa.r + (pb.r - pa.r) * k);
  const g = Math.round(pa.g + (pb.g - pa.g) * k);
  const bl = Math.round(pa.b + (pb.b - pa.b) * k);
  const al = pa.a + (pb.a - pa.a) * k;
  return `rgba(${r}, ${g}, ${bl}, ${al.toFixed(3)})`;
}

function srgbChannelToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const R = srgbChannelToLinear(rgb.r);
  const G = srgbChannelToLinear(rgb.g);
  const B = srgbChannelToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

type BlendSnapshot = {
  gradientTop: string;
  gradientBottom: string;
  ui: Record<UIKey, string>;
  line: string;
  darkBlend: number;
};

function buildBlendSnapshot(
  ta: AlbumThemeConfig,
  tb: AlbumThemeConfig,
  t: number
): BlendSnapshot {
  const k = smoothstep01(clamp(t, 0, 1));
  const gradientTop = lerpCssColor(ta.gradientTop, tb.gradientTop, k);
  const gradientBottom = lerpCssColor(ta.gradientBottom, tb.gradientBottom, k);
  const pa = uiPaletteForTheme(ta);
  const pb = uiPaletteForTheme(tb);
  const ui = {} as Record<UIKey, string>;
  for (const key of UI_KEYS) {
    ui[key] = lerpCssColor(pa[key], pb[key], k);
  }
  const la = ta.darkMode ? LINE_DARK : LINE_LIGHT;
  const lb = tb.darkMode ? LINE_DARK : LINE_LIGHT;
  const line = lerpRgba(la, lb, k);
  const darkA = ta.darkMode ? 1 : 0;
  const darkB = tb.darkMode ? 1 : 0;
  const darkBlend = darkA * (1 - k) + darkB * k;
  return { gradientTop, gradientBottom, ui, line, darkBlend };
}

let defaultBlendSnapshotCache: BlendSnapshot | null = null;

function getDefaultBlendSnapshot(): BlendSnapshot {
  if (!defaultBlendSnapshotCache) {
    defaultBlendSnapshotCache = buildBlendSnapshot(
      DEFAULT_ALBUM_THEME,
      DEFAULT_ALBUM_THEME,
      0
    );
  }
  return defaultBlendSnapshotCache;
}

/** Linear mix (for intro scroll); album↔album blend still uses smoothstep inside each snapshot. */
function lerpBlendSnapshotLinear(a: BlendSnapshot, b: BlendSnapshot, u: number): BlendSnapshot {
  const mu = clamp(u, 0, 1);
  const ui = {} as Record<UIKey, string>;
  for (const key of UI_KEYS) {
    ui[key] = lerpCssColor(a.ui[key], b.ui[key], mu);
  }
  return {
    gradientTop: lerpCssColor(a.gradientTop, b.gradientTop, mu),
    gradientBottom: lerpCssColor(a.gradientBottom, b.gradientBottom, mu),
    ui,
    line: lerpRgba(a.line, b.line, mu),
    darkBlend: a.darkBlend * (1 - mu) + b.darkBlend * mu,
  };
}

function applyBlendSnapshot(s: BlendSnapshot): void {
  const root = document.documentElement;
  root.style.setProperty("--page-gradient-top", s.gradientTop);
  root.style.setProperty("--page-gradient-bottom", s.gradientBottom);
  for (const key of UI_KEYS) {
    root.style.setProperty(key, s.ui[key]);
  }
  root.style.setProperty("--line", s.line);
  root.dataset.iconInvert = s.darkBlend >= 0.5 ? "1" : "0";

  const rt = probeRgb(s.gradientTop);
  const rb = probeRgb(s.gradientBottom);
  if (rt && rb) {
    const lum = (relativeLuminance(rt) + relativeLuminance(rb)) / 2;
    root.style.colorScheme = lum < 0.45 ? "dark" : "light";
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", s.gradientBottom);
}

/**
 * Apply blended visuals: gradient + all UI CSS variables.
 * `t` is scroll-linear 0 = A, 1 = B; internally eased with smoothstep for smooth color paths.
 */
export function applyAlbumVisualBlend(
  ta: AlbumThemeConfig,
  tb: AlbumThemeConfig,
  t: number
): void {
  applyBlendSnapshot(buildBlendSnapshot(ta, tb, t));
}

/**
 * Lerps from the default (intro) theme toward the scroll-based `ta`↔`tb` blend.
 * `introMix` 0 = neutral landing; 1 = full scroll theme (same as `applyAlbumVisualBlend`).
 */
export function applyAlbumVisualBlendWithLandingIntro(
  ta: AlbumThemeConfig,
  tb: AlbumThemeConfig,
  t: number,
  introMix: number
): void {
  const def = getDefaultBlendSnapshot();
  const full = buildBlendSnapshot(ta, tb, t);
  applyBlendSnapshot(lerpBlendSnapshotLinear(def, full, introMix));
}

export async function loadAlbumThemes(): Promise<
  Record<number, AlbumThemeConfig>
> {
  try {
    const res = await fetch("/data/album-themes.json", { cache: "no-store" });
    if (!res.ok) return {};
    const raw = (await res.json()) as Record<string, unknown>;
    const out: Record<number, AlbumThemeConfig> = {};
    for (const [key, val] of Object.entries(raw)) {
      const n = parseInt(key, 10);
      if (!Number.isFinite(n) || val === null || typeof val !== "object") continue;
      const o = val as Record<string, unknown>;
      const gradientTop = String(o.gradientTop ?? "").trim();
      const gradientBottom = String(o.gradientBottom ?? "").trim();
      if (!gradientTop || !gradientBottom) continue;
      const accent =
        typeof o.accent === "string" ? o.accent.trim() : "";
      const accent2 =
        typeof o.accent2 === "string" ? o.accent2.trim() : "";
      const row: AlbumThemeConfig = {
        gradientTop,
        gradientBottom,
        darkMode: Boolean(o.darkMode),
      };
      if (accent) row.accent = accent;
      if (accent2) row.accent2 = accent2;
      out[n] = row;
    }
    return out;
  } catch {
    return {};
  }
}

export function resolveAlbumTheme(
  albumNumber: number,
  themes: Record<number, AlbumThemeConfig>
): AlbumThemeConfig {
  return themes[albumNumber] ?? DEFAULT_ALBUM_THEME;
}

export function applyAlbumThemeResolved(theme: AlbumThemeConfig): void {
  applyAlbumVisualBlend(theme, theme, 0);
}

export function applyAlbumTheme(
  albumNumber: number,
  themes: Record<number, AlbumThemeConfig>
): void {
  applyAlbumThemeResolved(resolveAlbumTheme(albumNumber, themes));
}
