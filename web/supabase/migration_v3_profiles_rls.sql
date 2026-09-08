-- ===================================================
-- Supabase マイグレーション用 SQL (v3: profiles RLS 修正)
-- 既存テーブル・既存データを削除せずに適用してください。
-- ===================================================

begin;

-- 旧ポリシーを削除。schema.sql版とmigration_v2.sql版の両方に対応する。
drop policy if exists "profiles: admin は全件参照・編集可能, staff は自分自身のプロファイルを参照可能"
  on public.profiles;
drop policy if exists "profiles: admin は全件, staff は自分・自院を参照"
  on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_delete" on public.profiles;

-- スタッフはプロフィールを参照できるが、role / clinic_id / is_active を含む
-- プロフィールの変更はできない。変更は管理者Server Action（Service Role）から行う。
create policy "profiles_select"
  on public.profiles for select
  using (public.is_admin() or id = auth.uid() or clinic_id = public.get_user_clinic_id());

create policy "profiles_admin_insert"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_admin_delete"
  on public.profiles for delete
  using (public.is_admin());

commit;
