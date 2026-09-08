/** Supabaseの内部エラーをログへ残し、画面には操作単位のエラーとして伝える。 */
export function throwSupabaseError(error: unknown, operation: string): never {
  console.error(`${operation}エラー:`, error);
  throw new Error(`${operation}に失敗しました`);
}
