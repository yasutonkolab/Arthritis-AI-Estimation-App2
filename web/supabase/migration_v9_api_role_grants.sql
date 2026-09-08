-- ===================================================
-- Supabase マイグレーション用 SQL (v9: Data APIロールのテーブル権限)
-- v8_active_account_rls.sql の適用後に実行してください。
-- 既存テーブル・既存データは削除しません。
-- ===================================================

begin;

-- RLSポリシーを評価する前提となるDB権限を明示する。
-- 行・操作の制限は既存のRLSポリシーが継続して担う。
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table
  public.clinics,
  public.profiles,
  public.subjects,
  public.screenings,
  public.joint_results
to authenticated, service_role;
grant usage, select on sequence public.subject_number_seq to authenticated, service_role;

commit;
