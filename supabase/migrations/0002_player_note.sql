-- ═══════════════════════════════════════════════════════════════════════════
-- Tách nhận xét bài nộp làm hai loại
-- ═══════════════════════════════════════════════════════════════════════════
-- admin_note  — ghi chú riêng của Trung, người chơi không bao giờ thấy.
-- player_note — nhận xét gửi cho học viên, hiện ở trang ngày của họ.
--
-- Tách ra thay vì mở admin_note cho người chơi đọc, để chỗ ghi nhắc việc cho
-- bản thân ("nhắc bạn này nộp lại") không vô tình bị đẩy ra ngoài.

alter table submissions add column if not exists player_note text;
