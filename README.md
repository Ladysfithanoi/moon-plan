# Chạy dần đến Trung Thu

Web-app sự kiện 47 ngày cho học viên PT — từ **10/08/2026** đến đêm rằm **25/09/2026**.

Mỗi người chơi là một chú thỏ chạy trên một vòng cung khép kín. Điểm xuất phát và
điểm đích trùng nhau; vầng trăng ở tâm tròn dần theo phần trăm hoàn thành.

---

## Bên trong có gì

**Trang người chơi**

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang giới thiệu — luật chơi, 6 chặng, phần thưởng, đếm ngược |
| `/vao` | Nhập mã cá nhân |
| `/chang-duong` | Vòng trăng, điểm, chuỗi ngày, vé cứu, nội dung + quiz hôm nay, danh sách ngày đã qua (lọc theo ngày/hạng mục, 10 ngày mỗi trang) |
| `/ngay/[1-47]` | Xem lại một ngày đã qua (không ghi điểm lại) |
| `/chung-ket` | 4 phần case study tuần chung kết |
| `/vinh-danh` | Bảng vinh danh mềm + tặng cà rốt |

**Trang điều hành của Trung**

| Đường dẫn | Nội dung |
|---|---|
| `/admin/vao` | Đăng nhập bằng `ADMIN_PASSWORD` |
| `/admin` | Số người tham gia, tỉ lệ hoàn thành, bốc bảng vinh danh mỗi tuần |
| `/admin/nguoi-choi` | Tạo mã, sửa tên/liên hệ, cấp thêm vé cứu, khoá mã |
| `/admin/bai-nop` | Đọc bài, duyệt, **nhận xét gửi học viên** + ghi chú riêng, chọn case study xuất sắc nhất |
| `/admin/noi-dung` | Sửa bài đọc, đề bài, câu hỏi quiz, **đặt giờ + link + mã điểm danh webinar** |
| `/admin/cai-dat` | Bậc thưởng cuối sự kiện, chủ đề 6 tuần, tên mảnh trăng, quà hộp bí ẩn, bảng điểm |

---

## Cài đặt

Cần Node 20 trở lên.

```bash
npm install
cp .env.example .env.local     # rồi điền giá trị thật
```

### 1. Dựng Supabase

1. Tạo project mới tại [supabase.com](https://supabase.com) (chọn region Singapore cho gần Việt Nam).
2. Vào **SQL Editor → New query**, dán toàn bộ `supabase/migrations/0001_init.sql`, bấm **Run**.
3. Vào **Project Settings → API**, chép hai giá trị vào `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> `service_role` bỏ qua mọi ràng buộc bảo mật của Supabase. Chỉ đặt nó ở biến môi
> trường phía server, không bao giờ thêm tiền tố `NEXT_PUBLIC_`.

### 2. Sinh khoá phiên và mật khẩu admin

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dán kết quả vào `SESSION_SECRET`. Đặt `ADMIN_PASSWORD` là mật khẩu Trung dùng để vào `/admin`.

### 3. Nạp nội dung 47 ngày

```bash
npm run seed
```

Script đọc `content/week-1.json` … `week-7.json` rồi ghi vào Supabase: 47 ngày,
54 câu hỏi quiz, và chọn ngẫu nhiên **Ngày Thỏ Ngọc** (giữ kín phía server).

Chạy lại `npm run seed` bất cứ lúc nào để cập nhật nội dung — mã điểm danh
webinar và Ngày Thỏ Ngọc đã chọn sẽ không bị đụng tới.

Lưu ý: `npm run seed` **xoá sạch câu hỏi rồi nạp lại** theo file. Nếu đã thêm
hoặc sửa câu hỏi trong `/admin/noi-dung` mà chỉ muốn cập nhật phần chữ (tiêu đề,
bài đọc, đề bài), chạy `npm run seed:noi-dung` — câu hỏi trong cơ sở dữ liệu
được giữ nguyên. Thêm `-- --ngay 6,13` để chỉ nạp đúng vài ngày:

```bash
npm run seed:noi-dung -- --ngay 6,13,20,27,34,41   # 6 ngày quiz tổng hợp tuần
```

### 4. Tạo mã cho học viên

```bash
npm run make-codes -- 50
```

In ra CSV gồm mã và tên hiển thị để gửi qua Messenger. Từng mã lẻ thì tạo trực
tiếp ở `/admin/nguoi-choi`.

### 5. Chạy thử

```bash
npm run dev
```

Mở http://localhost:3000

Muốn xem app ở một ngày bất kỳ trong sự kiện, đặt trong `.env.local`:

```
EVENT_DATE_OVERRIDE=2026-08-20
```

Nhớ **xoá dòng này trước khi lên production**.

---

## Đưa lên Vercel

```bash
npx vercel            # lần đầu, để liên kết project
npx vercel --prod
```

Hoặc đẩy repo lên GitHub rồi **Import Project** trong Vercel — cả hai cách đều được.

Trong **Vercel → Settings → Environment Variables**, thêm cho cả ba môi trường
(Production, Preview, Development):

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SESSION_SECRET` | chuỗi ngẫu nhiên đã sinh ở bước 2 |
| `ADMIN_PASSWORD` | mật khẩu trang admin |

Không cần thêm `EVENT_DATE_OVERRIDE` trên production.

App tính "hôm nay là ngày thứ mấy" theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), nên
Vercel chạy theo UTC vẫn hiển thị đúng ngày.

