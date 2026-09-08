-- uploading / analyzing のまま滞留した記録を検出するため、状態遷移時刻を保持する。
alter table public.screenings
  add column if not exists status_updated_at timestamptz not null default now();

create or replace function public.touch_screening_status_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists screenings_touch_status_updated_at on public.screenings;
create trigger screenings_touch_status_updated_at
  before update of status on public.screenings
  for each row execute function public.touch_screening_status_updated_at();
