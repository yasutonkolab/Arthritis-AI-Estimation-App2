-- ===================================================
-- Supabase マイグレーション用 SQL (v2: 匿名グルーピング＆マルチテナント対応)
-- Supabase ダッシュボードの 「SQL Editor」 に貼り付けて実行してください。
-- ===================================================

-- 1. 古いテーブル・ポリシー・関数の削除（クリーンアップ）
drop table if exists public.joint_results cascade;
drop table if exists public.screenings cascade;
drop table if exists public.profiles cascade;
drop table if exists public.subjects cascade;
drop table if exists public.clinics cascade;
drop sequence if exists public.subject_number_seq cascade;
drop function if exists public.is_doctor() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.get_user_clinic_id() cascade;

-- 2. clinics (医療機関) テーブルの作成
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 3. profiles テーブルの再作成
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'clinic_staff')),
  full_name text not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 被験者ID用シーケンス (keio1, keio2, keio3...)
create sequence public.subject_number_seq start 1;

-- 4. subjects (匿名の被験者グループ) テーブルの作成
create table public.subjects (
  id text primary key default ('keio' || nextval('public.subject_number_seq')::text),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_subjects_clinic on public.subjects(clinic_id, created_at desc);

-- 5. screenings テーブルの再作成
create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  subject_id text references public.subjects(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'uploading'
    check (status in ('uploading', 'analyzing', 'completed', 'failed')),
  total_inflamed_joints integer,
  right_image_url text,
  left_image_url text,
  created_at timestamptz not null default now()
);

create index idx_screenings_subject on public.screenings(subject_id, created_at desc);

-- 6. joint_results テーブルの再作成
create table public.joint_results (
  id uuid primary key default gen_random_uuid(),
  screening_id uuid not null references public.screenings(id) on delete cascade,
  side text not null check (side in ('right', 'left')),
  joint_name text not null,
  is_inflamed boolean not null default false,
  confidence_score double precision not null default 0
    check (confidence_score between 0 and 1)
);

create index idx_joint_results_screening on public.joint_results(screening_id);
create unique index idx_joint_results_screening_side_joint
  on public.joint_results(screening_id, side, joint_name);

-- ========== 解析結果の原子的な確定 ==========
create or replace function public.complete_screening_analysis(
  p_screening_id uuid,
  p_total_inflamed_joints integer,
  p_right_joints jsonb,
  p_left_joints jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_screening_id uuid;
  calculated_total integer;
begin
  if p_total_inflamed_joints is null
     or p_total_inflamed_joints < 0
     or p_total_inflamed_joints > 30 then
    raise exception '解析結果の総炎症関節数が不正です';
  end if;

  if jsonb_typeof(p_right_joints) <> 'array'
     or jsonb_typeof(p_left_joints) <> 'array' then
    raise exception '左右の解析結果は配列である必要があります';
  end if;

  if jsonb_array_length(p_right_joints) <> 15
     or jsonb_array_length(p_left_joints) <> 15 then
    raise exception '左右の解析結果は各15関節である必要があります';
  end if;

  -- 解析中の記録だけを完了に遷移させる。
  -- 同時実行された二重解析のうち、最初の1件だけが成功する。
  update public.screenings
  set status = 'completed',
      total_inflamed_joints = p_total_inflamed_joints
  where id = p_screening_id
    and status = 'analyzing'
  returning id into updated_screening_id;

  if updated_screening_id is null then
    raise exception '解析中ではないスクリーニングは確定できません';
  end if;

  select count(*)
  into calculated_total
  from (
    select joint from jsonb_array_elements(p_right_joints) as right_items(joint)
    union all
    select joint from jsonb_array_elements(p_left_joints) as left_items(joint)
  ) as all_joints
  where (joint->>'is_inflamed')::boolean;

  if calculated_total <> p_total_inflamed_joints then
    raise exception '解析結果の集計値と関節結果が一致しません';
  end if;

  -- 再解析時も同じscreeningの結果を置き換えるため、重複を残さない。
  delete from public.joint_results
  where screening_id = p_screening_id;

  insert into public.joint_results (
    screening_id,
    side,
    joint_name,
    is_inflamed,
    confidence_score
  )
  select
    p_screening_id,
    'right',
    joint->>'joint_name',
    (joint->>'is_inflamed')::boolean,
    (joint->>'confidence_score')::double precision
  from jsonb_array_elements(p_right_joints) as right_items(joint);

  insert into public.joint_results (
    screening_id,
    side,
    joint_name,
    is_inflamed,
    confidence_score
  )
  select
    p_screening_id,
    'left',
    joint->>'joint_name',
    (joint->>'is_inflamed')::boolean,
    (joint->>'confidence_score')::double precision
  from jsonb_array_elements(p_left_joints) as left_items(joint);
end;
$$;

revoke all on function public.complete_screening_analysis(uuid, integer, jsonb, jsonb) from public;
grant execute on function public.complete_screening_analysis(uuid, integer, jsonb, jsonb) to authenticated;

-- 7. ヘルパー関数
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.get_user_clinic_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select clinic_id from profiles
  where id = auth.uid() and is_active = true;
$$;

-- 8. RLS (Row Level Security) の設定
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.screenings enable row level security;
alter table public.joint_results enable row level security;

create policy "clinics: admin は全件, staff は自院を参照"
  on public.clinics for all
  using (public.is_admin() or id = public.get_user_clinic_id());

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

create policy "subjects: admin は全件, staff は自院データを操作"
  on public.subjects for all
  using (public.is_admin() or clinic_id = public.get_user_clinic_id())
  with check (public.is_admin() or clinic_id = public.get_user_clinic_id());

create policy "screenings_tenant_access"
  on public.screenings for all
  using (
    public.is_admin()
    or (created_by = auth.uid() and subject_id is null)
    or exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.clinic_id = public.get_user_clinic_id()
    )
  )
  with check (
    public.is_admin()
    or (created_by = auth.uid() and subject_id is null)
    or exists (
      select 1 from public.subjects s
      where s.id = subject_id and s.clinic_id = public.get_user_clinic_id()
    )
  );

create policy "joint_results_tenant_access"
  on public.joint_results for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.screenings s
      where s.id = screening_id and (
        (s.created_by = auth.uid() and s.subject_id is null)
        or exists (
          select 1 from public.subjects sub
          where sub.id = s.subject_id and sub.clinic_id = public.get_user_clinic_id()
        )
      )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.screenings s
      where s.id = screening_id and (
        (s.created_by = auth.uid() and s.subject_id is null)
        or exists (
          select 1 from public.subjects sub
          where sub.id = s.subject_id and sub.clinic_id = public.get_user_clinic_id()
        )
      )
    )
  );

-- 9. Storage バケット＆RLS
insert into storage.buckets (id, name, public)
values ('hand-images', 'hand-images', false)
on conflict (id) do nothing;

drop policy if exists "hand-images: 本人がアップロード" on storage.objects;
drop policy if exists "hand-images: 本人 or 医師が参照" on storage.objects;
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'hand-images';

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
    and public.is_admin()
  );
