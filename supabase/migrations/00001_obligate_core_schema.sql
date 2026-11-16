-- ============ OBLIGATE CORE SCHEMA ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  detective_name text not null unique,
  avatar_seed text not null default 'ink',
  is_admin boolean not null default false,
  email_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text not null,
  description text not null,
  chapter_count int not null default 3,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  setting text not null,
  premise text not null,
  difficulty text not null check (difficulty in ('Easy','Medium','Hard')),
  est_minutes int not null,
  kind text not null check (kind in ('daily','campaign','group')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  chapter_number int,
  group_only boolean not null default false,
  daily_order int,
  questions jsonb not null,
  status text not null default 'draft' check (status in ('draft','published')),
  validated_at timestamptz,
  validation_report jsonb,
  created_at timestamptz not null default now()
);

create table public.case_solutions (
  case_id uuid primary key references public.cases(id) on delete cascade,
  solution jsonb not null,
  deduction_chain jsonb not null,
  narrative text not null,
  epilogue text
);

create table public.case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  player text not null check (player in ('A','B')),
  code text not null,
  type text not null,
  title text not null,
  body text not null,
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  unique (case_id, code)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  plan text not null default 'free' check (plan in ('free','group')),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete set null,
  case_id uuid not null references public.cases(id) on delete cascade,
  mode text not null default 'private' check (mode in ('private','daily','matchmaking','campaign','group')),
  status text not null default 'lobby' check (status in ('lobby','active','finished','abandoned')),
  started_at timestamptz,
  finished_at timestamptz,
  paused_at timestamptz,
  paused_ms bigint not null default 0,
  attempts int not null default 0,
  hints_used int not null default 0,
  verdict jsonb,
  outcome text check (outcome in ('solved','failed')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  chapter_number int,
  group_id uuid references public.groups(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot text not null check (slot in ('A','B')),
  ready boolean not null default false,
  notes text not null default '',
  pinned text[] not null default '{}',
  suspicious text[] not null default '{}',
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.room_events (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('chat','share','system','verdict_proposal','verdict_confirm','verdict_reject','hint','call')),
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  from_code text not null,
  to_code text not null,
  created_at timestamptz not null default now(),
  unique (room_id, user_id, from_code, to_code)
);

create table public.case_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  player_a uuid not null references public.profiles(id) on delete cascade,
  player_b uuid not null references public.profiles(id) on delete cascade,
  solved boolean not null,
  duration_seconds int not null,
  attempts int not null,
  hints_used int not null default 0,
  verdict jsonb not null,
  mode text not null,
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.campaign_progress (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  pair_key text not null,
  player_a uuid not null references public.profiles(id) on delete cascade,
  player_b uuid not null references public.profiles(id) on delete cascade,
  chapters_completed int not null default 0,
  decisions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (campaign_id, pair_key)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('personal','group')),
  group_id uuid references public.groups(id) on delete cascade,
  plan text not null,
  status text not null check (status in ('active','past_due','canceled','incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============ INDEXES ============
create index cases_kind_status_idx on public.cases (kind, status, daily_order);
create index case_evidence_case_idx on public.case_evidence (case_id, player, sort_order);
create index rooms_host_idx on public.rooms (host_id, status);
create index rooms_guest_idx on public.rooms (guest_id, status);
create index room_events_room_idx on public.room_events (room_id, id);
create index case_results_case_idx on public.case_results (case_id, solved, duration_seconds);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index group_members_user_idx on public.group_members (user_id);

-- ============ HELPERS ============
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and (r.host_id = auth.uid() or r.guest_id = auth.uid())
  );
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

create or replace function public.has_group_plan(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups g where g.id = p_group_id and g.plan = 'group'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, detective_name, avatar_seed)
  values (
    new.id,
    'Detective ' || upper(substr(replace(new.id::text, '-', ''), 1, 5)),
    substr(md5(new.id::text), 1, 8)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.cases enable row level security;
alter table public.case_solutions enable row level security;
alter table public.case_evidence enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_events enable row level security;
alter table public.evidence_links enable row level security;
alter table public.case_results enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;

-- profiles
create policy profiles_select_all on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete_self on public.profiles for delete to authenticated using (id = auth.uid() or public.is_admin());

-- campaigns
create policy campaigns_select_all on public.campaigns for select to anon, authenticated using (true);
create policy campaigns_insert_admin on public.campaigns for insert to authenticated with check (public.is_admin());
create policy campaigns_update_admin on public.campaigns for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campaigns_delete_admin on public.campaigns for delete to authenticated using (public.is_admin());

-- cases
create policy cases_select_published on public.cases for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy cases_insert_admin on public.cases for insert to authenticated with check (public.is_admin());
create policy cases_update_admin on public.cases for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cases_delete_admin on public.cases for delete to authenticated using (public.is_admin());

-- case_solutions (admin only; players receive via SECURITY DEFINER RPC)
create policy case_solutions_select_admin on public.case_solutions for select to authenticated using (public.is_admin());
create policy case_solutions_insert_admin on public.case_solutions for insert to authenticated with check (public.is_admin());
create policy case_solutions_update_admin on public.case_solutions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy case_solutions_delete_admin on public.case_solutions for delete to authenticated using (public.is_admin());

-- case_evidence (admin only; players receive via SECURITY DEFINER RPC)
create policy case_evidence_select_admin on public.case_evidence for select to authenticated using (public.is_admin());
create policy case_evidence_insert_admin on public.case_evidence for insert to authenticated with check (public.is_admin());
create policy case_evidence_update_admin on public.case_evidence for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy case_evidence_delete_admin on public.case_evidence for delete to authenticated using (public.is_admin());

-- groups
create policy groups_select_member on public.groups for select to authenticated using (owner_id = auth.uid() or public.is_group_member(id) or public.is_admin());
create policy groups_insert_self on public.groups for insert to authenticated with check (owner_id = auth.uid());
create policy groups_update_owner on public.groups for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy groups_delete_owner on public.groups for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- group_members
create policy group_members_select on public.group_members for select to authenticated using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_admin());
create policy group_members_insert_admin on public.group_members for insert to authenticated with check (public.is_admin());
create policy group_members_update_admin on public.group_members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy group_members_delete on public.group_members for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- rooms
create policy rooms_select_member on public.rooms for select to authenticated using (host_id = auth.uid() or guest_id = auth.uid() or public.is_admin());
create policy rooms_insert_host on public.rooms for insert to authenticated with check (host_id = auth.uid());
create policy rooms_update_member on public.rooms for update to authenticated using (host_id = auth.uid() or guest_id = auth.uid() or public.is_admin()) with check (host_id = auth.uid() or guest_id = auth.uid() or public.is_admin());
create policy rooms_delete_host on public.rooms for delete to authenticated using (host_id = auth.uid() or public.is_admin());

-- room_players
create policy room_players_select on public.room_players for select to authenticated using (user_id = auth.uid() or public.is_room_member(room_id) or public.is_admin());
create policy room_players_insert_self on public.room_players for insert to authenticated with check (user_id = auth.uid());
create policy room_players_update_self on public.room_players for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy room_players_delete_self on public.room_players for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- room_events
create policy room_events_select on public.room_events for select to authenticated using (public.is_room_member(room_id) or public.is_admin());
create policy room_events_insert on public.room_events for insert to authenticated with check (public.is_room_member(room_id) and user_id = auth.uid());
create policy room_events_update_admin on public.room_events for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy room_events_delete_admin on public.room_events for delete to authenticated using (public.is_admin());

-- evidence_links
create policy evidence_links_select on public.evidence_links for select to authenticated using (public.is_room_member(room_id) or public.is_admin());
create policy evidence_links_insert on public.evidence_links for insert to authenticated with check (public.is_room_member(room_id) and user_id = auth.uid());
create policy evidence_links_update_self on public.evidence_links for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy evidence_links_delete_self on public.evidence_links for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- case_results (public leaderboard data)
create policy case_results_select_all on public.case_results for select to anon, authenticated using (true);
create policy case_results_insert_admin on public.case_results for insert to authenticated with check (public.is_admin());
create policy case_results_update_admin on public.case_results for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy case_results_delete_admin on public.case_results for delete to authenticated using (public.is_admin());

-- campaign_progress
create policy campaign_progress_select on public.campaign_progress for select to authenticated using (player_a = auth.uid() or player_b = auth.uid() or public.is_admin());
create policy campaign_progress_insert on public.campaign_progress for insert to authenticated with check (player_a = auth.uid() or player_b = auth.uid() or public.is_admin());
create policy campaign_progress_update on public.campaign_progress for update to authenticated using (player_a = auth.uid() or player_b = auth.uid() or public.is_admin()) with check (player_a = auth.uid() or player_b = auth.uid() or public.is_admin());
create policy campaign_progress_delete on public.campaign_progress for delete to authenticated using (player_a = auth.uid() or player_b = auth.uid() or public.is_admin());

-- subscriptions
create policy subscriptions_select_self on public.subscriptions for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy subscriptions_insert_admin on public.subscriptions for insert to authenticated with check (public.is_admin());
create policy subscriptions_update_admin on public.subscriptions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subscriptions_delete_admin on public.subscriptions for delete to authenticated using (public.is_admin());

-- matchmaking_queue
create policy matchmaking_select on public.matchmaking_queue for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy matchmaking_insert_self on public.matchmaking_queue for insert to authenticated with check (user_id = auth.uid());
create policy matchmaking_update_self on public.matchmaking_queue for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy matchmaking_delete_self on public.matchmaking_queue for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- reports
create policy reports_insert_self on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_update_admin on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reports_delete_admin on public.reports for delete to authenticated using (public.is_admin());

-- blocks
create policy blocks_select_self on public.blocks for select to authenticated using (blocker_id = auth.uid() or public.is_admin());
create policy blocks_insert_self on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_update_self on public.blocks for update to authenticated using (blocker_id = auth.uid() or public.is_admin()) with check (blocker_id = auth.uid() or public.is_admin());
create policy blocks_delete_self on public.blocks for delete to authenticated using (blocker_id = auth.uid() or public.is_admin());

-- notifications
create policy notifications_select_self on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy notifications_insert_admin on public.notifications for insert to authenticated with check (public.is_admin());
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy notifications_delete_self on public.notifications for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- contact_messages
create policy contact_insert_any on public.contact_messages for insert to anon, authenticated with check (true);
create policy contact_select_admin on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_update_admin on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy contact_delete_admin on public.contact_messages for delete to authenticated using (public.is_admin());

-- ============ REALTIME ============
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.room_events;
alter publication supabase_realtime add table public.evidence_links;
alter publication supabase_realtime add table public.matchmaking_queue;
alter publication supabase_realtime add table public.notifications;
