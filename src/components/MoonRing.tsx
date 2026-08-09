/**
 * Vòng cung khép kín — điểm xuất phát và điểm đích trùng nhau trên vòng tròn.
 * Trăng ở tâm tròn dần theo phần trăm hoàn thành, con thỏ chạy trên vòng ngoài.
 *
 * Component thuần tính toán, render được trên server.
 */

const CX = 110;
const CY = 110;
const R = 92;
const MOON_R = 30;

function polar(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

export default function MoonRing({
  day,
  totalDays,
  completed,
  phase,
}: {
  day: number;
  totalDays: number;
  /** Số ngày đã thật sự hoàn thành — quyết định độ tròn của trăng. */
  completed: number;
  phase: string;
}) {
  const pct = Math.max(0, Math.min(1, completed / totalDays));
  const start = polar(0);
  const end = polar(360 * pct);
  const large = pct > 0.5 ? 1 : 0;
  // Cung tròn 100% không vẽ được bằng một arc duy nhất — dùng luôn hình tròn.
  const isFull = pct >= 0.999;

  const moonCircumference = 2 * Math.PI * MOON_R;
  const rabbit = polar(360 * pct);

  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 220 220" role="img" aria-label={`Đã đi ${completed} trên ${totalDays} ngày`}>
        {/* Vòng cung chấm — quãng đường của cả mùa */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--ink-15)"
          strokeWidth="2"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />

        {/* Phần đã đi */}
        {isFull ? (
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--herb)" strokeWidth="3" />
        ) : pct > 0 ? (
          <path
            d={`M${start.x.toFixed(2)},${start.y.toFixed(2)} A${R},${R} 0 ${large},1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`}
            fill="none"
            stroke="var(--herb)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : null}

        {/* Vầng trăng ở tâm, tròn dần theo phần trăm */}
        <circle cx={CX} cy={CY} r={MOON_R} fill="none" stroke="var(--ink-15)" strokeWidth="1.5" />
        <circle
          cx={CX}
          cy={CY}
          r={MOON_R}
          fill="none"
          stroke="var(--herb)"
          strokeWidth="3"
          transform={`rotate(-90 ${CX} ${CY})`}
          strokeDasharray={`${(moonCircumference * pct).toFixed(1)} ${moonCircumference.toFixed(1)}`}
        />

        {/* Con thỏ */}
        <g transform={`translate(${rabbit.x.toFixed(2)},${rabbit.y.toFixed(2)})`}>
          <ellipse cx="0" cy="0" rx="5" ry="3.5" fill="var(--ink)" />
          <ellipse cx="-2.5" cy="-5" rx="1.4" ry="4" fill="var(--ink)" />
          <ellipse cx="2.5" cy="-5" rx="1.4" ry="4" fill="var(--ink)" />
        </g>
      </svg>
      <div className="ring-center">
        <span className="day-mono mono">
          Ngày {day}/{totalDays}
        </span>
        <span className="phase-label">{phase}</span>
      </div>
    </div>
  );
}
