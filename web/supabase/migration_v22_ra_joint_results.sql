-- RA APIの詳細関節結果を既存の手の図へ対応付け、保存済み結果も補完する。
begin;

create or replace function public.ra_api_joint_name(p_api_joint_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_api_joint_name
    when 'MCP1' then 'thumbMCP'
    when 'MCP2' then 'idxMCP'
    when 'MCP3' then 'midMCP'
    when 'MCP4' then 'ringMCP'
    when 'MCP5' then 'pinkyMCP'
    when 'PIP2' then 'idxPIP'
    when 'PIP3' then 'midPIP'
    when 'PIP4' then 'ringPIP'
    when 'PIP5' then 'pinkyPIP'
    when 'IP1 (thumb)' then 'thumbIP'
    when 'Wrist' then 'wrist'
    else null
  end;
$$;

revoke all on function public.ra_api_joint_name(text) from public;
revoke all on function public.ra_api_joint_name(text) from authenticated;
grant execute on function public.ra_api_joint_name(text) to service_role;

create or replace function public.complete_ra_screening_analysis(
  p_screening_id uuid,
  p_ra_detected boolean,
  p_total_positive_joints integer,
  p_hands jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_screening_id uuid;
  calculated_total integer;
  calculated_ra_detected boolean;
begin
  if p_ra_detected is null
     or p_total_positive_joints is null
     or p_total_positive_joints < 0 then
    raise exception 'RAスクリーニングの集計値が不正です';
  end if;

  if p_hands is null
     or jsonb_typeof(p_hands) <> 'array'
     or jsonb_array_length(p_hands) not between 1 and 2 then
    raise exception '手ごとの解析結果は1〜2件の配列である必要があります';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_hands) as items(hand)
    where jsonb_typeof(hand) <> 'object'
      or hand->>'side' not in ('left', 'right')
      or jsonb_typeof(hand->'ra_detected') <> 'boolean'
      or jsonb_typeof(hand->'hand_probability') <> 'number'
      or (hand->>'hand_probability')::numeric not between 0 and 1
      or jsonb_typeof(hand->'num_positive_joints') <> 'number'
      or hand->>'num_positive_joints' !~ '^[0-9]+$'
      or jsonb_typeof(hand->'num_joints_detected') <> 'number'
      or hand->>'num_joints_detected' !~ '^[0-9]+$'
      or (hand->>'num_positive_joints')::numeric > (hand->>'num_joints_detected')::numeric
      or jsonb_typeof(hand->'joints') <> 'array'
      or jsonb_typeof(hand->'warnings') <> 'array'
  ) then
    raise exception '手ごとの解析結果の内容が不正です';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_hands) as items(hand)
    where jsonb_array_length(hand->'joints') > 0
      and (
        jsonb_array_length(hand->'joints') <> (hand->>'num_joints_detected')::integer
        or (
          select count(*)
          from jsonb_array_elements(hand->'joints') as joint_items(joint)
          where (joint->>'positive')::boolean
        ) <> (hand->>'num_positive_joints')::integer
        or (
          select count(distinct joint->>'joint_name')
          from jsonb_array_elements(hand->'joints') as joint_items(joint)
        ) <> jsonb_array_length(hand->'joints')
        or exists (
          select 1
          from jsonb_array_elements(hand->'joints') as joint_items(joint)
          where jsonb_typeof(joint) <> 'object'
            or public.ra_api_joint_name(joint->>'joint_name') is null
            or jsonb_typeof(joint->'probability') <> 'number'
            or (joint->>'probability')::numeric not between 0 and 1
            or jsonb_typeof(joint->'positive') <> 'boolean'
        )
      )
  ) then
    raise exception '関節別解析結果の内容または集計値が不正です';
  end if;

  if (
    select count(distinct hand->>'side')
    from jsonb_array_elements(p_hands) as items(hand)
  ) <> jsonb_array_length(p_hands) then
    raise exception '手ごとの解析結果でsideが重複しています';
  end if;

  select
    sum((hand->>'num_positive_joints')::integer),
    bool_or((hand->>'ra_detected')::boolean)
  into calculated_total, calculated_ra_detected
  from jsonb_array_elements(p_hands) as items(hand);

  if calculated_total <> p_total_positive_joints
     or calculated_ra_detected <> p_ra_detected then
    raise exception 'RAスクリーニングの集計値と手ごとの結果が一致しません';
  end if;

  update public.screenings
  set status = 'completed',
      total_inflamed_joints = p_total_positive_joints,
      ra_detected = p_ra_detected,
      ai_hands = p_hands,
      ai_model_version = null,
      analyzed_at = now(),
      analysis_error_code = null,
      analysis_error_http_status = null,
      analysis_error_at = null
  where id = p_screening_id and status = 'analyzing'
  returning id into updated_screening_id;

  if updated_screening_id is null then
    raise exception '解析中ではないスクリーニングは確定できません';
  end if;

  delete from public.joint_results where screening_id = p_screening_id;

  insert into public.joint_results (
    screening_id, side, joint_name, is_inflamed, confidence_score
  )
  select
    p_screening_id,
    hand->>'side',
    public.ra_api_joint_name(joint->>'joint_name'),
    (joint->>'positive')::boolean,
    (joint->>'probability')::double precision
  from jsonb_array_elements(p_hands) as hand_items(hand)
  cross join lateral jsonb_array_elements(hand->'joints') as joint_items(joint);
end;
$$;

revoke all on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) from public;
revoke all on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) from authenticated;
grant execute on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) to service_role;

delete from public.joint_results as existing
using public.screenings as screening
where existing.screening_id = screening.id
  and exists (
    select 1
    from jsonb_array_elements(coalesce(screening.ai_hands, '[]'::jsonb)) as hand_items(hand)
    where jsonb_typeof(hand->'joints') = 'array'
      and jsonb_array_length(hand->'joints') > 0
  );

insert into public.joint_results (
  screening_id, side, joint_name, is_inflamed, confidence_score
)
select
  screening.id,
  hand->>'side',
  public.ra_api_joint_name(joint->>'joint_name'),
  (joint->>'positive')::boolean,
  (joint->>'probability')::double precision
from public.screenings as screening
cross join lateral jsonb_array_elements(coalesce(screening.ai_hands, '[]'::jsonb)) as hand_items(hand)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(hand->'joints') = 'array' then hand->'joints' else '[]'::jsonb end
) as joint_items(joint)
where screening.status = 'completed'
  and public.ra_api_joint_name(joint->>'joint_name') is not null
  and jsonb_typeof(joint->'probability') = 'number'
  and jsonb_typeof(joint->'positive') = 'boolean'
on conflict (screening_id, side, joint_name) do update
set is_inflamed = excluded.is_inflamed,
    confidence_score = excluded.confidence_score;

commit;
