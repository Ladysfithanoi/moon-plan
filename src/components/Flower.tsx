import type { CellState } from '@/lib/bloom';
import type { TierIndex } from '@/lib/scoring';

/**
 * Một bông hoa vẽ quanh gốc (0,0), dùng chung cho cành hoa và bó hoa.
 *
 * Độ nở đi theo tầng của chuỗi lúc làm ngày đó — cùng một bài học, người đang
 * có chuỗi dài sẽ có bông to hơn. Nhìn cả cành là thấy ngay ai học đều.
 *
 *   Nụ       — nụ xanh
 *   Hé nở    — năm cánh nhỏ
 *   Nở rộ    — tám cánh
 *   Hoa hồng — hoa hồng đỏ
 *
 * Ngày bỏ lỡ có hình riêng: giọt sương (được tưới), nụ khô (khát nước), hoa rũ
 * (héo). Ngày còn học bù được thì có thêm vòng nét đứt đỏ đất.
 */

function Bud() {
  return (
    <>
      <ellipse cx="0" cy="0" rx="3.2" ry="5" fill="var(--herb)" />
      <circle cx="0" cy="-4.2" r="1.7" fill="var(--amber)" />
    </>
  );
}

function SmallBloom() {
  return (
    <>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx="0"
          cy="-3.6"
          r="2.9"
          fill="var(--amber)"
          opacity="0.55"
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx="0" cy="0" r="2.1" fill="var(--amber)" />
    </>
  );
}

function FullBloom() {
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-4.8"
          rx="2.5"
          ry="4.6"
          fill="var(--amber)"
          opacity="0.85"
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx="0" cy="0" r="2.8" fill="var(--paper)" stroke="var(--amber)" strokeWidth="1.2" />
    </>
  );
}

function Rose() {
  return (
    <>
      <circle cx="0" cy="0" r="7.2" fill="var(--clay)" />
      <path
        d="M0.2,0.4 a1.1,1.1 0 1,1 1.1,-1.2 a2.6,2.6 0 1,1 -4.2,1.9 a4.3,4.3 0 1,1 7.6,-2.6"
        fill="none"
        stroke="var(--paper)"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.8"
      />
    </>
  );
}

function Dew() {
  return (
    <path
      d="M0,-6.5 C2.8,-2 4.2,0.4 4.2,2.2 A4.2,4.2 0 0 1 -4.2,2.2 C-4.2,0.4 -2.8,-2 0,-6.5Z"
      fill="var(--slate)"
      opacity="0.75"
    />
  );
}

function Dry() {
  return <ellipse cx="0" cy="0" rx="2.6" ry="4.2" fill="var(--ink-40)" transform="rotate(28)" />;
}

function Wilted() {
  return (
    <g transform="rotate(155)">
      {[-50, -18, 18, 50].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-4"
          rx="1.8"
          ry="3.8"
          fill="var(--ink-40)"
          opacity="0.7"
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx="0" cy="0" r="1.8" fill="var(--ink-40)" />
    </g>
  );
}

function Leaf() {
  return (
    <path d="M-4,1 Q0,-5 5,-1 Q0,3 -4,1Z" fill="var(--herb)" opacity="0.45" />
  );
}

/** Bông hoa theo tầng — không kể trạng thái bỏ lỡ. */
export function TierFlower({ tier }: { tier: TierIndex }) {
  if (tier === 3) return <Rose />;
  if (tier === 2) return <FullBloom />;
  if (tier === 1) return <SmallBloom />;
  return <Bud />;
}

export default function Flower({
  state,
  tier,
  open = false,
}: {
  state: CellState;
  tier: TierIndex;
  open?: boolean;
}) {
  switch (state) {
    case 'done':
      return <TierFlower tier={tier} />;
    case 'late':
      return (
        <>
          <g opacity="0.55">
            <TierFlower tier={tier} />
          </g>
          <circle r="9" fill="none" stroke="var(--ink-15)" strokeDasharray="2 2" />
        </>
      );
    case 'today':
      return (
        <>
          <circle className="pulse" r="8" fill="none" stroke="var(--amber)" strokeWidth="1.3" strokeDasharray="2.5 2" />
          <g opacity="0.35">
            <Bud />
          </g>
        </>
      );
    case 'rest':
      return <Leaf />;
    case 'future':
    case 'before':
      return <circle r="1.6" fill="var(--ink-15)" />;
    default: {
      const glyph = state === 'dew' ? <Dew /> : state === 'thirsty' ? <Dry /> : <Wilted />;
      return open ? (
        <>
          <g opacity="0.5">{glyph}</g>
          <circle r="9" fill="none" stroke="var(--clay)" strokeWidth="1.1" strokeDasharray="2 2" />
        </>
      ) : (
        glyph
      );
    }
  }
}

export const STATE_LABEL: Record<CellState, string> = {
  future: 'chưa tới',
  before: 'trước khi bạn tham gia',
  today: 'hôm nay — chưa làm',
  done: 'đúng hạn',
  late: 'học bù',
  rest: 'vắng Trạm hoa — không tính',
  dew: 'bỏ lỡ — giọt sương đã tưới',
  thirsty: 'bỏ lỡ — khát nước, tụt một tầng',
  wilted: 'bỏ lỡ — héo',
};
