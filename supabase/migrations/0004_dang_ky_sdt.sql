-- ═══════════════════════════════════════════════════════════════════════════
-- Tự đăng ký bằng số điện thoại + mã PIN 4 số
-- Chạy SAU 0003. Chạy lại nhiều lần vẫn an toàn.
-- ═══════════════════════════════════════════════════════════════════════════

-- phone    — SĐT đã chuẩn hoá về dạng 0xxxxxxxxx, dùng để đăng nhập lại.
--            Người được admin tạo mã thì để trống, vẫn vào bằng mã như cũ.
-- pin_hash — PIN băm bằng scrypt kèm salt ("scrypt$<salt>$<hash>"). Không bao
--            giờ lưu PIN thô, không bao giờ gửi cột này xuống trình duyệt.
alter table players add column if not exists phone    text;
alter table players add column if not exists pin_hash text;

-- Mỗi SĐT chỉ một tài khoản. Chỉ số một phần để nhiều người không có SĐT
-- (tạo bằng mã) vẫn cùng tồn tại được.
create unique index if not exists players_phone_unique
  on players (phone) where phone is not null;
