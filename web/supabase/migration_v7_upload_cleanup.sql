-- ===================================================
-- Supabase マイグレーション用 SQL (v7: アップロード失敗時のクリーンアップ)
-- v4_tenant_isolation.sql の適用後に実行してください。
-- ===================================================

begin;

drop policy if exists "hand_images_delete_own_uploading_screening" on storage.objects;

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

commit;
