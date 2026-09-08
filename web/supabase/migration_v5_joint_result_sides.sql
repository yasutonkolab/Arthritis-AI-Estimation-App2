-- ===================================================
-- Supabase マイグレーション用 SQL (v5: 左右別の関節判定結果)
-- 既存テーブル・既存データを削除せずに適用してください。
--
-- 既存の左右を識別できない結果は、暫定的に right として扱います。
-- 既存結果を左右別に復元することはできないため、必要に応じて
-- 本番適用前にバックアップとデータ確認を行ってください。
-- ===================================================

begin;

alter table public.joint_results
  add column if not exists side text;

update public.joint_results
set side = 'right'
where side is null;

alter table public.joint_results
  alter column side set default 'right',
  alter column side set not null;

alter table public.joint_results
  drop constraint if exists joint_results_side_check;

alter table public.joint_results
  add constraint joint_results_side_check
  check (side in ('right', 'left'));

create index if not exists idx_joint_results_screening on public.joint_results(screening_id);

-- 既存データに重複がある場合は、このインデックス作成前に確認・整理してください。
create unique index if not exists idx_joint_results_screening_side_joint
  on public.joint_results(screening_id, side, joint_name);

commit;
