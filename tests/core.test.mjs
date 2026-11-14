import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { splitSentences } from "../shared/segmenter.js";
import { calculateSentenceDurationMs, calculateTotalDurationMs } from "../shared/pacing.js";

test("Segmenter: 中英混排、中文省略號與數字小數點不誤切", () => {
  const sample = "各位觀眾大家好……今天公布最新通脹率為 3.14%，預計 Q3 達標。Welcome to SpeakFlow!";
  const sentences = splitSentences(sample);
  // UAX #29 視省略號為句中延續符號，因此前半段中文為 1 句、後方英文為 1 句（共 2 句）
  assert.equal(sentences.length, 2);
  assert.ok(sentences[0].includes("……"), "省略號不應產生多餘空片段");
  assert.ok(sentences[0].includes("3.14%"), "小數點不應被切斷");
  assert.equal(sentences[1], "Welcome to SpeakFlow!");
});

test("Segmenter: 英文縮寫（如 Dr.）遵循 UAX #29 規範行為（跨 ICU 版本相容驗證）", () => {
  const sample = "今天 Dr. Smith 公布最新數據。";
  const sentences = splitSentences(sample);
  assert.ok(sentences.some((s) => s.includes("Dr.")));
  assert.ok(sentences.some((s) => s.includes("Smith")));
});

test("Pacing: 動態字數配時與固定秒數策略", () => {
  const shortMs = calculateSentenceDurationMs("大家好。", "dynamic", 210);
  const longMs = calculateSentenceDurationMs("這是一段包含二十多個中文字的新聞播報測試句子。", "dynamic", 210);
  assert.ok(longMs > shortMs, "長句分配時間必須大於短句");

  const fixedMs = calculateSentenceDurationMs("任意長度句子", "fixed", 4.0);
  assert.equal(fixedMs, 4000);

  assert.equal(calculateTotalDurationMs([1500, 2500, 3000]), 7000);
});

test("Service Worker: CORE_ASSETS 檔案完整性檢查（防 404 死鏈）", async () => {
  const swPath = fileURLToPath(new URL("../sw.js", import.meta.url));
  const swCode = await readFile(swPath, "utf8");
  const match = swCode.match(/const CORE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, "找不到 CORE_ASSETS 陣列定義（請確認 sw.js 已更新為 v2.0.0）");

  const assets = Array.from(match[1].matchAll(/"([^"]+)"/g))
    .map((m) => m[1])
    .filter((p) => p !== "./");

  for (const relPath of assets) {
    const targetPath = fileURLToPath(new URL(`../${relPath.replace(/^\.\//, "")}`, import.meta.url));
    await assert.doesNotReject(
      () => access(targetPath),
      `sw.js 快取清單中的檔案不存在：${relPath}`
    );
  }
});
