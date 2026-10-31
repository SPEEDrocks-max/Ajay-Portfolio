-- Phase 2 auth hardening: the browser may verify its own admin membership,
-- but no frontend session may inspect other admins or edit the allowlist.
revoke insert, update, delete on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "Admins manage admin membership" on public.admin_users;
drop policy if exists "Users read own admin membership" on public.admin_users;

create policy "Users read own admin membership" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));
