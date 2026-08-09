'use client';

import { useEffect, useState } from 'react';

/**
 * Đếm ngược tới một mốc thời gian. Render số "—" ở lượt đầu để phía server và
 * phía trình duyệt khớp nhau, tránh cảnh báo hydration.
 */
export default function Countdown({ target, note }: { target: string; note: string }) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number } | null>(null);

  useEffect(() => {
    const at = new Date(target).getTime();

    function tick() {
      const diff = at - Date.now();
      if (diff <= 0) {
        setLeft({ d: 0, h: 0, m: 0 });
        return;
      }
      setLeft({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
      });
    }

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [target]);

  const show = (n: number | undefined) => (n === undefined ? '—' : String(n));

  return (
    <>
      <div className="countdown">
        <div className="cd-item">
          <span className="cd-num mono">{show(left?.d)}</span>
          <span className="cd-label">ngày</span>
        </div>
        <div className="cd-item">
          <span className="cd-num mono">{show(left?.h)}</span>
          <span className="cd-label">giờ</span>
        </div>
        <div className="cd-item">
          <span className="cd-num mono">{show(left?.m)}</span>
          <span className="cd-label">phút</span>
        </div>
      </div>
      <p className="cd-note">{note}</p>
    </>
  );
}
