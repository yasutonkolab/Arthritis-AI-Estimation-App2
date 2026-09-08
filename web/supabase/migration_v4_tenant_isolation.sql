-- ===================================================
-- Supabase マイグレーション用 SQL (v4: テナント分離強化)
-- 既存テーブル・既存データを削除せずに適用してください。
-- ===================================================

begin;

-- 自分が作成した未割り当て記録、または自院Subjectに紐付く記録だけを許可する。
drop policy if exists "screenings: admin は全件参照・編集可能, staff は自院の subjects / 自身が作成した screenings を参照・操作可能" on public.screenings;
drop policy if exists "screenings: admin は全件, staff は自院データを操作" on public.screenings;
drop policy if exists "screenings_tenant_access" on public.screenings;

create policy "screenings_tenant_access"
  on public.screenings for all
  using (
    public.is_admin()
    or (created_by = auth.uid() and subject_id is null)
    or exists (
      select 1
      from public.subjects s
      where s.id = subject_id
        and s.clinic_id = public.get_user_clinic_id()
    )
  )
  with check (
    public.is_admin()
    or (created_by = auth.uid() and subject_id is null)
    or exists (
      select 1
      from public.subjects s
      where s.id = subject_id
        and s.clinic_id = public.get_user_clinic_id()
    )
  );

-- joint_resultsもscreeningと同じテナント境界を使う。
drop policy if exists "joint_results: admin は全件, staff は自院の screenings に紐づくものを全操作可能" on public.joint_results;
drop policy if exists "joint_results: admin は全件, staff は自院データを操作" on public.joint_results;
drop policy if exists "joint_results_tenant_access" on public.joint_results;

create policy "joint_results_tenant_access"
  on public.joint_results for all
  using (
    public.is_admin()
    or exists (
      select 1
      from public.screenings s
      where s.id = screening_id
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
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.screenings s
      where s.id = screening_id
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
  );

-- Storage上のパスを {user_id}/{screening_id}/{side}_{timestamp}.jpg に限定し、
-- そのscreeningに対するDB上の権限も同時に確認する。
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'hand-images';

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
