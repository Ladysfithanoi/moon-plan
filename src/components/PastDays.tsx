'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type PastDay = {
  day: number;
  /** YYYY-MM-DD — dùng để lọc, so sánh chuỗi là đủ vì cùng định dạng. */
  date: string;
  /** "10/08" — đã dựng sẵn ở server để client không phải gọi lịch. */
  dateLabel: string;
  title: string;
  dayType: string;
  typeLabel: string;
  week: number;
  status: 'done' | 'freeze' | 'missed';
  points: number;
};

const PER_PAGE = 10;

/**
 * Danh sách những ngày đã đi qua: lọc theo khoảng ngày và hạng mục, chia trang
 * 10 ngày một lượt. Lọc ngay trong trình duyệt — cả sự kiện chỉ 47 ngày nên
 * không đáng để đi vòng lại server mỗi lần đổi bộ lọc.
 */
export default function PastDays({ days }: { days: PastDay[] }) {
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Hạng mục lấy từ chính danh sách — ngày chưa mở thì hạng mục đó chưa hiện ra.
  const types = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of days) if (!seen.has(d.dayType)) seen.set(d.dayType, d.typeLabel);
    return [...seen.entries()];
  }, [days]);

  const bounds = useMemo(() => {
    const dates = days.map((d) => d.date).sort();
    return { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' };
  }, [days]);

  const filtered = useMemo(
    () =>
      days.filter((d) => {
        if (type !== 'all' && d.dayType !== type) return false;
        if (from && d.date < from) return false;
        if (to && d.date > to) return false;
        return true;
      }),
    [days, type, from, to],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const dirty = type !== 'all' || from !== '' || to !== '';

  /** Đổi bộ lọc là quay về trang đầu, nếu không sẽ rơi vào trang trống. */
  function change(set: (v: string) => void) {
    return (v: string) => {
      set(v);
      setPage(1);
    };
  }

  function clear() {
    setType('all');
    setFrom('');
    setTo('');
    setPage(1);
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="pd-type">Hạng mục</label>
          <select id="pd-type" value={type} onChange={(e) => change(setType)(e.target.value)}>
            <option value="all">Tất cả</option>
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="pd-from">Từ ngày</label>
          <input
            id="pd-from"
            type="date"
            value={from}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => change(setFrom)(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="pd-to">Đến ngày</label>
          <input
            id="pd-to"
            type="date"
            value={to}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => change(setTo)(e.target.value)}
          />
        </div>

        {dirty ? (
          <button type="button" className="filter-clear" onClick={clear}>
            Xoá lọc
          </button>
        ) : null}
      </div>

      <p className="filter-count">
        {filtered.length ? (
          <>
            {filtered.length} ngày
            {dirty ? ` (trong ${days.length})` : ''} · trang {current}/{pageCount}
          </>
        ) : (
          'Không có ngày nào khớp bộ lọc.'
        )}
      </p>

      {shown.length ? (
        <ol className="ladder-list">
          {shown.map((d) => (
            <li key={d.day} className={d.status === 'done' ? 'done' : ''}>
              <Link href={`/ngay/${d.day}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                Ngày {d.day} · {d.dateLabel} — {d.title}
                <span className="day-type-tag">{d.typeLabel}</span>
              </Link>
              {d.status === 'done' ? (
                <span className="ladder-check">✓ +{d.points}đ</span>
              ) : d.status === 'freeze' ? (
                <span className="ladder-current">vé cứu</span>
              ) : (
                <span className="ladder-current">chưa xong</span>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {pageCount > 1 ? (
        <div className="pager">
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
          >
            ← Trước
          </button>
          <div className="pager-nums">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`pager-num${n === current ? ' here' : ''}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage(current + 1)}
            disabled={current === pageCount}
          >
            Sau →
          </button>
        </div>
      ) : null}
    </>
  );
}
