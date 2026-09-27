import Flower from './Flower';
import type { BloomCell } from '@/lib/bloom';

/**
 * Bó hoa 20/10 — mọi bông trên cành gom lại thành một bó, buộc bằng những dải
 * ruy băng đã nhận ở Trạm hoa. Ngày nào học đều thì bông to và đỏ; ngày bỏ lỡ
 * vẫn nằm trong bó, dưới dạng hoa héo.
 */

const W = 300;
const H = 300;
const TIE = { x: 150, y: 236 };
const RIBBON_COLORS = ['var(--clay)', 'var(--amber)', 'var(--slate)'];
const MOUTH_Y = TIE.y - 70;
const WRAP = `M${TIE.x},${H - 6} L${TIE.x - 58},${MOUTH_Y} L${TIE.x + 58},${MOUTH_Y} Z`;

export default function Bouquet({ cells, ribbons }: { cells: BloomCell[]; ribbons: number }) {
  const stems = cells.filter((c) => c.state !== 'future' && c.state !== 'before' && c.state !== 'today');
  const n = Math.max(stems.length, 2);

  return (
    <div className="bouquet-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bó hoa ${stems.length} bông, ${ribbons} dải ruy băng`}>
        {stems.map((c, i) => {
          const angle = ((-58 + (i / (n - 1)) * 116) * Math.PI) / 180;
          const len = 150 + (i % 3) * 20 - Math.abs(i - (n - 1) / 2) * 1.5;
          const fx = TIE.x + Math.sin(angle) * len;
          const fy = TIE.y - Math.cos(angle) * len;
          const sad = c.state === 'wilted' || c.state === 'thirsty';
          // Cành đi thẳng từ chỗ buộc lên miệng giấy gói (phần này bị giấy che),
          // rồi mới toả ra — nếu không, cành ngoài cùng đâm xuyên hông giấy.
          const mx = TIE.x + Math.max(-48, Math.min(48, (fx - TIE.x) * 0.4));
          const my = MOUTH_Y + 4;
          return (
            <g key={c.day}>
              <path
                d={`M${TIE.x},${TIE.y} L${mx.toFixed(1)},${my} Q${(mx + (fx - mx) * 0.25).toFixed(1)},${(my - 34).toFixed(1)} ${fx.toFixed(1)},${fy.toFixed(1)}`}
                fill="none"
                stroke={sad ? 'var(--ink-40)' : 'var(--herb)'}
                strokeWidth="1.3"
              />
              <g transform={`translate(${fx.toFixed(1)},${fy.toFixed(1)}) scale(1.55)`}>
                <title>{`Ngày ${c.day}`}</title>
                <Flower state={c.state} tier={c.tier} />
              </g>
            </g>
          );
        })}

        {/* Giấy gói vẽ sau cành để che phần gốc. Nền paper đặc bên dưới vì
            amber-10 trong suốt — thiếu nó thì cành lộ xuyên qua giấy. */}
        <path d={WRAP} fill="var(--paper)" />
        <path d={WRAP} fill="var(--amber-10)" stroke="var(--amber)" strokeWidth="1" strokeLinejoin="round" />

        {/* Ruy băng buộc bó */}
        {Array.from({ length: ribbons }, (_, i) => {
          const y = TIE.y + 4 + i * 11;
          const color = RIBBON_COLORS[i % RIBBON_COLORS.length];
          return (
            <g key={i} transform={`translate(${TIE.x},${y})`}>
              <path d="M-20,0 L20,0" stroke={color} strokeWidth="3" />
              <path d="M0,0 C-14,-10 -20,4 0,0 C20,4 14,-10 0,0Z" fill={color} />
              <path d="M0,0 L-9,16 M0,0 L9,16" stroke={color} strokeWidth="2" strokeLinecap="round" />
            </g>
          );
        })}
        {ribbons === 0 ? (
          <path
            d={`M${TIE.x - 20},${TIE.y + 4} L${TIE.x + 20},${TIE.y + 4}`}
            stroke="var(--ink-15)"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>
    </div>
  );
}
