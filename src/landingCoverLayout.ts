/**
 * Landing hero cover positions: edit `public/data/landing-cover-layout.json`
 * (keys = album number from CSV). Any omitted field keeps the built-in default scatter.
 */

export type LandingCoverLayoutOverride = {
  /**
   * Unit direction from center (roughly -1…1). Used with `rad` for base offset
   * and with scroll “spread” so covers fly outward along (ax, ay).
   */
  ax?: number;
  ay?: number;
  /** Distance factor; typical ~0.12–0.42. Larger = farther from title. */
  rad?: number;
  /** Base rotation in degrees. */
  rotDeg?: number;
  /** Same as rotDeg (optional alias for hand-edited JSON). */
  rot?: number;
  /** Visual scale; typical ~0.45–0.95. */
  scale?: number;
  /** CSS stacking order; higher draws on top. */
  z?: number;
};

export type ResolvedLandingCoverLayout = {
  ax: number;
  ay: number;
  rad: number;
  rot: number;
  sc: number;
  z: number;
};

/** Built-in scatter when JSON has no entry (or no field). */
export function defaultLandingCoverLayout(index: number): ResolvedLandingCoverLayout {
  const golden = (index + 1) * 0.6180339887;
  const ang = golden * Math.PI * 2;
  return {
    ax: Math.cos(ang),
    ay: Math.sin(ang),
    rad: 0.18 + (index % 5) * 0.038,
    rot: -24 + ((index * 19) % 48),
    sc: 0.5 + (index % 6) * 0.07,
    z: 2 + (index % 7),
  };
}

/** Accepts finite numbers or numeric strings (common JSON edit mistake). */
function coerceNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function resolveLandingCoverLayout(
  index: number,
  albumNumber: number,
  byAlbumNumber: Record<string, LandingCoverLayoutOverride>
): ResolvedLandingCoverLayout {
  const def = defaultLandingCoverLayout(index);
  const raw =
    byAlbumNumber[String(albumNumber)] ??
    byAlbumNumber[albumNumber as unknown as string];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return def;

  const rot =
    raw.rotDeg !== undefined
      ? coerceNum(raw.rotDeg, def.rot)
      : coerceNum(raw.rot, def.rot);

  return {
    ax: coerceNum(raw.ax, def.ax),
    ay: coerceNum(raw.ay, def.ay),
    rad: coerceNum(raw.rad, def.rad),
    rot,
    sc: coerceNum(raw.scale, def.sc),
    z: Math.round(coerceNum(raw.z, def.z)),
  };
}

export async function loadLandingCoverLayout(): Promise<
  Record<string, LandingCoverLayoutOverride>
> {
  try {
    const res = await fetch("/data/landing-cover-layout.json", {
      cache: "no-store",
    });
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.warn(
          "[landing-cover-layout]",
          res.status,
          res.statusText,
          "— using built-in scatter"
        );
      }
      return {};
    }
    const text = await res.text();
    let data: { byAlbumNumber?: unknown };
    try {
      data = JSON.parse(text) as { byAlbumNumber?: unknown };
    } catch (e) {
      console.warn(
        "[landing-cover-layout] Invalid JSON (check commas/quotes). Using built-in scatter.",
        e
      );
      return {};
    }
    const bag = data?.byAlbumNumber;
    if (
      !bag ||
      typeof bag !== "object" ||
      Array.isArray(bag)
    ) {
      return {};
    }
    return bag as Record<string, LandingCoverLayoutOverride>;
  } catch (e) {
    console.warn("[landing-cover-layout] Fetch failed — using built-in scatter.", e);
    return {};
  }
}
