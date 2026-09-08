-- ===================================================
-- Supabase マイグレーション用 SQL (v8: 無効アカウントのRLS整合性強化)
-- v7_upload_cleanup.sql の適用後に実行してください。
-- 既存テーブル・既存データは削除しません。
-- ===================================================

begin;

-- Server Actionだけでなく、Supabaseの直接アクセスでも無効アカウントを拒否する。
create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

-- clinics
drop policy if exists "clinics: admin は全件参照・編集可能, staff は自分の所属クリニックを参照可能" on public.clinics;
drop policy if exists "clinics: admin は全件, staff は自院を参照" on public.clinics;
drop policy if exists "clinics_active_access" on public.clinics;
drop policy if exists "clinics: 有効なユーザーがアクセス可能" on public.clinics;

create policy "clinics: 有効なユーザーがアクセス可能"
  on public.clinics for all
  using (public.is_active_user() and (public.is_admin() or id = public.get_user_clinic_id()))
  with check (public.is_active_user() and (public.is_admin() or id = public.get_user_clinic_id()));

-- profiles
drop policy if exists "profiles: admin は全件参照・編集可能, staff は自分自身のプロファイルを参照可能" on public.profiles;
drop policy if exists "profiles: admin は全件, staff は自分・自院を参照" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  using (
    public.is_active_user()
    and (public.is_admin() or id = auth.uid() or clinic_id = public.get_user_clinic_id())
  );

-- subjects
drop policy if exists "subjects: admin は全件参照・編集可能, staff は自院の subjects を全操作可能" on public.subjects;
drop policy if exists "subjects: admin は全件, staff は自院データを操作" on public.subjects;
drop policy if exists "subjects_active_tenant_access" on public.subjects;
drop policy if exists "subjects: 有効なユーザーが自院データを操作可能" on public.subjects;

create policy "subjects: 有効なユーザーが自院データを操作可能"
  on public.subjects for all
  using (public.is_active_user() and (public.is_admin() or clinic_id = public.get_user_clinic_id()))
  with check (public.is_active_user() and (public.is_admin() or clinic_id = public.get_user_clinic_id()));

-- screenings
drop policy if exists "screenings: admin は全件参照・編集可能, staff は自院の subjects / 自身が作成した screenings を参照・操作可能" on public.screenings;
drop policy if exists "screenings: admin は全件, staff は自院データを操作" on public.screenings;
drop policy if exists "screenings_tenant_access" on public.screenings;

create policy "screenings_tenant_access"
  on public.screenings for all
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or (created_by = auth.uid() and subject_id is null)
      or exists (
        select 1 from public.subjects s
        where s.id = subject_id and s.clinic_id = public.get_user_clinic_id()
      )
    )
  )
  with check (
    public.is_active_user()
    and (
      public.is_admin()
      or (created_by = auth.uid() and subject_id is null)
      or exists (
        select 1 from public.subjects s
        where s.id = subject_id and s.clinic_id = public.get_user_clinic_id()
      )
    )
  );

-- joint_results
drop policy if exists "joint_results: admin は全件, staff は自院の screenings に紐づくものを全操作可能" on public.joint_results;
drop policy if exists "joint_results: admin は全件, staff は自院データを操作" on public.joint_results;
drop policy if exists "joint_results_tenant_access" on public.joint_results;

create policy "joint_results_tenant_access"
  on public.joint_results for all
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.screenings s
        where s.id = screening_id
          and (
            (s.created_by = auth.uid() and s.subject_id is null)
            or exists (
              select 1 from public.subjects sub
              where sub.id = s.subject_id
                and sub.clinic_id = public.get_user_clinic_id()
            )
          )
      )
    )
  )
  with check (
    public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.screenings s
        where s.id = screening_id
          and (
            (s.created_by = auth.uid() and s.subject_id is null)
            or exists (
              select 1 from public.subjects sub
              where sub.id = s.subject_id
                and sub.clinic_id = public.get_user_clinic_id()
            )
          )
      )
    )
  );

-- Storage
drop policy if exists "hand-images: 本人がアップロード" on storage.objects;
drop policy if exists "hand-images: 本人 or 医師が参照" on storage.objects;
drop policy if exists "hand-images: 認証済みユーザーがアップロード" on storage.objects;
drop policy if exists "hand-images: 認証済みユーザーが参照" on storage.objects;
drop policy if exists "hand_images_insert_own_screening" on storage.objects;
drop policy if exists "hand_images_select_authorized_screening" on storage.objects;
drop policy if exists "hand_images_delete_own_uploading_screening" on storage.objects;

create policy "hand_images_insert_own_screening"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'hand-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.screenings s
      where s.id::text = (storage.foldername(name))[2]
        and s.created_by = auth.uid()
        and (
          s.subject_id is null
          or exists (
            select 1
            from public.subjects sub
            where sub.id = s.subject_id
              and sub.clinic_id = public.get_user_clinic_id()
          )
        )
    )
  );

create policy "hand_images_delete_own_uploading_screening"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'hand-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1
      from public.screenings s
      where s.id::text = (storage.foldername(name))[2]
        and s.created_by = auth.uid()
        and s.status = 'uploading'
    )
  );

create policy "hand_images_select_authorized_screening"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hand-images'
    and public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.screenings s
        where s.id::text = (storage.foldername(name))[2]
          and (
            (s.created_by = auth.uid() and s.subject_id is null)
            or exists (
              select 1
              from public.subjects sub
              where sub.id = s.subject_id
                and sub.clinic_id = public.get_user_clinic_id()
            )
          )
      )
    )
  );

commit;
