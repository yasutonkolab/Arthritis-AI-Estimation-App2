-- ===================================================
-- Supabase マイグレーション用 SQL (v6: 解析結果の原子確定)
-- v5_joint_result_sides.sql の適用後に実行してください。
-- ===================================================

begin;

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

commit;
