-- AI解析を確定したモデルバージョンと時刻を保存する。
alter table public.screenings
  add column if not exists ai_model_version text,
  add column if not exists analyzed_at timestamptz;

-- 関節結果の確定と解析メタデータの更新を同一トランザクションで行う。
create or replace function public.complete_screening_analysis_with_metadata(
  p_screening_id uuid,
  p_total_inflamed_joints integer,
  p_right_joints jsonb,
  p_left_joints jsonb,
  p_ai_model_version text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.complete_screening_analysis(
    p_screening_id,
    p_total_inflamed_joints,
    p_right_joints,
    p_left_joints
  );

  update public.screenings
  set ai_model_version = nullif(trim(p_ai_model_version), ''),
      analyzed_at = now()
  where id = p_screening_id;
end;
$$;

-- 再解析を開始した時点で、旧結果に付随するメタデータも消去する。
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
      ai_model_version = null,
      analyzed_at = null
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

revoke all on function public.complete_screening_analysis_with_metadata(uuid, integer, jsonb, jsonb, text) from public;
revoke all on function public.complete_screening_analysis_with_metadata(uuid, integer, jsonb, jsonb, text) from authenticated;
grant execute on function public.complete_screening_analysis_with_metadata(uuid, integer, jsonb, jsonb, text) to service_role;
