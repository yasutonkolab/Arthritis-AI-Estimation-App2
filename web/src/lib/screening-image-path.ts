/** 作成者・スクリーニングに紐づく、許可された手画像パスだけを受け入れる。 */
export function isScreeningImagePath(
  path: string,
  userId: string,
  screeningId: string,
  side?: "right" | "left"
): boolean {
  const prefix = `${userId}/${screeningId}/`;
  if (!path.startsWith(prefix)) return false;

  const sidePattern = side ?? "(?:right|left)";
  return new RegExp(`^${sidePattern}_[0-9]+\\.jpg$`).test(path.slice(prefix.length));
}
