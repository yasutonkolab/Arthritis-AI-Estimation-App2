import assert from "node:assert/strict";
import test from "node:test";
import {
  createSignedHandImageUrls,
  tryCreateSignedHandImageUrls,
} from "../src/lib/supabase/signed-hand-images.ts";

function signedUrlClient(error: { message: string } | null) {
  return {
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: error ? null : { signedUrl: `https://storage.example/${path}` },
          error,
        }),
      }),
    },
  };
}

test("手画像表示: 署名付きURLを左右とも返す", async () => {
  const urls = await createSignedHandImageUrls(
    signedUrlClient(null),
    { right: "right.jpg", left: "left.jpg" },
    60
  );

  assert.deepEqual(urls, {
    right: "https://storage.example/right.jpg",
    left: "https://storage.example/left.jpg",
  });
});

test("手画像表示: Storage上の画像が欠損しても記録表示を継続する", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const urls = await tryCreateSignedHandImageUrls(
      signedUrlClient({ message: "Object not found" }),
      { right: "missing-right.jpg", left: "missing-left.jpg" },
      60
    );

    assert.deepEqual(urls, { right: null, left: null });
  } finally {
    console.error = originalConsoleError;
  }
});
