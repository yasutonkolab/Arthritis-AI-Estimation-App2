-- Supabase マイグレーション用 SQL (v19: 手画像ファイル名の検証をアプリ側に集約)
-- migration_v18_hand_image_upload_policy.sql の適用後に実行してください。
-- 認証・所有者・施設・uploading状態の制限を維持し、既存データは削除しません。

begin;

drop policy if exists "hand_images_insert_own_screening" on storage.objects;

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
        and s.status = 'uploading'
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

commit;
