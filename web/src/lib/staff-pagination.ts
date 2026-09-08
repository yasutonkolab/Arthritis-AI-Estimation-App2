/** スタッフ向け一覧で1ページに表示する件数。 */
export const STAFF_LIST_PAGE_SIZE = 20;

/** 一覧画面で使用するページ情報。 */
export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** PostgRESTのrangeに渡す行範囲。 */
export type PageRange = {
  firstRow: number;
  lastRow: number;
};

/** URLやAction引数のページ番号を安全な正整数へ正規化する。 */
export function normalizePage(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** 総件数と要求ページから表示用のページ情報を生成する。 */
export function paginationMeta(
  total: number,
  requestedPage: number,
  pageSize = STAFF_LIST_PAGE_SIZE
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    total,
    page: Math.min(normalizePage(requestedPage), totalPages),
    pageSize,
    totalPages,
  };
}

/** 指定ページに対応するPostgRESTの取得範囲を計算する。 */
export function pageRange(
  page: number,
  pageSize = STAFF_LIST_PAGE_SIZE
): PageRange {
  const safePage = normalizePage(page);
  const firstRow = (safePage - 1) * pageSize;
  return { firstRow, lastRow: firstRow + pageSize - 1 };
}

/** PostgRESTが返す取得範囲超過エラーかどうかを判定する。 */
export function isUnsatisfiableRange(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST103"
  );
}

/** 検索条件を維持したページ移動用URLを組み立てる。 */
export function paginatedListHref(
  pathname: string,
  page: number,
  params: Record<string, string | undefined> = {}
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  if (page > 1) searchParams.set("page", String(page));
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
