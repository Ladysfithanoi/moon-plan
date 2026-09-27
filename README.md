# Chạy dần đến 20/10

Web-app sự kiện 20 ngày cho học viên PT — từ **01/10/2026** đến **20/10/2026**.
Chủ đề: chu kỳ kinh nguyệt, thuốc tránh thai và tập luyện ở khách hàng nữ.

Mỗi người chơi có một **cành hoa** mọc từ dưới lên, mỗi ngày học là một đốt, mỗi
đốt nở một bông. Bông to hay nhỏ tuỳ vào **chuỗi ngày** lúc học ngày đó — học đều
thì hoa hồng, học lẻ tẻ thì toàn nụ. Đến 20/10 các bông gom lại thành **bó hoa**,
buộc bằng những dải ruy băng nhận ở Trạm hoa Chủ Nhật.

> Mùa trước (Chạy dần đến Trung Thu, 47 ngày) nằm trong lịch sử git. Mùa này dùng
> lại toàn bộ bộ khung — đăng nhập bằng mã, admin, quiz, bài nộp, nhận xét — và
> thay phần luật chơi bằng cơ chế tích luỹ chuỗi.

---

## Luật của cây

Đây là phần khác biệt so với mùa trước. Mặc định nằm ở `src/lib/scoring.ts`, luật
chuỗi ở `src/lib/bloom.ts`; hệ số nhân, vườn chung và các mức thưởng đổi được ở
`/admin/cai-dat`.

**Bốn tầng hoa** — điểm của ngày học đúng hạn được nhân theo tầng:

| Chuỗi | Tầng | Hệ số | Mở khoá |
|---|---|---|---|
| 1–2 ngày | Nụ | ×1 | — |
| 3–6 ngày | Hé nở | ×1,5 | Mẹo thực hành ẩn của mỗi ngày (+3đ khi chạm mốc lần đầu) |
| 7–13 ngày | Nở rộ | ×2 | Bài đọc mở rộng của mỗi ngày (+7đ) |
| 14+ ngày | Hoa hồng | ×2,5 | Một buổi hỏi riêng 1-1 (+14đ) |

Nội dung mở khoá do server quyết định: chưa đủ tầng thì chỉ thấy khung "đang
khoá", phần chữ không rời máy chủ. Ngày nào học lúc đang đủ tầng thì nội dung của
ngày ấy giữ lại cho người đó luôn, kể cả khi sau này tụt tầng.

**Khi bỏ học:**

| Tình huống | Chuyện gì xảy ra |
|---|---|
| Bỏ 1 ngày | Còn **giọt sương** thì app tự tưới, chuỗi giữ nguyên. Hết giọt sương thì cây **khát nước**, tụt một tầng (vd chuỗi 9 → 3). |
| Bỏ 2 ngày liền | Hoa **héo**, chuỗi về 0. |
| Nghỉ từ 3 ngày | Cây **ngủ**; trang chính đổi sang màn hình chào quay lại. Học **3 ngày liền** là **hồi xuân**: lấy lại một nửa chuỗi cũ + 5đ. |
| Học bù | Ngày bỏ lỡ làm lại được tới hết ngày thứ hai sau đó (~48 giờ). Nhận điểm gốc, không nhân tầng — nhưng chuỗi được nối lại, và giọt sương đã dùng cho ngày đó được trả về. |
| Vắng Trạm hoa | Ngày trung tính: đến thì cây lớn thêm và nhận ruy băng, vắng thì cây giữ nguyên. Không điểm danh bù được. |

Mỗi người có **2 giọt sương**. Chuỗi không lưu cứng mà tính lại từ lịch sử mỗi lần
cần, nên học bù hay tặng thêm giọt sương đều tự làm đúng lại con số.

**Vườn chung** — ngày nào từ **60%** người đang hoạt động học đúng hạn thì ngày đó
"nắng": ai góp mặt được **+3đ**, và cứ **3 ngày nắng** thì **cả lớp** thêm một giọt
sương. Trang cành hoa hiện số người đã học hôm nay so với ngưỡng — chỗ để mọi
người nhắc nhau. Ngày được chốt sổ lúc có người mở app sau nửa đêm; học bù không
tính vào vườn chung.