---

## Việc Trung cần làm khi vận hành

**Trước 10/08** — chạy seed, tạo mã, gửi mã cho học viên qua Messenger.

**Mỗi ngày** — không cần làm gì. Nội dung tự mở theo lịch.

**Mỗi Chủ Nhật (ngày webinar)** — vào `/admin/noi-dung`, mở ngày webinar hôm đó,
đặt **mã điểm danh** và link phòng họp. Cuối buổi đọc mã lên cho học viên nhập.
Chưa đặt mã thì không ai điểm danh được.

Giờ buổi học đã seed sẵn 20:00 mỗi Chủ Nhật (đêm hội 25/09 là 19:00). Cần dời
giờ thì sửa ô **Giờ vào phòng** ở cùng trang đó — người chơi được nhắc bằng một
dải báo trên đầu mọi trang, từ sáng hôm trước cho tới khi buổi tan.

Dải báo chỉ hiện trong app, không tự gửi ra Messenger hay email — nó lo phần
người hay quên, còn tin nhắn nhóm vẫn nên gửi như thường.

**Cuối mỗi tuần** — vào `/admin`, bấm **Bốc** cho tuần vừa xong để cập nhật bảng
vinh danh mềm.

**Tuần chung kết (21–25/09)** — vào `/admin/bai-nop` đọc bài, duyệt, và chọn một
bài là *case study xuất sắc nhất*. Nhận xét viết ở ô **"Nhận xét gửi học viên"**
sẽ hiện ở trang ngày đó của họ; ô **"Ghi chú riêng"** thì chỉ mình đọc.

---

## Luật chơi được cài đặt thế nào

Các con số dưới đây là **mặc định**. Đổi chúng ở `/admin/cai-dat` — lưu là có hiệu
lực ngay, không cần deploy lại. Mặc định nằm trong `src/lib/scoring.ts`, còn logic
ở `src/lib/game.ts`.

**Điểm**

| Loại ngày | Điểm |
|---|---|
| Kiến thức + quiz nhanh | 1đ có mặt + 1đ trả lời đúng |
| Thử thách áp dụng | 5đ khi nộp bài |
| Quiz tổng hợp tuần | 1đ + 3đ bonus nếu đúng ≥80% |
| Trạm dừng gốc đa (webinar) | 10đ + 1 mảnh trăng |
| Mỗi phần case study chung kết | 5đ |

Trả lời sai vẫn check-in được, chuỗi ngày vẫn giữ — chỉ mất phần điểm thưởng.
Tổng điểm tối đa nếu đi trọn vòng: **182đ** (chưa tính quà ngẫu nhiên).

**Vé cứu** — mỗi người 2 vé, tự kích hoạt khi lỡ ngày, không cần bấm gì. Nếu quãng
đứt dài hơn số vé còn lại thì không tiêu vé nào (tiêu một phần cũng không cứu được
chuỗi), chuỗi đứt và bắt đầu lại.

**Hộp quà bí ẩn** — 35% cơ hội sau khi nộp thử thách áp dụng, tối đa 1 lần mỗi tuần
mỗi người. Sửa tỉ lệ và danh sách quà ở `/admin/cai-dat`.

**Ngày Thỏ Ngọc** — 2 ngày bí mật chọn ngẫu nhiên lúc seed, cách nhau ít nhất 7
ngày, lưu ở bảng `secret_days`. Ai check-in trúng ngày đó được +15đ và một thông
báo bất ngờ.

**Bảng vinh danh mềm** — bốc ngẫu nhiên 10% người có check-in thật trong tuần.
Không có bảng xếp hạng cá nhân ở bất kỳ đâu.

**Mảnh trăng** — trao khi điểm danh webinar. Muốn siết lại thành "phải đủ 6 ngày
trong tuần mới được nhận", đổi `FRAGMENT_REQUIRES_FULL_WEEK = true` ở đầu
`src/lib/game.ts`.

---

## Vì sao bí mật không lộ được

Đây là ràng buộc quan trọng nhất trong brief, nên nó được cài ở tầng cơ sở dữ liệu
chứ không chỉ ở code:

- **Mọi bảng đều bật RLS và không có policy nào** cho `anon`. Trình duyệt không đọc
  được bảng nào, kể cả khi ai đó tìm ra URL Supabase.
- Toàn bộ truy cập đi qua server Next.js bằng `service_role` key — key này chỉ tồn
  tại trong biến môi trường phía server.
- `correct_index` (đáp án quiz), `webinar_code` (mã điểm danh) và bảng `secret_days`
  (Ngày Thỏ Ngọc) **không bao giờ** nằm trong props gửi xuống client. Hàm
  `getPublicQuestions()` cắt bỏ đáp án trước khi trả về.
