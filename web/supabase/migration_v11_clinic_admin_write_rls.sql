-- ===================================================
-- Supabase マイグレーション用 SQL (v11: クリニックマスタの管理者専用更新)
-- v10_screening_integrity.sql の適用後に実行してください。
-- 既存データを削除せず、clinic_staffによる自院クリニック名の
-- 直接更新をRLSで拒否します。
-- ===================================================

begin;

drop policy if exists "clinics: admin は全件参照・編集可能, staff は自分の所属クリニックを参照可能" on public.clinics;
drop policy if exists "clinics: admin は全件, staff は自院を参照" on public.clinics;
drop policy if exists "clinics_active_access" on public.clinics;
drop policy if exists "clinics: 有効なユーザーがアクセス可能" on public.clinics;
drop policy if exists "clinics_select" on public.clinics;
drop policy if exists "clinics_admin_insert" on public.clinics;
drop policy if exists "clinics_admin_update" on public.clinics;
drop policy if exists "clinics_admin_delete" on public.clinics;

create policy "clinics_select"
  on public.clinics for select
  using (public.is_active_user() and (public.is_admin() or id = public.get_user_clinic_id()));

create policy "clinics_admin_insert"
  on public.clinics for insert
  with check (public.is_active_user() and public.is_admin());

create policy "clinics_admin_update"
  on public.clinics for update
  using (public.is_active_user() and public.is_admin())
  with check (public.is_active_user() and public.is_admin());

create policy "clinics_admin_delete"
  on public.clinics for delete
  using (public.is_active_user() and public.is_admin());

commit;
