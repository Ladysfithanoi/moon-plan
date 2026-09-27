import type { GardenSummary } from '@/lib/game';

/**
 * Vườn chung của cả lớp: mỗi ô là một ngày, nắng nếu đủ đông người học đúng
 * hạn hôm đó. Ô hôm nay hiện số người đang có mặt so với ngưỡng cần để nắng —
 * đây là chỗ để mọi người nhắc nhau.
 */
export default function Garden({ garden, totalDays }: { garden: GardenSummary; totalDays: number }) {
  const byDay = new Map(garden.days.map((d) => [d.day, d]));
  const t = garden.today;
  const need = t ? Math.ceil(t.active * garden.threshold - 1e-9) : 0;
  const pct = t && t.active ? Math.round((t.participants / t.active) * 100) : 0;
  const needPct = Math.round(garden.threshold * 100);

  return (
    <div>
      {t ? (
        <div className="garden-today">
          <p className="garden-count">
            <span className="mono">{t.participants}</span>/<span className="mono">{t.active}</span> người đã học
            hôm nay
            {t.participants >= need ? (
              <span className="tag ok"> · vườn đã nắng</span>
            ) : (
              <span className="soft-text"> · cần thêm {need - t.participants} người để nắng</span>
            )}
          </p>
          <span className="bar-track garden-bar">
            <span className={`bar-fill${pct >= needPct ? ' herb' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            <span className="garden-mark" style={{ left: `${needPct}%` }} aria-hidden="true" />
          </span>
        </div>
      ) : null}

      <ol className="garden-strip" aria-label="Vườn chung theo ngày">
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const d = byDay.get(day);
          const isToday = t?.day === day;
          const cls = d ? (d.sunny ? 'sunny' : 'cloudy') : isToday ? 'now' : 'later';
          const title = d
            ? `Ngày ${day}: ${d.participants}/${d.active} người · ${d.sunny ? 'nắng' : 'chưa đủ nắng'}`
            : isToday
              ? `Ngày ${day}: đang diễn ra`
              : `Ngày ${day}`;
          return (
            <li key={day} className={cls} title={title}>
              <span className="mono">{day}</span>
            </li>
          );
        })}
      </ol>

      <p className="coach-note" style={{ marginTop: 14 }}>
        {garden.sunnyCount} ngày nắng · cả lớp đã có thêm {garden.dewBonus} giọt sương · còn{' '}
        {garden.sunnyToNextDew} ngày nắng nữa là thêm một giọt cho tất cả mọi người.
      </p>
    </div>
  );
}
