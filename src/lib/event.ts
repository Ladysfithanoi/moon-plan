/**
 * Mốc thời gian của sự kiện. Mọi phép tính "hôm nay là ngày thứ mấy" đều quy về
 * giờ Việt Nam, vì server Vercel chạy theo UTC — nếu không quy đổi thì từ 0h đến
 * 7h sáng giờ VN người chơi sẽ thấy nội dung của hôm qua.
 */

export const EVENT_START = '2026-08-10'; // ngày khởi động
export const EVENT_END = '2026-09-25'; // đêm hội trăng rằm
export const TOTAL_DAYS = 47;
export const TZ = 'Asia/Ho_Chi_Minh';

/** Giờ bắt đầu đêm hội, dùng cho đếm ngược. */
export const FESTIVAL_AT = '2026-09-25T19:00:00+07:00';
/** Giờ khởi động ngày 1, dùng cho đếm ngược ở trang giới thiệu. */
export const KICKOFF_AT = '2026-08-10T08:00:00+07:00';

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

function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Khoảng cách theo ngày lịch giữa hai chuỗi YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** Số thứ tự ngày (1..47) của một ngày dương lịch, null nếu ngoài sự kiện. */
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

/** 2026-08-10 → "10/08" */
export function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return VN_DATE.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** 2026-08-10 → "10/08/2026" */
export function fullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Tên 6 mảnh trăng theo tuần. */
export const MOON_FRAGMENTS = [
  'Tia sáng đầu tiên',
  'Nhịp bước vững vàng',
  'Góc nhìn khác biệt',
  'Kiến trúc sư giáo án',
  'Nhịp đập chuyển hoá',
  'Người dẫn đường tinh tế',
] as const;

/** Chủ đề 6 tuần + tuần chung kết. */
export const WEEK_THEMES = [
  'Tâm lý thay đổi hành vi khách hàng (TTM)',
  'Động lực nội tại & rào cản tâm lý (SDT · COM-B)',
  'Sinh lý học khác biệt nam–nữ trong tập luyện',
  'Kiến trúc chương trình: Fat loss vs Hypertrophy',
  'Sức mạnh chuyển hoá (metabolic strength) vs cardio',
  'Môi trường ăn uống, Nudge Theory & tốc độ giảm cân',
  'Tuần chung kết — Case study tổng hợp',
] as const;
