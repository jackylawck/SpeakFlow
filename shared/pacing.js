const DEFAULT_FIXED_SEC = 3.5;
const MIN_FIXED_MS = 500;

const DEFAULT_CPM = 210;
const MIN_CPM = 40;
const MIN_DYNAMIC_SEC = 1.2;

const EN_WORD_WEIGHT = 1.4;
const BASE_PAUSE_SEC = 0.55;
const CLAUSE_PAUSE_SEC = 0.15;

// 預編譯正則表達式，避免在編輯器即時輸入時重複建構。
// 注意：以下正則均帶 g flag，僅可使用 String.prototype.match / replace / matchAll；
// 禁止使用 RegExp.prototype.test / exec——它們會修改 lastIndex 造成隱性狀態污染。
const RE_HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2fa1f}]/gu;
// 支援小數點 (3.14)、版本號 (v2.1.1)、縮寫撇號 (don't) 與連字號 (COVID-19) 合併為單一語音單位
const RE_EN_WORD = /[a-zA-Z0-9]+(?:[.'’\-–][a-zA-Z0-9]+)*/g;
// 中文破折號「——」由兩個 U+2014 組成，刻意計為 2 次微停頓（300ms），貼近新聞播報語氣轉折長度
const RE_CLAUSE_PAUSE = /[，、；：,;—–]/g;

/**
 * 純函數：計算單句停留毫秒數
 * @param {string} sentence
 * @param {"dynamic"|"fixed"} strategy
 * @param {number|string} speedValue
 * @returns {number}
 */
export function calculateSentenceDurationMs(sentence, strategy, speedValue) {
  if (typeof sentence !== "string" || !sentence.trim()) return 0;

  if (strategy === "fixed") {
    const parsed = Number(speedValue);
    const sec = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FIXED_SEC;
    return Math.max(MIN_FIXED_MS, Math.round(sec * 1000));
  }

  const cjkCount = (sentence.match(RE_HAN) || []).length;
  const nonHanText = sentence.replace(RE_HAN, " ");
  const enWords = (nonHanText.match(RE_EN_WORD) || []).length;
  const clausePauses = (sentence.match(RE_CLAUSE_PAUSE) || []).length;

  const effectiveUnits = cjkCount + enWords * EN_WORD_WEIGHT;
  const parsedCpm = Number(speedValue);
  const cpm = Math.max(MIN_CPM, Number.isFinite(parsedCpm) && parsedCpm > 0 ? parsedCpm : DEFAULT_CPM);
  const charsPerSec = cpm / 60;

  const totalSec = Math.max(
    MIN_DYNAMIC_SEC,
    effectiveUnits / charsPerSec + BASE_PAUSE_SEC + clausePauses * CLAUSE_PAUSE_SEC
  );
  return Math.round(totalSec * 1000);
}

/**
 * 純函數：加總所有句子停留毫秒數
 * @param {number[]} durations
 * @returns {number}
 */
export function calculateTotalDurationMs(durations) {
  if (!Array.isArray(durations) || durations.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < durations.length; i++) {
    const ms = Number(durations[i]);
    if (Number.isFinite(ms) && ms > 0) {
      total += ms;
    }
  }
  return total;
}
