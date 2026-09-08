-- RA APIが返すモデルバージョンを、解析結果と同じトランザクションで保存する。
begin;

create or replace function public.complete_ra_screening_analysis_with_metadata(
  p_screening_id uuid,
  p_ra_detected boolean,
  p_total_positive_joints integer,
  p_hands jsonb,
  p_ai_model_version text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.complete_ra_screening_analysis(
    p_screening_id,
    p_ra_detected,
    p_total_positive_joints,
    p_hands
  );

  update public.screenings
  set ai_model_version = nullif(trim(p_ai_model_version), '')
  where id = p_screening_id;
end;
$$;

revoke all on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text) from public;
revoke all on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text) from authenticated;
grant execute on function public.complete_ra_screening_analysis_with_metadata(uuid, boolean, integer, jsonb, text) to service_role;

commit;
