-- Só perfis ativos entram; viewer lê; referee altera jogos; admin gere tudo.
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
create or replace function public.current_app_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and active=true $$;
create policy "own profile" on public.profiles for select to authenticated using(id=auth.uid() and active=true);
create policy "authorized read groups" on public.groups for select to authenticated using(public.current_app_role() is not null);
create policy "authorized read players" on public.players for select to authenticated using(public.current_app_role() is not null);
create policy "authorized read matches" on public.matches for select to authenticated using(public.current_app_role() is not null);
create policy "admin groups" on public.groups for all to authenticated using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
create policy "admin players" on public.players for all to authenticated using(public.current_app_role()='admin') with check(public.current_app_role()='admin');
create policy "referee matches" on public.matches for insert to authenticated with check(public.current_app_role() in ('admin','referee'));
create policy "referee update matches" on public.matches for update to authenticated using(public.current_app_role() in ('admin','referee')) with check(public.current_app_role() in ('admin','referee'));
create policy "admin delete matches" on public.matches for delete to authenticated using(public.current_app_role()='admin');
