-- ===================================================
-- Supabase マイグレーション用 SQL (v10: 解析結果の直接改ざん防止)
-- v9_api_role_grants.sql の適用後に実行してください。
-- 既存データを削除せず、authenticated のscreenings / joint_results
-- 直接書き込みを止めます。書き込みは認可済みServer Actionの
-- Service Role処理に限定します。
-- ===================================================

begin;

-- Data APIでは診断結果・状態を直接変更させない。
revoke insert, update, delete on table public.screenings from authenticated;
revoke insert, update, delete on table public.joint_results from authenticated;
grant select on table public.screenings, public.joint_results to authenticated;

-- RLSも読取り専用にし、誤った権限再付与があっても書込みを許可しない。
drop policy if exists "screenings_tenant_access" on public.screenings;
create policy "screenings_tenant_access"
  on public.screenings for select
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
  );

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

-- Server Actionが検証済みAI応答をService Roleで確定する以外は、
-- この関数を実行できないようにする。
revoke all on function public.complete_screening_analysis(uuid, integer, jsonb, jsonb) from public;
revoke all on function public.complete_screening_analysis(uuid, integer, jsonb, jsonb) from authenticated;
grant execute on function public.complete_screening_analysis(uuid, integer, jsonb, jsonb) to service_role;

-- アプリ側の検証に加え、DBでも各関節の形式と完全性を保証する。
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
     or jsonb_typeof(p_left_joints) <> 'array'
     or jsonb_array_length(p_right_joints) <> 15
     or jsonb_array_length(p_left_joints) <> 15 then
    raise exception '左右の解析結果は各15関節の配列である必要があります';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_right_joints) as items(joint)
    where jsonb_typeof(joint) <> 'object'
      or jsonb_typeof(joint->'joint_name') <> 'string'
      or joint->>'joint_name' not in (
        'thumbIP', 'thumbMCP', 'idxDIP', 'idxPIP', 'idxMCP',
        'midDIP', 'midPIP', 'midMCP', 'ringDIP', 'ringPIP', 'ringMCP',
        'pinkyDIP', 'pinkyPIP', 'pinkyMCP', 'wrist'
      )
      or jsonb_typeof(joint->'is_inflamed') <> 'boolean'
      or jsonb_typeof(joint->'confidence_score') <> 'number'
      or (joint->>'confidence_score')::double precision not between 0 and 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_left_joints) as items(joint)
    where jsonb_typeof(joint) <> 'object'
      or jsonb_typeof(joint->'joint_name') <> 'string'
      or joint->>'joint_name' not in (
        'thumbIP', 'thumbMCP', 'idxDIP', 'idxPIP', 'idxMCP',
        'midDIP', 'midPIP', 'midMCP', 'ringDIP', 'ringPIP', 'ringMCP',
        'pinkyDIP', 'pinkyPIP', 'pinkyMCP', 'wrist'
      )
      or jsonb_typeof(joint->'is_inflamed') <> 'boolean'
      or jsonb_typeof(joint->'confidence_score') <> 'number'
      or (joint->>'confidence_score')::double precision not between 0 and 1
  ) then
    raise exception '関節解析結果の内容が不正です';
  end if;

  if (
    select count(distinct joint->>'joint_name')
    from jsonb_array_elements(p_right_joints) as items(joint)
  ) <> 15 or (
    select count(distinct joint->>'joint_name')
    from jsonb_array_elements(p_left_joints) as items(joint)
  ) <> 15 then
    raise exception '左右の関節名は各一意である必要があります';
  end if;

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

  delete from public.joint_results where screening_id = p_screening_id;

  insert into public.joint_results (
    screening_id, side, joint_name, is_inflamed, confidence_score
  )
  select
    p_screening_id,
    'right',
    joint->>'joint_name',
    (joint->>'is_inflamed')::boolean,
    (joint->>'confidence_score')::double precision
  from jsonb_array_elements(p_right_joints) as right_items(joint);

  insert into public.joint_results (
    screening_id, side, joint_name, is_inflamed, confidence_score
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

commit;
