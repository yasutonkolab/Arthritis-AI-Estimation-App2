/** 被験者ID検索用に空白を除き、大小文字を揃える。 */
export function normalizeSubjectQuery(query: string): string {
  return query.replace(/\s+/g, "").toLowerCase().slice(0, 100);
}

/** PostgreSQL LIKEのワイルドカードを検索文字として扱う。 */
export function escapeSubjectLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, "\\$&");
}

/** 空の検索語は全件一致。部分一致（大文字小文字・空白無視）。 */
export function subjectIdMatchesQuery(subjectId: string, query: string): boolean {
  const normalized = normalizeSubjectQuery(query);
  if (!normalized) return true;
  return normalizeSubjectQuery(subjectId).includes(normalized);
}

export function filterSubjectsById<T extends { id: string }>(
  subjects: T[],
  query: string
): T[] {
  if (!normalizeSubjectQuery(query)) return subjects;
  return subjects.filter((subject) => subjectIdMatchesQuery(subject.id, query));
}
