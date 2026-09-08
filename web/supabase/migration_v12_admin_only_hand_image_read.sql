-- Supabase マイグレーション用 SQL (v12: 手画像の参照を本部管理者に限定)
-- v11_clinic_admin_write_rls.sql の適用後に実行してください。
-- 既存の撮影データは削除しません。

drop policy if exists "hand_images_select_authorized_screening" on storage.objects;

create policy "hand_images_select_authorized_screening"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'hand-images'
    and public.is_active_user()
    and public.is_admin()
  );
