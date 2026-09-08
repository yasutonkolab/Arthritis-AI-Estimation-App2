import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { HAND_IMAGES_BUCKET } from "../src/lib/storage.ts";

const STORAGE_SOURCES = [
  "src/app/actions/analyze.ts",
  "src/app/actions/screenings.ts",
  "src/components/CaptureFlow.tsx",
  "src/lib/supabase/signed-hand-images.ts",
];

const STORAGE_CALLERS = [
  "src/app/actions/screenings.ts",
  "src/components/CaptureFlow.tsx",
  "src/lib/supabase/signed-hand-images.ts",
];

test("手画像のStorage操作は共通のhand-imagesバケットを使う", async () => {
  assert.equal(HAND_IMAGES_BUCKET, "hand-images");

  const sources = await Promise.all(STORAGE_SOURCES.map((path) => readFile(path, "utf8")));

  for (const source of sources) {
    assert.doesNotMatch(source, /\.from\(["'](?:hand-images|images)["']\)/);
  }

  const callers = await Promise.all(STORAGE_CALLERS.map((path) => readFile(path, "utf8")));
  callers.forEach((source) => assert.match(source, /from\(HAND_IMAGES_BUCKET\)/));
});
