-- ===================================================
-- Supabase マイグレーション用 SQL
-- v20: 同一医療機関スタッフへの未割り当て関節結果の公開
-- migration_v19_hand_image_filename_policy.sql の適用後に実行してください。
-- ===================================================

begin;

drop policy if exists "joint_results_tenant_access" on public.joint_results;

create policy "joint_results_tenant_access"
  on public.joint_results for select
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.screenings s
        where s.id = screening_id and (
          (
            s.subject_id is null
            and exists (
              select 1 from public.profiles creator
              where creator.id = s.created_by
                and creator.clinic_id = public.get_user_clinic_id()
            )
          )
          or exists (
            select 1 from public.subjects sub
            where sub.id = s.subject_id
              and sub.clinic_id = public.get_user_clinic_id()
          )
        )
      )
    )
  );

commit;
