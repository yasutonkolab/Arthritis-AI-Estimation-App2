-- RAスクリーニングAPIの手ごとの結果を保存し、解析完了を原子的に確定する。
begin;

alter table public.screenings
  add column if not exists ra_detected boolean,
  add column if not exists ai_hands jsonb;

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
      or (hand->>'num_positive_joints')::numeric
         > (hand->>'num_joints_detected')::numeric
      or jsonb_typeof(hand->'joints') <> 'array'
      or jsonb_typeof(hand->'warnings') <> 'array'
  ) then
    raise exception '手ごとの解析結果の内容が不正です';
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
end;
$$;

revoke all on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) from public;
revoke all on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) from authenticated;
grant execute on function public.complete_ra_screening_analysis(uuid, boolean, integer, jsonb) to service_role;

create or replace function public.begin_screening_reanalysis(
  p_screening_id uuid,
  p_changed_by uuid
)
returns table (id uuid, right_image_url text, left_image_url text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_is_active boolean;
begin
  select role, is_active into v_role, v_is_active
  from public.profiles where profiles.id = p_changed_by;
  if not found or not v_is_active or v_role <> 'admin' then
    raise exception '有効な本部管理者のみ再解析できます';
  end if;
  update public.screenings
  set status = 'analyzing',
      total_inflamed_joints = null,
      ra_detected = null,
      ai_hands = null,
      ai_model_version = null,
      analyzed_at = null,
      analysis_error_code = null,
      analysis_error_http_status = null,
      analysis_error_at = null
  where screenings.id = p_screening_id and screenings.status in ('completed', 'failed')
  returning screenings.id, screenings.right_image_url, screenings.left_image_url
    into id, right_image_url, left_image_url;
  if not found then
    raise exception '完了または失敗した記録のみ再解析できます';
  end if;
  delete from public.joint_results where screening_id = p_screening_id;
  return next;
end;
$$;

revoke all on function public.begin_screening_reanalysis(uuid, uuid) from public;
revoke all on function public.begin_screening_reanalysis(uuid, uuid) from authenticated;
grant execute on function public.begin_screening_reanalysis(uuid, uuid) to service_role;

commit;