**Điểm gốc** (trước khi nhân tầng):

| Loại ngày | Điểm |
|---|---|
| Kiến thức + quiz nhanh | 1đ có mặt + 1đ mỗi câu đúng |
| Thử thách áp dụng | 5đ khi nộp bài (+ cơ hội hộp quà bí ẩn) |
| Quiz tổng hợp tuần | 1đ + 3đ thưởng nếu đúng ≥80% |
| Trạm hoa Chủ Nhật | 10đ + 1 dải ruy băng |
| Case study về đích | 10đ |

Trả lời sai vẫn check-in được, cây vẫn lớn — chỉ mất phần điểm thưởng.

**Giữ lại từ mùa trước, đổi tên:** hộp quà bí ẩn · Bông hoa bí mật (thay Ngày Thỏ
Ngọc, 2 ngày bí mật +15đ) · tặng hoa (thay tặng cà rốt) · bảng vinh danh mềm.

---

## Lịch 20 ngày

| Tuần | Ngày | Chủ đề | Trạm hoa |
|---|---|---|---|
| 1 | 01–04/10 | Hiểu chu kỳ của khách hàng nữ | CN 04/10 · Ruy băng Thấu hiểu |
| 2 | 05–11/10 | Chu kỳ, thuốc tránh thai & hiệu suất tập | CN 11/10 · Ruy băng Đồng hành |
| 3 | 12–18/10 | Dinh dưỡng, thèm ăn & phòng chấn thương | CN 18/10 · Ruy băng Chăm sóc |
| Về đích | 19–20/10 | Case study (19/10) · Buộc bó hoa + buổi hội 20:00 (20/10) | — |

Nội dung lấy từ bài tổng quan của Greg Nuckols (Stronger By Science) về chu kỳ,
thuốc tránh thai và tập luyện; nằm trong `content/week-1.json` … `week-4.json`.

---

## Bên trong có gì

**Trang người chơi**

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang giới thiệu — bốn tầng hoa, luật bỏ học, lịch, phần thưởng, đếm ngược |
| `/dang-ky` | Tự đăng ký: tên hiển thị + SĐT + mã PIN 4 số (bật/tắt ở `/admin/cai-dat`) |
| `/vao` | Đăng nhập bằng SĐT + PIN; hoặc bằng mã cá nhân nếu được cấp mã |
| `/chang-duong` | Cành hoa, tầng + hệ số hôm nay, giọt sương, ruy băng, tình trạng cây (khát/héo/ngủ/hồi xuân) kèm link học bù, bài hôm nay, vườn chung, luật của cây, những ngày đã qua. Sau 20/10 cành hoa đổi thành bó hoa. |
| `/ngay/[1-20]` | Xem một ngày; học bù nếu còn trong 48 giờ |
| `/chung-ket` | Về đích — bó hoa, đề case study, phần thưởng |
| `/vinh-danh` | Bảng vinh danh mềm + tặng hoa |

**Trang điều hành**

