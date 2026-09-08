-- ===================================================
-- Supabase マイグレーション用 SQL (v13: 被験者ID紐付けの訂正)
-- v12_admin_only_hand_image_read.sql の適用後に実行してください。
-- 既存データを削除せず、同一医療機関スタッフまたは本部管理者による
-- 被験者IDの訂正を追加します。
-- ===================================================

begin;

-- 未割り当て記録も、作成者と同じ医療機関のスタッフが訂正できるようにする。
drop policy if exists "screenings_tenant_access" on public.screenings;
create policy "screenings_tenant_access"
  on public.screenings for select
  using (
    public.is_active_user()
    and (
      public.is_admin()
      or (
        subject_id is null
        and exists (
          select 1 from public.profiles creator
          where creator.id = created_by
            and creator.clinic_id = public.get_user_clinic_id()
        )
      )
      or exists (
        select 1 from public.subjects s
        where s.id = subject_id and s.clinic_id = public.get_user_clinic_id()
      )
    )
  );

create or replace function public.correct_screening_subject(
  p_screening_id uuid,
  p_expected_subject_id text,
  p_new_subject_id text,
  p_changed_by uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_subject_id text;
  v_created_by uuid;
  v_old_clinic_id uuid;
  v_new_clinic_id uuid;
  v_clinic_id uuid;
  v_actor_role text;
  v_actor_clinic_id uuid;
  v_actor_is_active boolean;
begin
  select subject_id, created_by into v_current_subject_id, v_created_by
  from public.screenings where id = p_screening_id;
  if not found then raise exception 'スクリーニング記録が見つかりません'; end if;
  if v_current_subject_id is distinct from p_expected_subject_id then
    raise exception '被験者IDがすでに変更されています。画面を更新して確認してください';
  end if;
  if v_current_subject_id is not distinct from p_new_subject_id then
    raise exception '変更前後の被験者IDが同じです';
  end if;

  if v_current_subject_id is not null then
    select clinic_id into v_old_clinic_id from public.subjects where id = v_current_subject_id;
  elsif v_created_by is not null then
    select clinic_id into v_old_clinic_id from public.profiles where id = v_created_by;
  end if;

  if p_new_subject_id is not null then
    select clinic_id into v_new_clinic_id from public.subjects where id = p_new_subject_id;
    if not found then raise exception '変更先の被験者IDが見つかりません'; end if;
  end if;

  if v_old_clinic_id is not null and v_new_clinic_id is not null and v_old_clinic_id <> v_new_clinic_id then
    raise exception '別の医療機関の被験者IDへは変更できません';
  end if;
  v_clinic_id := coalesce(v_old_clinic_id, v_new_clinic_id);
  if v_clinic_id is null then raise exception '記録の医療機関を特定できないため変更できません'; end if;

  select role, clinic_id, is_active into v_actor_role, v_actor_clinic_id, v_actor_is_active
  from public.profiles where id = p_changed_by;
  if not found or not v_actor_is_active then raise exception '有効なユーザーのみ変更できます'; end if;
  if v_actor_role <> 'admin'
     and (v_actor_role <> 'clinic_staff' or v_actor_clinic_id is distinct from v_clinic_id) then
    raise exception 'この医療機関の記録を変更する権限がありません';
  end if;

  update public.screenings set subject_id = p_new_subject_id
  where id = p_screening_id and subject_id is not distinct from p_expected_subject_id;
  if not found then raise exception '被験者IDがすでに変更されています。画面を更新して確認してください'; end if;
end;
$$;

revoke all on function public.correct_screening_subject(uuid, text, text, uuid) from public;
revoke all on function public.correct_screening_subject(uuid, text, text, uuid) from authenticated;
grant execute on function public.correct_screening_subject(uuid, text, text, uuid) to service_role;

commit;
