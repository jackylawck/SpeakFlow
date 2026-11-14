/**
 * SpeakFlow Semantic Segmenter
 * [Integration-Tested Module] 負責中英混排語意斷句
 */

// P0: 快取 Intl.Segmenter 實例，避免編輯器每次擊鍵時重複建構引發效能瓶頸
let cachedSegmenter = null;

function getSegmenter() {
  if (!cachedSegmenter && typeof Intl !== "undefined" && Intl.Segmenter) {
    cachedSegmenter = new Intl.Segmenter("zh-HK", { granularity: "sentence" });
  }
  return cachedSegmenter;
}

// 預編譯降級用的正則表達式
const RE_ABBR = /\b(Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Co|vs|etc|e\.g|i\.e)\./gi;
const RE_DECIMAL = /(\d)\.(\d)/g;
// 使用安全的捕捉群組取代 Lookbehind，避免舊版 Safari/Firefox 發生致命 SyntaxError
const RE_SENTENCE_BOUNDARY = /([。！？!?…]|\.)\s+/g;

/**
 * 純函數：基於 Unicode UAX #29 的語意斷句引擎，附帶安全的正則降級方案
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (typeof text !== "string") return [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const segmenter = getSegmenter();
  
  if (segmenter) {
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

  // 降級方案：無 Intl.Segmenter 環境
  // 1. 保護英文縮寫與小數點
  let protectedText = normalized
    .replace(RE_ABBR, "$1__DOT__")
    .replace(RE_DECIMAL, "$1__DOT__$2");

  // 2. 將安全的句尾標點與空白轉換為強制換行符
  protectedText = protectedText.replace(RE_SENTENCE_BOUNDARY, "$1\n");

  // 3. 統一依換行切割並還原保護字元
  return protectedText
    .split(/\n+/)
    .map((s) => s.replace(/__DOT__/g, ".").trim())
    .filter(Boolean);
}