- Đáp án chỉ được gửi xuống sau khi người chơi đã nộp bài của ngày đó.
- Ngày Thỏ Ngọc được chọn ngẫu nhiên trong script seed và không in ra màn hình —
  không ai cần biết, kể cả Trung.
- File đính kèm case study nằm trong bucket riêng tư; trang admin tạo link có hạn
  1 giờ mỗi lần xem.
- Bài nộp có **hai ô nhận xét tách rời**: `player_note` gửi cho học viên đọc, còn
  `admin_note` là ghi chú riêng của Trung và không bao giờ đi vào props client.
- Trang giới thiệu đặt `robots: noindex` để sự kiện không bị Google lập chỉ mục.

---

## Sửa gì ở đâu

| Muốn đổi | Vào đâu |
|---|---|
| Bài đọc, đề bài, câu hỏi quiz của một ngày | `/admin/noi-dung` → chọn ngày |
| Giờ vào phòng, mã điểm danh, link webinar | `/admin/noi-dung` → chọn ngày webinar |
| Bậc thưởng cuối sự kiện | `/admin/cai-dat` |
| Chủ đề 6 tuần, tên 6 mảnh trăng | `/admin/cai-dat` |
| Quà trong hộp quà bí ẩn | `/admin/cai-dat` |
| Bảng điểm, tỉ lệ trúng quà | `/admin/cai-dat` |
| Số ngày của sự kiện | không đổi được — xem ghi chú dưới |

Mỗi nhóm cài đặt có nút **khôi phục mặc định** riêng, nên lỡ tay vẫn quay lại được.

**Vì sao 47 ngày không đổi được:** đó là khoảng cách từ 10/08 tới đêm rằm 25/09.
Vòng cung khép kín, con thỏ và độ tròn của trăng đều tính theo đúng con số đó —
thêm hay bớt ngày thì vòng không khép đúng đêm trăng tròn nữa. Nội dung của từng
ngày thì sửa thoải mái.

Vài lưu ý khi đổi cài đặt giữa chừng:

- Đổi **bảng điểm** không tính lại điểm cũ. Người chơi giữ nguyên số điểm đã có,
  luật mới áp dụng từ lần check-in tiếp theo.
- Đổi **tên mảnh trăng** không làm mất mảnh ai đã thu, nhưng mảnh đã trao vẫn mang
  tên cũ. Nên đổi trước khi tuần đó diễn ra.
- Đổi **điểm Ngày Thỏ Ngọc** chỉ áp dụng cho ngày bí mật đặt sau này; hai ngày đã
  bốc lúc seed giữ nguyên số điểm của chúng.

## Sửa nội dung bài học

Hai cách, dùng cách nào cũng được:

**Trong app** — `/admin/noi-dung`, chọn ngày, sửa bài đọc và câu hỏi. Đổi có hiệu
lực ngay. Bài đọc nhận định dạng tối giản: dòng trống ngăn đoạn, `**chữ đậm**`.
Không nhận thẻ HTML (cố ý, để nội dung không chèn được mã vào trang).

**Trong file** — sửa `content/week-*.json` rồi `npm run seed` (hoặc
`npm run seed:noi-dung` nếu muốn giữ nguyên câu hỏi đang có trong cơ sở dữ liệu).
Cách này hợp khi cần sửa nhiều ngày cùng lúc, và giữ được lịch sử trong git.

Đừng viết số câu quiz vào bài đọc ("năm câu", "đúng từ 4 câu…") — thêm một câu là
dòng đó sai ngay. Số câu và ngưỡng nhận bonus được app tự tính từ số câu thật của
ngày cộng với bảng điểm trong `/admin/cai-dat`.

Cấu trúc một câu hỏi:

```json
{
  "prompt": "Câu hỏi",
  "options": ["A", "B", "C", "D"],
  "correct_index": 2,
  "explain": "Vì sao đáp án đó đúng — hiện ra sau khi người chơi trả lời."
}
```

`correct_index` đếm từ 0.

---

## Cấu trúc thư mục

```
content/          47 ngày nội dung, dạng JSON — nguồn cho script seed
scripts/          seed.mjs (nạp nội dung) · make-codes.mjs (tạo mã hàng loạt)
supabase/         migration SQL
src/lib/          event.ts (lịch) · scoring.ts (bảng điểm) · game.ts (luật chơi)
                  session.ts (cookie có chữ ký) · supabase.ts (kết nối server)
src/components/   MoonRing (vòng cung SVG) · DayCard · Countdown · RichText
src/app/          các trang
```

## Lệnh

```bash
npm run dev          # chạy máy mình
npm run build        # dựng bản production
npm run typecheck    # kiểm tra kiểu
npm run seed         # nạp nội dung 47 ngày (nạp lại cả câu hỏi)
npm run seed:noi-dung # chỉ nạp phần chữ, giữ nguyên câu hỏi trong DB
npm run make-codes -- 50
```
