-- ═══════════════════════════════════════════════════════════════════════════
-- Chạy dần đến Trung Thu — schema khởi tạo
-- Chạy file này trong Supabase Dashboard → SQL Editor → New query → Run
--
-- NGUYÊN TẮC BẢO MẬT:
--   Mọi bảng đều bật RLS và KHÔNG có policy nào cho anon/authenticated.
--   Nghĩa là: trình duyệt không đọc/ghi được gì trực tiếp.
--   Toàn bộ truy cập đi qua server Next.js bằng service_role key.
--   Nhờ vậy Ngày Thỏ Ngọc, đáp án quiz và mã điểm danh webinar không thể lộ.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Người chơi ─────────────────────────────────────────────────────────────
create table if not exists players (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,          -- mã cá nhân, vd THO-4K2M
  display_name    text not null,
  contact         text,                          -- Messenger/Zalo/SĐT để Trung liên hệ
  cohort          text not null default 'chung', -- để dành, hiện chỉ 1 nhóm
  points          integer not null default 0,
  streak          integer not null default 0,
  best_streak     integer not null default 0,
  freezes_left    integer not null default 2,
  freezes_used    integer not null default 0,
  is_active       boolean not null default true,
  joined_at       timestamptz not null default now(),
  last_seen_at    timestamptz
);

create index if not exists players_code_idx on players (upper(code));

-- ─── Lịch nội dung 47 ngày ──────────────────────────────────────────────────
-- day_type: kien_thuc | thu_thach | quiz_tuan | webinar | case_study | dem_hoi
create table if not exists days (
  day            integer primary key check (day between 1 and 47),
  date           date not null unique,
  weekday        text not null,
  week           integer not null check (week between 1 and 7),
  phase          text not null,                  -- Onboarding | Scaffolding | Endgame
  week_theme     text not null,
  day_type       text not null,
  title          text not null,
  body           text not null,                  -- bài đọc ngắn của ngày
  prompt         text,                           -- đề bài cho ngày thử thách / case study
  mechanic       text,
  webinar_at     timestamptz,                    -- giờ webinar
  webinar_link   text,
  webinar_code   text,                           -- mã điểm danh — KHÔNG bao giờ gửi xuống client
  updated_at     timestamptz not null default now()
);

-- ─── Câu hỏi quiz ───────────────────────────────────────────────────────────
create table if not exists questions (
  id             uuid primary key default gen_random_uuid(),
  day            integer not null references days(day) on delete cascade,
  ord            integer not null default 1,
  prompt         text not null,
  options        jsonb not null,                 -- ["A","B","C","D"]
  correct_index  integer not null,               -- KHÔNG bao giờ gửi xuống client
  explain        text,
  unique (day, ord)
);

-- ─── Mảnh trăng (badge tuần) ────────────────────────────────────────────────
create table if not exists fragments (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  week       integer not null check (week between 1 and 6),
  name       text not null,
  awarded_at timestamptz not null default now(),
  unique (player_id, week)
);

-- ─── Check-in hằng ngày ─────────────────────────────────────────────────────
create table if not exists checkins (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  day            integer not null references days(day) on delete cascade,
  correct_count  integer not null default 0,
  total_count    integer not null default 0,
  points_awarded integer not null default 0,
  by_freeze      boolean not null default false, -- ngày này được vé cứu bù vào
  created_at     timestamptz not null default now(),
  unique (player_id, day)
);

create index if not exists checkins_player_idx on checkins (player_id, day desc);

-- ─── Câu trả lời chi tiết (để Trung xem câu nào cả lớp hay sai) ─────────────
create table if not exists answers (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  question_id  uuid not null references questions(id) on delete cascade,
  day          integer not null,
  chosen_index integer not null,
  is_correct   boolean not null,
  created_at   timestamptz not null default now(),
  unique (player_id, question_id)
);

-- ─── Bài nộp: thử thách áp dụng & case study chung kết ──────────────────────
-- kind: thu_thach | case_study
-- status: pending | approved | needs_work
create table if not exists submissions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  day         integer not null references days(day) on delete cascade,
  kind        text not null,
  body        text not null default '',
  files       jsonb not null default '[]'::jsonb, -- [{path,name,size}]
  status      text not null default 'pending',
  admin_note  text,
  is_best     boolean not null default false,     -- case study xuất sắc nhất
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, day)
);

-- ─── Phần thưởng đã trao (hộp quà, thỏ ngọc, bonus...) ──────────────────────
-- kind: hop_qua | tho_ngoc | bonus_quiz | ca_rot
create table if not exists rewards (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  kind       text not null,
  week       integer,
  day        integer,
  title      text not null,
  detail     text,
  points     integer not null default 0,
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rewards_player_idx on rewards (player_id, created_at desc);

-- Mỗi người tối đa 1 hộp quà / tuần, tối đa 1 lần trúng Ngày Thỏ Ngọc / ngày
create unique index if not exists rewards_hopqua_unique
  on rewards (player_id, week) where kind = 'hop_qua';
create unique index if not exists rewards_thongoc_unique
  on rewards (player_id, day) where kind = 'tho_ngoc';

-- ─── BÍ MẬT PHÍA SERVER ─────────────────────────────────────────────────────
-- Ngày Thỏ Ngọc: chọn ngẫu nhiên lúc seed, không bao giờ đọc từ client.
create table if not exists secret_days (
  day        integer primary key references days(day) on delete cascade,
  kind       text not null default 'tho_ngoc',
  title      text not null,
  detail     text not null,
  points     integer not null default 15,
  created_at timestamptz not null default now()
);

-- ─── Bảng vinh danh mềm (random top 10% mỗi tuần) ───────────────────────────
create table if not exists honor_roll (
  id         uuid primary key default gen_random_uuid(),
  week       integer not null,
  player_id  uuid not null references players(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  unique (week, player_id)
);

-- ─── Tặng cà rốt ────────────────────────────────────────────────────────────
create table if not exists carrot_gifts (
  id             uuid primary key default gen_random_uuid(),
  from_player_id uuid not null references players(id) on delete cascade,
  to_player_id   uuid not null references players(id) on delete cascade,
  points         integer not null default 2,
  message        text,
  created_at     timestamptz not null default now(),
  check (from_player_id <> to_player_id)
);

-- Mỗi người chỉ tặng được 1 lần / người nhận
create unique index if not exists carrot_pair_unique
  on carrot_gifts (from_player_id, to_player_id);

-- ─── Cấu hình linh tinh ─────────────────────────────────────────────────────
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS: khoá toàn bộ. Không tạo policy nào => anon/authenticated không đọc được.
-- service_role bỏ qua RLS, nên server Next.js vẫn chạy bình thường.
-- ═══════════════════════════════════════════════════════════════════════════
alter table players       enable row level security;
alter table days          enable row level security;
alter table questions     enable row level security;
alter table fragments     enable row level security;
alter table checkins      enable row level security;
alter table answers       enable row level security;
alter table submissions   enable row level security;
alter table rewards       enable row level security;
alter table secret_days   enable row level security;
alter table honor_roll    enable row level security;
alter table carrot_gifts  enable row level security;
alter table settings      enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage: bucket riêng tư cho file đính kèm case study
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('case-study', 'case-study', false)
on conflict (id) do nothing;
-- Không thêm policy => chỉ service_role đọc/ghi được. Server tạo signed URL khi Trung cần xem.
