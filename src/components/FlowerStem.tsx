import Flower, { STATE_LABEL, TierFlower } from './Flower';
import type { BloomCell } from '@/lib/bloom';
import { TIERS, type TierIndex } from '@/lib/scoring';

/**
 * Cành hoa mọc từ dưới lên, mỗi ngày một đốt, mỗi đốt một bông. Trên ngọn là
 * bông "hôm nay" — to theo tầng hiện tại của chuỗi.
 *
 * Component thuần tính toán, render trên server, không cần JS ở trình duyệt.
 */

const W = 200;
const TOP = 78; // chỗ cho bông trên ngọn
const GAP = 22;
const BOTTOM = 26;

function stemX(y: number): number {
  return W / 2 + 6 * Math.sin(y / 38);
}

export default function FlowerStem({
  cells,
  tier,
  sleeping,
}: {
  cells: BloomCell[];
  tier: TierIndex;
  /** Cây đang ngủ — bông trên ngọn khép lại. */
  sleeping: boolean;
}) {
  const n = cells.length;
  const H = TOP + (n - 1) * GAP + BOTTOM;
  const yOf = (i: number) => H - BOTTOM - i * GAP;

  // Phần cành đã mọc: tới đốt cuối cùng không còn là "chưa tới".
  const grown = cells.reduce((acc, c, i) => (c.state !== 'future' ? i : acc), -1);
  const growTo = grown >= 0 ? yOf(grown) : H - BOTTOM;

  const path = (from: number, to: number) => {
    const pts: string[] = [];
    for (let y = from; y >= to; y -= 6) pts.push(`${stemX(y).toFixed(1)},${y.toFixed(1)}`);
    pts.push(`${stemX(to).toFixed(1)},${to.toFixed(1)}`);
    return `M${pts.join(' L')}`;
  };

  const crownY = 34;
  const done = cells.filter((c) => c.state === 'done' || c.state === 'late').length;

  return (
    <div className="stem-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cành hoa: ${done} trên ${n} ngày đã nở, tầng ${TIERS[tier].name}`}
      >
        {/* Phần cành còn chờ mọc */}
        <path
          d={path(growTo, crownY + 14)}
          fill="none"
          stroke="var(--ink-15)"
          strokeWidth="1.5"
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
        {/* Phần cành đã mọc */}
        <path
          d={path(H - 8, growTo)}
          fill="none"
          stroke="var(--herb)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {cells.map((c, i) => {
          const y = yOf(i);
          const x = stemX(y);
          const side = i % 2 === 0 ? 1 : -1;
          const hasBranch = c.state !== 'future' && c.state !== 'before';
          const fx = x + side * 26;
          const fy = y - 7;

          return (
            <g key={c.day}>
              <title>{`Ngày ${c.day} · ${STATE_LABEL[c.state]}${c.open ? ' · còn học bù được' : ''}`}</title>
              {/* Số ngày nằm ngay cạnh bông của nó, phía ngoài — đặt bên kia
                  thân thì mắt dễ ghép nhầm với bông của ngày kế bên. */}
              <text
                x={hasBranch ? fx + side * 13 : x + side * 8}
                y={(hasBranch ? fy : y) + 2.5}
                textAnchor={side > 0 ? 'start' : 'end'}
                className="stem-day"
              >
                {c.day}
              </text>
              {hasBranch ? (
                <>
                  <path
                    d={`M${x.toFixed(1)},${y.toFixed(1)} Q${(x + side * 12).toFixed(1)},${(y - 1).toFixed(1)} ${fx.toFixed(1)},${fy.toFixed(1)}`}
                    fill="none"
                    stroke={c.state === 'wilted' || c.state === 'thirsty' ? 'var(--ink-40)' : 'var(--herb)'}
                    strokeWidth="1.2"
                  />
                  <g transform={`translate(${fx.toFixed(1)},${fy.toFixed(1)})`}>
                    <Flower state={c.state} tier={c.tier} open={c.open} />
                  </g>
                </>
              ) : (
                <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                  <Flower state={c.state} tier={c.tier} />
                </g>
              )}
            </g>
          );
        })}

        {/* Bông trên ngọn — tầng hiện tại */}
        <g transform={`translate(${stemX(crownY).toFixed(1)},${crownY}) scale(2.6)`}>
          {sleeping ? (
            <g opacity="0.6">
              <Flower state="thirsty" tier={0} />
            </g>
          ) : (
            <TierFlower tier={tier} />
          )}
        </g>
      </svg>
    </div>
  );
}
