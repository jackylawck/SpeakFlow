/**
 * 純函數：計算單句停留毫秒數
 * @param {string} sentence
 * @param {"dynamic"|"fixed"} strategy
 * @param {number} speedValue
 * @returns {number}
 */
export function calculateSentenceDurationMs(sentence, strategy, speedValue) {
  if (strategy === "fixed") {
    const sec = Number(speedValue) || 3.5;
    return Math.max(500, Math.round(sec * 1000));
  }

  const cjkCount = (sentence.match(/[\u4e00-\u9fa5\u3400-\u4dbf]/g) || []).length;
  const enWords = (
    sentence.replace(/[\u4e00-\u9fa5\u3400-\u4dbf]/g, " ").match(/[a-zA-Z0-9]+/g) || []
  ).length;

  const effectiveUnits = cjkCount + enWords * 1.4;
  const cpm = Math.max(40, Number(speedValue) || 210);
  const charsPerSec = cpm / 60;
  const basePauseSec = 0.55;

  const totalSec = Math.max(1.2, effectiveUnits / charsPerSec + basePauseSec);
  return Math.round(totalSec * 1000);
}

export function calculateTotalDurationMs(durations) {
  return durations.reduce((acc, ms) => acc + ms, 0);
}
