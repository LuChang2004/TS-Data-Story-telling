/**
 * Phrase + token replacements for `translate-instrument-csv.mjs`.
 * Keep in sync with CSV naming conventions expected by `src/instrumentNames.ts`.
 */

/** Whole-cell phrases (album summary + inside song cells). Longest / most specific first where order matters for split/join. */
export const INSTRUMENT_PHRASES_FOR_CSV = [
  ["Synth (少量 (a little))", "Synth (a little)"],
  ["Acoustic Elements (少量 (a little))", "Acoustic Elements (a little)"],
  [",少量 (a little)", ", a little "],
  ["少量 (a little)", "a little "],
  ["部分 (some tracks)", "some tracks"],
  ["Synth (氛围)", "Synth (ambient)"],
];

const RAW_INSTRUMENT_TOKEN_PAIRS = [
  ["失真ElectricGuitar", "DistortedGuitar"],
  ["Electric子Drums", "ElectronicDrums"],
  ["Electric子音效", "ElectronicEffects"],
  ["合唱和声", "ChoirHarmonies"],
  ["福音和声", "GospelHarmonies"],
  ["人声和声", "VocalHarmonies"],
  ["警笛采样", "SirenSamples"],
  ["啦啦队采样", "Samples"],
  ["儿童采样", "Samples"],
  ["人声采样", "VocalSamples"],
  ["人声呼喊", "VocalShouts"],
  ["人声回声", "VocalEcho"],
  ["人声失真", "DistortedVocals"],
  ["人声效果", "VocalEffects"],
  ["失真人声", "DistortedVocals"],
  ["踏板钢Guitar", "PedalSteelGuitar"],
  ["指弹Guitar", "FingerstyleGuitar"],
  ["蓝调Guitar", "BluesGuitar"],
  ["放克Guitar", "FunkGuitar"],
  ["滑音Guitar", "SlideGuitar"],
  ["失真Guitar", "DistortedGuitar"],
  ["管Strings", "OrchestralStrings"],
  ["编程Drums", "ProgrammedDrums"],
  ["Drums机", "DrumMachine"],
  ["轻Drums", "SoftDrums"],
  ["手Drums", "HandDrums"],
  ["铃Drums", "Tambourine"],
  ["钢Drums", "SteelDrums"],
  ["Dubstep低音", "DubstepBass"],
  ["教堂风琴", "ChurchOrgan"],
  ["教堂钟声", "ChurchBells"],
  ["管钟", "TubularBells"],
  ["颤音琴", "Vibraphone"],
  ["雪橇铃", "SleighBells"],
  ["心跳声", "Heartbeat"],
  ["手指响", "FingerSnaps"],
  ["萨克斯", "Saxophone"],
  ["曼陀林", "Mandolin"],
  ["中提琴", "Viola"],
  ["大提琴", "Cello"],
  ["小号", "Trumpet"],
  ["竖琴", "Harp"],
  ["口琴", "Harmonica"],
  ["铜管", "Brass"],
  ["键盘", "Keyboard"],
  ["合成器", "Synth"],
  ["风琴", "Organ"],
  ["拍手", "HandClaps"],
  ["拨弦", "Pizzicato"],
  ["采样", "Samples"],
  ["和声", "Harmony"],
  ["人声", "Vocals"],
];

/** Longest Chinese keys first so e.g. 「失真ElectricGuitar」 wins over shorter substrings. */
export const INSTRUMENT_TOKEN_PAIRS_FOR_CSV = [...RAW_INSTRUMENT_TOKEN_PAIRS].sort(
  (a, b) => b[0].length - a[0].length
);
