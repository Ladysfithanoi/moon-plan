import Link from 'next/link';
import { db } from '@/lib/supabase';
import { daysBetween, vnClock, vnHour, vnToday } from '@/lib/event';
import { DAY_TYPE_LABEL } from '@/lib/scoring';

/** Buổi coi như tan sau chừng này — hết thì thôi nhắc. */
const RUNS_FOR_MS = 2 * 60 * 60 * 1000;

type Row = {
  day: number;
  date: string;
  week: number;
  day_type: string;
  webinar_at: string | null;
  webinar_link: string | null;
};

/** 20:00 → "Tối", 14:00 → "Chiều", 09:00 → "Sáng". */
function buoi(iso: string): string {
  const h = vnHour(iso);
  if (h >= 18) return 'Tối';
  if (h >= 12) return 'Chiều';
  return 'Sáng';
}

/**
 * Dải nhắc buổi trạm dừng gốc đa, hiện từ sáng hôm trước tới lúc buổi tan.
 *
 * Đọc thẳng DB ở phía server và chỉ trả về đúng một dòng chữ — lịch của những
 * buổi khác, và nhất là `webinar_code`, không đi xuống trình duyệt.
 */
export default async function WebinarBanner() {
  const { data } = await db()
    .from('days')
    .select('day,date,week,day_type,webinar_at,webinar_link')
    .in('day_type', ['webinar', 'dem_hoi'])
    .not('webinar_at', 'is', null)
    .order('day');

  const today = vnToday();
  const now = Date.now();

  const next = ((data ?? []) as Row[]).find((r) => {
    if (!r.webinar_at) return false;
    const away = daysBetween(today, r.date); // 1 = mai · 0 = hôm nay
    if (away < 0 || away > 1) return false;
    return now < Date.parse(r.webinar_at) + RUNS_FOR_MS;
  });

  if (!next?.webinar_at) return null;

  const label =
    next.day_type === 'dem_hoi'
      ? DAY_TYPE_LABEL.dem_hoi
      : `${DAY_TYPE_LABEL.webinar} tuần ${next.week}`;

  const started = now >= Date.parse(next.webinar_at);
  const when = started
    ? 'Đang diễn ra'
    : daysBetween(today, next.date) === 1
      ? `${buoi(next.webinar_at)} mai ${vnClock(next.webinar_at)}`
      : `${buoi(next.webinar_at)} nay ${vnClock(next.webinar_at)}`;

  return (
    <div className={`webinar-banner${started ? ' live' : ''}`}>
      <div className="wrap">
        <span className="wb-moon" aria-hidden="true">
          ◐
        </span>
        <span className="wb-text">
          <strong>{when}</strong> — {label}
        </span>
        {next.webinar_link ? (
          <a href={next.webinar_link} target="_blank" rel="noreferrer" className="wb-link">
            Vào phòng họp →
          </a>
        ) : (
          <Link href={`/ngay/${next.day}`} className="wb-link">
            Xem chi tiết →
          </Link>
        )}
      </div>
    </div>
  );
}
