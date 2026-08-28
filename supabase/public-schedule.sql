-- A landing page apresentada antes do login precisa apenas de leitura pública.
-- Não concede INSERT, UPDATE ou DELETE a utilizadores anónimos.

alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "Public can read groups for landing" on public.groups;
create policy "Public can read groups for landing"
on public.groups
for select
to anon
using (true);

drop policy if exists "Public can read active players for landing" on public.players;
create policy "Public can read active players for landing"
on public.players
for select
to anon
using (active = true);

drop policy if exists "Public can read scheduled matches for landing" on public.matches;
create policy "Public can read scheduled matches for landing"
on public.matches
for select
to anon
using (
  scheduled_at is not null
);
