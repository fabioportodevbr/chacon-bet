-- CHACON BET — Schema Supabase
-- Copa do Mundo 2026

-- Membros da família
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  used boolean default false,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Configurações globais do bolão
create table settings (
  id int primary key default 1 check (id = 1), -- singleton
  pix_key text not null default '',
  pix_name text not null default 'CHACON BET',
  pix_city text not null default 'SAO PAULO',
  bet_value numeric(10,2) not null default 10.00,
  prize_percent numeric(5,2) not null default 100.00, -- % do total que vira prêmio
  updated_at timestamptz default now()
);

insert into settings (id) values (1) on conflict do nothing;

-- Jogos da copa
create table games (
  id uuid primary key default gen_random_uuid(),
  phase text not null, -- 'group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'
  group_name text, -- 'A', 'B', ... null para fases eliminatórias
  game_number int, -- número sequencial do jogo
  home_team text not null,
  away_team text not null,
  home_flag text, -- emoji ou código de país
  away_flag text,
  game_date timestamptz,
  venue text,
  home_score int, -- null até ser jogado
  away_score int,
  status text not null default 'scheduled', -- 'scheduled', 'live', 'finished', 'cancelled'
  created_at timestamptz default now()
);

-- Palpites dos membros
create table predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  home_score int not null,
  away_score int not null,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, game_id) -- um palpite por jogo por membro
);

-- Perfis dos usuários (espelha auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Trigger: ao criar usuário, criar perfil
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Membro'),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table members enable row level security;
alter table settings enable row level security;
alter table games enable row level security;
alter table predictions enable row level security;
alter table profiles enable row level security;

-- Policies: games e settings são públicos para leitura
create policy "games_read" on games for select using (true);
create policy "settings_read" on settings for select using (true);

-- Profiles: usuário lê o próprio perfil; admin lê todos
create policy "profiles_read_own" on profiles for select
  using (auth.uid() = id);

create policy "profiles_read_admin" on profiles for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);

-- Predictions: usuário lê e cria os próprios; admin lê todos
create policy "predictions_read_own" on predictions for select
  using (auth.uid() = user_id);

create policy "predictions_read_admin" on predictions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

create policy "predictions_insert_own" on predictions for insert
  with check (auth.uid() = user_id);

create policy "predictions_update_own" on predictions for update
  using (auth.uid() = user_id);

-- Members: apenas admin gerencia; qualquer um lê para validar convite
create policy "members_read_all" on members for select using (true);

create policy "members_admin" on members for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Settings: apenas admin edita
create policy "settings_admin" on settings for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Games: apenas admin edita
create policy "games_admin" on games for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
