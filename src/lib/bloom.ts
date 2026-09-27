import { COMEBACK_DAYS, MILESTONES, TIERS, tierIndexFor, type TierIndex } from './scoring';

/**
 * Luật của cây hoa — thuần tính toán, không đọc cơ sở dữ liệu, nên server dùng
 * để chấm điểm và giao diện dùng để vẽ cành hoa từ cùng một nguồn.
 *
 * Chuỗi không lưu cứng trong DB mà tính lại từ danh sách ngày đã làm mỗi lần
 * cần. Lý do: học bù có thể lấp một ngày trong quá khứ, và giọt sương chỉ nên
 * tiêu khi thật sự không còn cách nào khác — cả hai đều làm thay đổi lịch sử,
 * tính lại từ đầu là cách duy nhất để con số luôn đúng.
 *
 * Luật, theo thứ tự đi từ ngày 1 tới hôm nay:
 *   · làm một ngày (đúng hạn hoặc học bù)  → chuỗi +1
 *   · bỏ đúng 1 ngày: còn giọt sương thì tưới, chuỗi giữ nguyên;
 *                     hết giọt sương thì cây khát nước, tụt một tầng
 *   · bỏ 2 ngày liền: hoa héo, chuỗi về 0
 *   · bỏ 3 ngày liền trở lên: cây ngủ. Quay lại học đủ 3 ngày liền thì hồi
 *     xuân — lấy lại một nửa chuỗi cũ, cộng thêm phần thưởng quay lại
 *   · ngày Trạm hoa (Chủ Nhật): đến thì tính, vắng thì bỏ qua như không có
 *   · ngày bỏ lỡ còn học bù được tới hết ngày thứ hai sau đó
 */

/** Ngày bỏ lỡ còn làm lại được trong chừng này ngày sau đó (≈ 48 giờ). */
export const MAKEUP_DAYS = 2;

export type CellState =
  | 'future' // chưa tới
  | 'before' // trước khi người chơi có mã — không tính
  | 'today' // hôm nay, chưa làm
  | 'done' // làm đúng hạn
  | 'late' // học bù
  | 'rest' // vắng Trạm hoa — không tính
  | 'dew' // bỏ lỡ 1 ngày, giọt sương đã tưới
  | 'thirsty' // bỏ lỡ 1 ngày, hết giọt sương → tụt một tầng
  | 'wilted'; // bỏ lỡ 2 ngày liền trở lên → héo

export type BloomCell = {
  day: number;
  state: CellState;
  /** Ngày bỏ lỡ nhưng vẫn còn trong khung học bù. */
  open: boolean;
  /** Chuỗi và tầng ngay sau ngày này — quyết định bông to hay nhỏ. */
  streak: number;
  tier: TierIndex;
};

export type BloomEventKind = (typeof MILESTONES)[number]['kind'] | 'hoi_xuan';
export type BloomEvent = { day: number; kind: BloomEventKind };

export type Bloom = {
  cells: BloomCell[];
  streak: number;
  best: number;
  tier: TierIndex;
  /** Tầng sẽ áp dụng nếu làm xong hôm nay đúng hạn (null nếu không còn gì để làm). */
  nextTier: TierIndex | null;
  dewsUsed: number;
  dewsLeft: number;
  /** Số ngày bỏ lỡ liền nhau ngay trước hôm nay, không tính ngày Trạm hoa. */
  trailingMiss: number;
  /** Cây đang ngủ: chuỗi trước khi ngủ và số ngày đã quay lại liền nhau. */
  dormant: { before: number; progress: number } | null;
  /** Những ngày còn học bù được. */
  openDays: number[];
  /** Mốc tầng và hồi xuân, theo ngày xảy ra. */
  events: BloomEvent[];
};

export type BloomInput = {
  /** Số thứ tự hôm nay, không kẹp — sau 20/10 vẫn tăng tiếp. */
  today: number;
  totalDays: number;
  /** Ngày đầu tiên người chơi được tính — không phạt những ngày trước khi có mã. */
  joinDay: number;
  /** Các ngày trung tính (Trạm hoa). */
  neutral: ReadonlySet<number>;
  /** Ngày đã làm → có phải học bù không. */
  marks: ReadonlyMap<number, { late: boolean }>;
  /** Tổng số giọt sương được cấp (kể cả từ vườn chung). */
  dews: number;
};

function dropOneTier(streak: number): number {
  const t = tierIndexFor(streak);
  return t > 0 ? TIERS[t - 1].min : 0;
}

