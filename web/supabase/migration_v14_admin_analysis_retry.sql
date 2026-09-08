-- 本部管理者が既存の解析結果を消去して再解析を開始するための原子的な遷移。
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
  select role, is_active
    into v_role, v_is_active
  from public.profiles
  where profiles.id = p_changed_by;

  if not found or not v_is_active or v_role <> 'admin' then
    raise exception '有効な本部管理者のみ再解析できます';
  end if;

  update public.screenings
  set status = 'analyzing',
      total_inflamed_joints = null
  where screenings.id = p_screening_id
    and screenings.status in ('completed', 'failed')
  returning screenings.id, screenings.right_image_url, screenings.left_image_url
    into id, right_image_url, left_image_url;

  if not found then
    raise exception '完了または失敗した記録のみ再解析できます';
  end if;

  delete from public.joint_results
  where screening_id = p_screening_id;

  return next;
end;
$$;

revoke all on function public.begin_screening_reanalysis(uuid, uuid) from public;
revoke all on function public.begin_screening_reanalysis(uuid, uuid) from authenticated;
grant execute on function public.begin_screening_reanalysis(uuid, uuid) to service_role;
