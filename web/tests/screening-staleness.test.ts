import assert from "node:assert/strict";
import test from "node:test";
import {
  PROCESSING_STALE_AFTER_MS,
  isProcessingStatus,
  isStaleProcessing,
} from "../src/lib/screening-staleness.ts";

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

test("処理中ステータスだけを判定する", () => {
  assert.equal(isProcessingStatus("uploading"), true);
  assert.equal(isProcessingStatus("analyzing"), true);
  assert.equal(isProcessingStatus("completed"), false);
  assert.equal(isProcessingStatus("failed"), false);
});

test("最終状態更新から10分以上経過した処理中記録を中断候補とする", () => {
  const staleAt = new Date(NOW - PROCESSING_STALE_AFTER_MS).toISOString();
  const activeAt = new Date(NOW - PROCESSING_STALE_AFTER_MS + 1).toISOString();

  assert.equal(isStaleProcessing("analyzing", staleAt, NOW), true);
  assert.equal(isStaleProcessing("uploading", activeAt, NOW), false);
  assert.equal(isStaleProcessing("completed", staleAt, NOW), false);
  assert.equal(isStaleProcessing("analyzing", "invalid", NOW), false);
});
