-- Friend-of-friend suggestions for the Social → Friends tab.
-- Security definer so we can walk accepted edges beyond the caller's own rows
-- (friendships RLS only allows a/b = self).

create or replace function public.suggested_friends(p_limit int default 12)
returns table (
  suggested_uid text,
  mutual_count int,
  sample_friend_uid text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me text := public.uid_text();
  lim int := greatest(1, least(coalesce(p_limit, 12), 30));
begin
  if me is null or me = '' then
    return;
  end if;

  return query
  with my_friends as (
    select case when f.a = me then f.b else f.a end as friend_uid
    from public.friendships f
    where f.status = 'accepted'
      and (f.a = me or f.b = me)
  ),
  already as (
    select friend_uid as uid from my_friends
    union
    select case when f.a = me then f.b else f.a end
    from public.friendships f
    where f.a = me or f.b = me
    union
    select me
    union
    select b.blocked from public.blocks b where b.blocker = me
    union
    select b.blocker from public.blocks b where b.blocked = me
  ),
  candidates as (
    select
      case when f.a = mf.friend_uid then f.b else f.a end as suggested_uid,
      mf.friend_uid as via_uid
    from my_friends mf
    join public.friendships f
      on f.status = 'accepted'
     and (f.a = mf.friend_uid or f.b = mf.friend_uid)
  )
  select
    c.suggested_uid,
    count(distinct c.via_uid)::int as mutual_count,
    (array_agg(c.via_uid order by c.via_uid))[1] as sample_friend_uid
  from candidates c
  where not exists (select 1 from already a where a.uid = c.suggested_uid)
  group by c.suggested_uid
  order by mutual_count desc, suggested_uid
  limit lim;
end;
$$;

grant execute on function public.suggested_friends(int) to authenticated;
grant execute on function public.suggested_friends(int) to service_role;
