import { HAND_IMAGES_BUCKET } from "../storage.ts";
import { throwSupabaseError } from "./error.ts";

type SignedUrlClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
};

async function createSignedUrl(
  supabase: SignedUrlClient,
  path: string | null,
  expiresIn: number
) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(HAND_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throwSupabaseError(error, "手画像の署名付きURL発行");
  return data?.signedUrl ?? null;
}

export async function createSignedHandImageUrls(
  supabase: SignedUrlClient,
  paths: { right: string | null; left: string | null },
  expiresIn: number
) {
  const [right, left] = await Promise.all([
    createSignedUrl(supabase, paths.right, expiresIn),
    createSignedUrl(supabase, paths.left, expiresIn),
  ]);

  return { right, left };
}

/** 詳細画面ではStorage上の画像が欠損していても、記録自体は表示する。 */
export async function tryCreateSignedHandImageUrls(
  supabase: SignedUrlClient,
  paths: { right: string | null; left: string | null },
  expiresIn: number
) {
  try {
    return await createSignedHandImageUrls(supabase, paths, expiresIn);
  } catch {
    return { right: null, left: null };
  }
}
