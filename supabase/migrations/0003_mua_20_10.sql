-- ═══════════════════════════════════════════════════════════════════════════
-- Mùa "Chạy dần đến 20/10" — cây hoa, giọt sương, học bù, vườn chung
-- Chạy SAU 0001 và 0002. Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Nội dung mở khoá theo tầng hoa ─────────────────────────────────────────
-- bonus_tip  — mẹo thực hành ẩn, mở ở tầng Hé nở (chuỗi 3 ngày)
-- bonus_deep — bài đọc mở rộng, mở ở tầng Nở rộ (chuỗi 7 ngày)
-- Server chỉ gửi hai cột này xuống trình duyệt khi người chơi đã đủ tầng.
alter table days add column if not exists bonus_tip  text;
alter table days add column if not exists bonus_deep text;

-- ─── Học bù ─────────────────────────────────────────────────────────────────
-- Ngày bỏ lỡ làm lại được trong 48 giờ; lượt đó chỉ nhận điểm gốc.
alter table checkins add column if not exists late boolean not null default false;

-- ─── Giọt sương ─────────────────────────────────────────────────────────────
-- Tổng số giọt được cấp riêng cho từng người (chưa kể giọt từ vườn chung).
-- Số đã dùng không lưu mà tính lại từ lịch sử — học bù thì giọt được trả lại.
-- Cột freezes_used vẫn được ghi (= số giọt đang dùng) để trang admin đọc nhanh.
alter table players add column if not exists dews integer not null default 2;

-- ─── Vườn chung ─────────────────────────────────────────────────────────────
-- Mỗi ngày đã qua được chốt sổ một lần: bao nhiêu người học đúng hạn trên tổng
-- số người đang hoạt động, và ngày đó có "nắng" không.
create table if not exists garden_days (
  day          integer primary key references days(day) on delete cascade,
  participants integer not null default 0,
  active       integer not null default 0,
  sunny        boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table garden_days enable row level security;
revoke all on garden_days from anon, authenticated;

-- ─── Phần thưởng mới ────────────────────────────────────────────────────────
-- kind: hoa_bi_mat | tang_hoa | vuon_chung | hoi_xuan | moc_3 | moc_7 | moc_14
create unique index if not exists rewards_hoabimat_unique
  on rewards (player_id, day) where kind = 'hoa_bi_mat';
create unique index if not exists rewards_vuonchung_unique
  on rewards (player_id, day) where kind = 'vuon_chung';
create unique index if not exists rewards_hoixuan_unique
  on rewards (player_id, day) where kind = 'hoi_xuan';
create unique index if not exists rewards_moc_unique
  on rewards (player_id, kind) where kind in ('moc_3', 'moc_7', 'moc_14');

create index if not exists checkins_day_idx on checkins (day, late);
