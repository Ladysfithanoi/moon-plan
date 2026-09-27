/**
 * Mốc thời gian của sự kiện. Mọi phép tính "hôm nay là ngày thứ mấy" đều quy về
 * giờ Việt Nam, vì server Vercel chạy theo UTC — nếu không quy đổi thì từ 0h đến
 * 7h sáng giờ VN người chơi sẽ thấy nội dung của hôm qua.
 */

export const EVENT_START = '2026-10-01'; // ngày khởi động
export const EVENT_END = '2026-10-20'; // ngày Phụ nữ Việt Nam
export const TOTAL_DAYS = 20;
export const TZ = 'Asia/Ho_Chi_Minh';

/** Giờ bắt đầu buổi hội 20/10, dùng cho đếm ngược. */
export const FESTIVAL_AT = '2026-10-20T20:00:00+07:00';
/** Giờ khởi động ngày 1, dùng cho đếm ngược ở trang giới thiệu. */
export const KICKOFF_AT = '2026-10-01T08:00:00+07:00';

/**
 * Khung tuần. Sự kiện mở vào Thứ Năm nên tuần đầu chỉ có 4 ngày; tuần cuối là
 * hai ngày về đích (Thứ Hai case study, Thứ Ba 20/10). Ba tuần đầu khép lại
 * bằng buổi Trạm hoa Chủ Nhật.
 */
export const WEEKS = [
  { week: 1, first: 1, last: 4 },
  { week: 2, first: 5, last: 11 },
  { week: 3, first: 12, last: 18 },
  { week: 4, first: 19, last: 20 },
] as const;

/** Số tuần có Trạm hoa — mỗi buổi trao một dải ruy băng. */
export const RIBBON_WEEKS = 3;

/** Tuần thứ mấy của ngày thứ n. */
export function weekForDay(n: number): number {
  return WEEKS.find((w) => n >= w.first && n <= w.last)?.week ?? WEEKS[WEEKS.length - 1].week;
}

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày hôm nay theo giờ VN, dạng YYYY-MM-DD. */
export function vnToday(now: Date = new Date()): string {
  const override = process.env.EVENT_DATE_OVERRIDE?.trim();
  if (override) return override;
  return fmt.format(now);
}

/** Một mốc ISO rơi vào ngày nào theo giờ VN, dạng YYYY-MM-DD. */
export function vnDateOf(iso: string): string {
  return fmt.format(new Date(iso));
}

function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Khoảng cách theo ngày lịch giữa hai chuỗi YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** Số thứ tự ngày (1..20) của một ngày dương lịch, null nếu ngoài sự kiện. */
export function dayNumberFor(dateStr: string): number | null {
  const n = daysBetween(EVENT_START, dateStr) + 1;
  return n >= 1 && n <= TOTAL_DAYS ? n : null;
}

/** Ngày dương lịch (YYYY-MM-DD) của ngày thứ n. */
export function dateForDay(n: number): string {
  const ms = toUtcMs(EVENT_START) + (n - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export type EventStatus = 'truoc' | 'dang-chay' | 'da-xong';

export function eventStatus(today: string = vnToday()): EventStatus {
  if (daysBetween(today, EVENT_START) > 0) return 'truoc';
  if (daysBetween(EVENT_END, today) > 0) return 'da-xong';
  return 'dang-chay';
}

/** Ngày thứ mấy của hôm nay; null nếu sự kiện chưa mở hoặc đã đóng. */
export function currentDayNumber(today: string = vnToday()): number | null {
  return dayNumberFor(today);
}

/**
 * Số thứ tự của hôm nay, KHÔNG kẹp vào 1..20 — hai ngày sau 20/10 vẫn cần biết
 * "hôm nay là ngày 21" để tính khung học bù của ngày 19 và 20.
 */
export function rawDayNumber(today: string = vnToday()): number {
  return daysBetween(EVENT_START, today) + 1;
}

/** Ngày lớn nhất người chơi được phép mở (không cho chạy trước lịch). */
export function maxUnlockedDay(today: string = vnToday()): number {
  const n = daysBetween(EVENT_START, today) + 1;
  if (n < 1) return 0;
  return Math.min(n, TOTAL_DAYS);
}

const VN_DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
});

/** 2026-10-01 → "01/10" */
export function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return VN_DATE.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** 2026-10-01 → "01/10/2026" */
export function fullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const VN_CLOCK = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Mốc thời gian ISO → "20:00" theo giờ VN. */
export function vnClock(iso: string): string {
  return VN_CLOCK.format(new Date(iso));
}

/** Giờ VN của một mốc, dạng số 0–23 — dùng để chọn "sáng/chiều/tối". */
export function vnHour(iso: string): number {
  return Number(vnClock(iso).slice(0, 2));
}

const VN_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Mốc ISO → "2026-10-04T20:00" theo giờ VN, đúng dạng <input type="datetime-local">.
 * Phải quy đổi tay: cắt chuỗi ISO thẳng sẽ ra giờ UTC, lệch 7 tiếng.
 */
export function vnDateTimeInput(iso: string): string {
  const p = Object.fromEntries(
    VN_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Ngược lại: "2026-10-04T20:00" từ form → ISO có sẵn múi giờ VN. */
export function vnDateTimeToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  return `${local}:00+07:00`;
}

/** Tên 3 dải ruy băng — mỗi buổi Trạm hoa trao một dải để buộc bó hoa. */
export const RIBBONS = ['Ruy băng Thấu hiểu', 'Ruy băng Đồng hành', 'Ruy băng Chăm sóc'] as const;

/** Chủ đề 3 tuần + hai ngày về đích. */
export const WEEK_THEMES = [
  'Hiểu chu kỳ của khách hàng nữ',
  'Chu kỳ, thuốc tránh thai & hiệu suất tập',
  'Dinh dưỡng, thèm ăn & phòng chấn thương',
  'Về đích 20/10 — Case study tổng hợp',
] as const;