| Đường dẫn | Nội dung |
|---|---|
| `/admin` | Số người tham gia, tỉ lệ hoàn thành, **tầng hoa của cả lớp**, lượt học bù, bốc bảng vinh danh mỗi tuần |
| `/admin/nguoi-choi` | Tạo mã, sửa tên/liên hệ/**SĐT**, **đặt lại PIN**, **cấp thêm giọt sương**, khoá mã; tìm theo SĐT; xem hành trình từng người theo trạng thái cây |
| `/admin/bai-nop` | Đọc bài, duyệt, nhận xét gửi học viên + ghi chú riêng, chọn case study xuất sắc nhất |
| `/admin/noi-dung` | Sửa bài đọc, **mẹo ẩn, đọc mở rộng**, đề bài, câu hỏi quiz, giờ + link + mã điểm danh Trạm hoa |
| `/admin/cai-dat` | **Mở/đóng tự đăng ký**, bậc thưởng, chủ đề tuần, tên ruy băng, quà hộp bí ẩn, bảng điểm, **hệ số tầng, vườn chung, thưởng hồi xuân** |

---

## Chuyển từ mùa Trung Thu sang

Hai cách. **Khuyến nghị: tạo một project Supabase mới** — dữ liệu Trung Thu còn
nguyên ở project cũ để xem lại khi cần.

### Cách 1 — project Supabase mới (khuyến nghị)

1. Tạo project mới tại [supabase.com](https://supabase.com) (region Singapore).
2. **SQL Editor → New query**, chạy lần lượt `0001_init.sql`, `0002_player_note.sql`,
   `0003_mua_20_10.sql`, `0004_dang_ky_sdt.sql` trong `supabase/migrations/`.
3. Đổi `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong `.env.local`
   và trên Vercel sang project mới.
4. `npm run seed`, rồi `npm run make-codes -- 50`.

### Cách 2 — dùng lại project cũ

1. Chạy `0003_mua_20_10.sql` và `0004_dang_ky_sdt.sql` trong SQL Editor.
2. Xem trước sẽ xoá những gì: `npm run mua-moi`
3. Xoá thật (người chơi, lịch sử, bài nộp, file đính kèm, nội dung ngày của mùa
   trước — **không hoàn tác được**): `npm run mua-moi -- --xac-nhan`
4. `npm run seed`, rồi `npm run make-codes -- 50`.

`npm run seed` tự dừng nếu thấy DB còn ngày 21–47 của mùa trước, để không nạp chồng
lên dữ liệu cũ. Cài đặt của mùa này lưu dưới tên khoá khác mùa trước, nên chỉnh
sửa cũ ở `/admin/cai-dat` không vô tình áp vào mùa mới.

Mã mới có dạng `HOA-XXXX`.

---

## Cài đặt từ đầu

Cần Node 20 trở lên.

```bash
npm install
cp .env.example .env.local     # rồi điền giá trị thật
```

Sinh khoá phiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dán kết quả vào `SESSION_SECRET`. Đặt `ADMIN_PASSWORD` là mật khẩu vào `/admin`.

> `service_role` bỏ qua mọi ràng buộc bảo mật của Supabase. Chỉ đặt nó ở biến môi
> trường phía server, không bao giờ thêm tiền tố `NEXT_PUBLIC_`.

Rồi làm theo **Cách 1** ở trên.

### Chạy thử

```bash
npm run dev
```

Muốn xem app ở một ngày bất kỳ trong sự kiện, đặt trong `.env.local`:

```
EVENT_DATE_OVERRIDE=2026-10-08
```

Nhớ **xoá dòng này trước khi lên production**. Lưu ý: mở trang cành hoa khi đang
đặt ngày giả sẽ chốt sổ vườn chung cho những ngày "đã qua" theo ngày giả đó — chỉ
thử trên project Supabase dùng để thử.

---

## Đưa lên Vercel

```bash
npx vercel --prod
```

Trong **Vercel → Settings → Environment Variables** (cả Production, Preview,
Development):

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SESSION_SECRET` | chuỗi ngẫu nhiên |
| `ADMIN_PASSWORD` | mật khẩu trang admin |

App tính "hôm nay là ngày thứ mấy" theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), nên
Vercel chạy theo UTC vẫn đúng ngày.

---

## Việc cần làm khi vận hành

**Trước 01/10** — chạy seed, rồi gửi link `/dang-ky` cho học viên (hoặc tạo mã tay
và gửi qua Messenger cho ai không muốn tự đăng ký). Đóng đăng ký lúc nào tuỳ ý ở
`/admin/cai-dat`.

**Ai quên PIN** — `/admin/nguoi-choi`, tìm theo SĐT, bấm sửa, điền 4 số vào ô
**Đặt lại PIN** rồi báo PIN mới cho học viên. Mã PIN chỉ lưu dạng băm, nên không ai
— kể cả admin — xem được PIN cũ.

**Mỗi ngày** — không cần làm gì. Nội dung tự mở, vườn chung tự chốt sổ.

**Mỗi Chủ Nhật (Trạm hoa)** — vào `/admin/noi-dung`, mở ngày Trạm hoa, đặt **mã
điểm danh** và link phòng họp. Cuối buổi đọc mã lên. Giờ đã seed sẵn 20:00; người
chơi được nhắc bằng dải báo trên đầu mọi trang từ sáng hôm trước.

**Cuối mỗi tuần** — vào `/admin`, bấm **Bốc** cho tuần vừa xong. Liếc qua bảng
**tầng hoa của cả lớp** và **cần nhắc một câu**: nhiều người dồn ở tầng Nụ là lúc
nên nhắn cả nhóm.

**Ai xin thêm giọt sương** (ốm, đi công tác…) — `/admin/nguoi-choi`, bấm sửa, tăng
ô **Giọt sương được cấp**. Chuỗi tự tính lại ở lần mở app kế tiếp.

**19–20/10** — `/admin/bai-nop` đọc case study, nhận xét, chọn bài xuất sắc nhất.

---

## Vì sao bí mật không lộ được

- **Mọi bảng đều bật RLS và không có policy nào** cho `anon`. Toàn bộ truy cập đi
  qua server Next.js bằng `service_role` key.
- `correct_index`, `webinar_code`, `bonus_tip` / `bonus_deep` (khi chưa đủ tầng) và
  bảng `secret_days` **không bao giờ** nằm trong props gửi xuống client.
- Đáp án chỉ gửi xuống sau khi người chơi đã nộp bài ngày đó.
- PIN băm bằng scrypt kèm salt riêng, không bao giờ lưu dạng thô và không đi xuống
  trình duyệt. Đăng nhập sai bị giới hạn theo địa chỉ và theo từng SĐT; câu báo lỗi
  không cho biết SĐT nào đã đăng ký.
- Ngày Bông hoa bí mật chọn ngẫu nhiên trong script seed, không in ra màn hình.
- File đính kèm nằm trong bucket riêng tư; admin xem bằng link có hạn 1 giờ.
- Bài nộp có hai ô nhận xét tách rời: `player_note` gửi học viên, `admin_note` chỉ
  người điều hành đọc.

---

## Sửa nội dung

**Trong app** — `/admin/noi-dung`, chọn ngày. Bài đọc nhận định dạng tối giản: dòng
trống ngăn đoạn, `**chữ đậm**`, không nhận HTML.

**Trong file** — sửa `content/week-*.json` rồi `npm run seed` (hoặc
`npm run seed:noi-dung` để giữ nguyên câu hỏi trong DB; thêm `-- --ngay 10,17` để
chỉ nạp vài ngày).

**Bằng Excel** — tải file ở `/admin/noi-dung`, sửa, nạp lại. File có thêm hai cột
*Mẹo ẩn (Hé nở)* và *Đọc mở rộng (Nở rộ)*. Đừng gửi file này cho học viên — nó có
mã điểm danh và nội dung mở khoá.

Một câu hỏi:

```json
{
  "prompt": "Câu hỏi",
  "options": ["A", "B", "C", "D"],
  "correct_index": 2,
  "explain": "Vì sao đáp án đó đúng — hiện ra sau khi người chơi trả lời."
}
```

`correct_index` đếm từ 0. Đừng viết số câu quiz vào bài đọc — ngưỡng thưởng được
tính từ số câu thật.

---

## Cấu trúc thư mục

```
content/          20 ngày nội dung, dạng JSON — nguồn cho script seed
scripts/          seed.mjs · make-codes.mjs · mua-moi.mjs (dọn mùa cũ)
supabase/         migration SQL (0003 là phần của mùa 20/10)
src/lib/          event.ts (lịch) · scoring.ts (bảng điểm, tầng) · bloom.ts (luật chuỗi)
                  game.ts (check-in, học bù, vườn chung) · settings.ts · session.ts
src/components/   FlowerStem (cành hoa) · Bouquet (bó hoa) · Flower · Garden · DayCard
src/app/          các trang
```

## Lệnh

```bash
npm run dev            # chạy máy mình
npm run build          # dựng bản production
npm run typecheck      # kiểm tra kiểu
npm run seed           # nạp nội dung 20 ngày (nạp lại cả câu hỏi)
npm run seed:noi-dung  # chỉ nạp phần chữ, giữ nguyên câu hỏi trong DB
npm run make-codes -- 50
npm run mua-moi        # xem/dọn dữ liệu mùa trước (thêm -- --xac-nhan để xoá)
```