export function computeBloom(input: BloomInput): Bloom {
  const { today, totalDays, joinDay, neutral, marks, dews } = input;
  const last = Math.min(today, totalDays);

  let streak = 0;
  let best = 0;
  let dewsUsed = 0;
  // Ép kiểu thay vì khai báo kiểu: settleGap() gán lại biến này bên trong
  // closure, TypeScript không theo dõi được và sẽ coi nó luôn là null.
  let dormant = null as Bloom['dormant'];
  let gap: BloomCell[] = [];
  const cells: BloomCell[] = [];
  const events: BloomEvent[] = [];
  const reached = new Set<string>();

  /** Chốt một quãng bỏ lỡ khi đã biết nó dài bao nhiêu. */
  const settleGap = () => {
    if (!gap.length) return;
    if (gap.length === 1) {
      if (dewsUsed < dews) {
        dewsUsed++;
        gap[0].state = 'dew';
      } else {
        streak = dropOneTier(streak);
        gap[0].state = 'thirsty';
        if (dormant) dormant.progress = 0;
      }
    } else {
      const before = streak;
      streak = 0;
      for (const c of gap) c.state = 'wilted';
      if (gap.length >= 3) {
        dormant = { before: Math.max(before, dormant?.before ?? 0), progress: 0 };
      } else if (dormant) {
        dormant.progress = 0;
      }
    }
    for (const c of gap) {
      c.streak = streak;
      c.tier = tierIndexFor(streak);
    }
    gap = [];
  };

  let todayCell: BloomCell | null = null;

  for (let d = 1; d <= totalDays; d++) {
    const cell: BloomCell = { day: d, state: 'future', open: false, streak: 0, tier: 0 };
    cells.push(cell);
    if (d > last) continue;
    if (d < joinDay) {
      cell.state = 'before';
      continue;
    }

    const mark = marks.get(d);
    if (!mark) {
      if (d === today) {
        cell.state = 'today';
        todayCell = cell;
        continue;
      }
      if (neutral.has(d)) {
        // Trạm hoa không học bù được, và cũng không cần: vắng thì bỏ qua.
        cell.state = 'rest';
        continue;
      }
      cell.open = d >= today - MAKEUP_DAYS;
      gap.push(cell);
      continue;
    }

    settleGap();
    streak += 1;

    if (dormant) {
      dormant.progress += 1;
      if (dormant.progress >= COMEBACK_DAYS) {
        streak = Math.max(streak, COMEBACK_DAYS + Math.floor(dormant.before / 2));
        events.push({ day: d, kind: 'hoi_xuan' });
        dormant = null;
      }
    }

    best = Math.max(best, streak);
    for (const m of MILESTONES) {
      if (streak >= m.streak && !reached.has(m.kind)) {
        reached.add(m.kind);
        events.push({ day: d, kind: m.kind });
      }
    }

    cell.state = mark.late ? 'late' : 'done';
    cell.streak = streak;
    cell.tier = tierIndexFor(streak);
  }

  // Quãng bỏ lỡ ngay trước hôm nay: tạm chốt để người chơi thấy hậu quả nếu
  // không học bù. Học bù xong thì lần tính sau tự khác đi.
  const trailingMiss = gap.length;
  settleGap();

  if (todayCell) {
    todayCell.streak = streak;
    todayCell.tier = tierIndexFor(streak);
  }

  const openDays = cells
    .filter((c) => c.open && (c.state === 'dew' || c.state === 'thirsty' || c.state === 'wilted'))
    .map((c) => c.day);

  // Tầng của hôm nay nếu làm xong đúng hạn — chạy thử với một dấu cho hôm nay,
  // để tính luôn cả trường hợp hôm nay chính là ngày hồi xuân.
  let nextTier: TierIndex | null = null;
  if (todayCell) {
    const trial = computeBloom({
      ...input,
      marks: new Map([...marks, [today, { late: false }]]),
    });
    nextTier = trial.cells[today - 1]?.tier ?? null;
  }

  return {
    cells,
    streak,
    best,
    tier: tierIndexFor(streak),
    nextTier,
    dewsUsed,
    dewsLeft: Math.max(0, dews - dewsUsed),
    trailingMiss,
    dormant,
    openDays,
    events,
  };
}

/** Còn bao nhiêu ngày nữa thì lên tầng kế tiếp (null nếu đã ở tầng cao nhất). */
export function daysToNextTier(streak: number): { days: number; tier: TierIndex } | null {
  const t = tierIndexFor(streak);
  if (t >= TIERS.length - 1) return null;
  const next = (t + 1) as TierIndex;
  return { days: TIERS[next].min - streak, tier: next };
}
