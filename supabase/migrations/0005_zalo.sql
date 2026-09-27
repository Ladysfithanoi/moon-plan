-- ═══════════════════════════════════════════════════════════════════════════
-- Ghi nhận ai đã bấm vào nhóm Zalo của lớp
-- Chạy SAU 0004. Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════

-- Chỉ biết người chơi đã BẤM link mời, không biết họ có thật sự vào nhóm hay
-- chưa — Zalo không cho kiểm tra điều đó. Đủ để biết nên nhắc ai.
--
-- Bảng riêng thay vì thêm cột vào players: app vẫn chạy bình thường nếu chưa
-- chạy file này (chỉ là chưa có dữ liệu ai đã bấm).
create table if not exists zalo_clicks (
  player_id  uuid primary key references players(id) on delete cascade,
  clicked_at timestamptz not null default now()
);
alter table zalo_clicks enable row level security;
revoke all on zalo_clicks from anon, authenticated;
