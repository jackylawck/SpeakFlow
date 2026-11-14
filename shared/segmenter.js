/**
 * 純函數：基於 Unicode UAX #29 的語意斷句引擎，附帶舊環境正則降級
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("zh-Hant", { granularity: "sentence" });
    const result = [];
    for (const para of normalized.split(/\n+/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      for (const seg of segmenter.segment(trimmed)) {
        const s = seg.segment.trim();
        if (s) result.push(s);
      }
    }
    return result;
  }

  const protectedText = normalized
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Co|vs|etc|e\.g|i\.e)\./gi, "$1__DOT__")
    .replace(/(\d)\.(\d)/g, "$1__DOT__$2");

  return protectedText
    .split(/(?<=[。！？!?…]|\.)\s+|\n+/)
    .map((s) => s.replace(/__DOT__/g, ".").trim())
    .filter(Boolean);
}
