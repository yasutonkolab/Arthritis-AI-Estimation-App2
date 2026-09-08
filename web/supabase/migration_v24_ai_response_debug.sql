-- 管理者向けに、AI APIが返した成功レスポンスをデバッグ用途で保存する。
begin;

create table if not exists public.screening_analysis_debug_responses (
  screening_id uuid primary key references public.screenings(id) on delete cascade,
  raw_response jsonb not null check (jsonb_typeof(raw_response) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.screening_analysis_debug_responses enable row level security;

grant select on table public.screening_analysis_debug_responses to authenticated, service_role;
grant insert, update, delete on table public.screening_analysis_debug_responses to service_role;

drop policy if exists "screening_analysis_debug_responses_admin_select"
  on public.screening_analysis_debug_responses;
create policy "screening_analysis_debug_responses_admin_select"
  on public.screening_analysis_debug_responses for select
  using (public.is_admin());

drop function if exists public.complete_ra_screening_analysis_with_metadata(
  uuid, boolean, integer, jsonb, text
);

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
  delete from public.screening_analysis_debug_responses where screening_id = p_screening_id;
  return next;
end;
$$;

create or replace function public.complete_ra_screening_analysis_with_metadata(
  p_screening_id uuid,
  p_ra_detected boolean,
  p_total_positive_joints integer,
  p_hands jsonb,
  p_ai_model_version text,
  p_raw_response jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.complete_ra_screening_analysis(
    p_screening_id, p_ra_detected, p_total_positive_joints, p_hands
  );

  update public.screenings
  set ai_model_version = nullif(trim(p_ai_model_version), '')
  where id = p_screening_id;

  insert into public.screening_analysis_debug_responses (
    screening_id, raw_response
  )
  values (p_screening_id, p_raw_response)
  on conflict (screening_id) do update
  set raw_response = excluded.raw_response,
      created_at = now();
end;
$$;

revoke all on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text, jsonb) from public;
revoke all on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text, jsonb) from authenticated;
grant execute on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text, jsonb) to service_role;

commit;
