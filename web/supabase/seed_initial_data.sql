-- ===================================================
-- 初期データ登録用 SQL (Seed Data)
-- Supabase ダッシュボードの 「SQL Editor」 にて実行してください。
-- ===================================================

-- 1. テスト用/初期契約クリニックの登録
insert into public.clinics (id, name)
values ('11111111-1111-1111-1111-111111111111', '東京中央整形外科')
on conflict (id) do nothing;

-- ---------------------------------------------------
-- 【注意】 Supabase Auth ユーザーとの紐付け手順
-- ---------------------------------------------------
-- 手順A: Web UI (推奨)
--   1. 下記のSQLで作成した admin アカウントで /admin にログイン
--   2. 「クリニック一覧」で契約先クリニックを作成
--   3. 「＋ スタッフアカウント発行」画面からメールアドレス・パスワードを入力して作成

-- 手順B: SQL Editorで直接作成する場合
--  先に Supabase Dashboard -> 「Authentication」 -> 「Users」 -> 「Add user」 で
--  ユーザーを作成し、発行された UUID を下に貼り付けて実行してください。

-- 例: 本部管理者 (admin) のプロフィール登録
-- insert into public.profiles (id, role, full_name, clinic_id)
-- values ('ここにAdminユーザーのUUID', 'admin', '本部管理者', null)
-- on conflict (id) do update set role = 'admin';

-- 例: 初期契約スタッフ (clinic_staff) のプロフィール登録
-- insert into public.profiles (id, role, full_name, clinic_id)
-- values ('ここにStaffユーザーのUUID', 'clinic_staff', '山田 太郎 医師', '11111111-1111-1111-1111-111111111111')
-- on conflict (id) do update set role = 'clinic_staff', clinic_id = '11111111-1111-1111-1111-111111111111';
