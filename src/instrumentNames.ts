/**
 * 乐器名（instrument labels）— 全流程入口
 *
 * - **数据源**：项目根目录 `TS Data.csv`
 *   - 列 `song_instrumentation_types_proportions`：单曲占比，格式如 `AcousticGuitar(35%)、Drums(20%)`
 *   - 列 `album_instrumentation_types_proportions`：专辑级说明（自由文本，不经本模块解析为结构化列表）
 * - **解析**：`parseInstrumentationString` → 每条 `{ name, percent }`，`name` 经 `cleanInstrumentName`
 * - **聚合**：`aggregate.ts` 的 `instrumentWeightsFromSongs` 按曲目标签名累加权重
 * - **展示**：`vizRender.ts`（专辑 Top-N）、`main.ts`（曲目弹层）、`instrumentIcons.ts`（图标 URL）
 * - **图标**：`public/instrument-icons/{encodeURIComponent(cleanName)}.png`；全量清单 `npm run instruments:list` → `INSTRUMENT_NAMES.txt`
 * - **仅 Top6 栏可能出现的名字**（按专辑聚合后前 6 名的并集）：`npm run instruments:top6` → `INSTRUMENT_NAMES_TOP6.txt`
 * - **自定义序号图标**：`public/instruments-icons/Ins-01.png` … `Ins-14.png`（顺序见 `instrumentIconMap.ts`）；暗色专辑主题下由 `data-icon-invert` 做 `invert(1)` 反白
 * - **中译英替换表**（维护 CSV 时）：`scripts/instrument-translation-data.mjs` + `scripts/translate-instrument-csv.mjs`
 */

/**
 * Normalize labels parsed from CSV (strip stray brackets, quotes, etc.).
 * Use everywhere names are stored, displayed, or matched to icon files.
 */
export function cleanInstrumentName(raw: string): string {
  let s = raw.normalize("NFC").trim();
  const junkLead =
    /^[)\]}】〉›»"'""'`´、，,.:;|\\/\s]+/u;
  const junkTrail =
    /[(\[{「‹«"'""'`´、，,.:;|\\/\s]+$/u;
  for (let i = 0; i < 6; i++) {
    const next = s.replace(junkLead, "").replace(junkTrail, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Parses strings like `AcousticGuitar(35%)、Drums(20%)` into name / percent pairs. */
export function parseInstrumentationString(
  raw: string
): { name: string; percent: number }[] {
  const s = raw?.trim() ?? "";
  if (!s) return [];
  const out: { name: string; percent: number }[] = [];
  const re = /([^(%]+?)\((\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const name = cleanInstrumentName(
      m[1].replace(/^[、，,\s]+|[、，,\s]+$/g, "").trim()
    );
    const pct = parseFloat(m[2]);
    if (name && Number.isFinite(pct)) out.push({ name, percent: pct });
  }
  return out;
}

/** URL path for `public/instrument-icons/{encodeURIComponent(name)}.png`. */
export function instrumentIconUrl(name: string): string {
  const key = cleanInstrumentName(name);
  return `/instrument-icons/${encodeURIComponent(key)}.png`;
}
