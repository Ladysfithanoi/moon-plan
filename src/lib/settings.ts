import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import { RIBBONS, WEEK_THEMES } from './event';
import {
  COMEBACK_POINTS,
  DAY_PLAN,
  GARDEN,
  GIFT_POINTS,
  MILESTONES,
  MYSTERY_BOX_CHANCE,
  MYSTERY_BOX_PRIZES,
  SCORING,
  SECRET_DAY_POINTS,
  TIERS,
  tierIndexFor,
  type DayType,
} from './scoring';

/**
 * Những thứ đổi được ở /admin/cai-dat mà không cần sửa code hay deploy lại.
 *
 * Giá trị lưu ở bảng `settings` dạng khoá → JSON. Chưa có bản ghi nào thì dùng
 * mặc định trong code, nên app chạy được ngay cả khi chưa ai vào trang cài đặt.
 * Mỗi khoá được kiểm tra hình dạng riêng: một khoá hỏng chỉ làm khoá đó quay về
 * mặc định, không kéo đổ cả trang.
 */

export type RewardTier = { title: string; detail: string };
export type BoxPrize = { title: string; detail: string; points: number };

export type ScoringConfig = {
  kien_thuc: { base: number; perCorrect: number };
  quiz_tuan: { base: number; bonus: number; threshold: number };
  thu_thach: { base: number };
  webinar: { base: number };
  case_study: { base: number };
  /** Hệ số nhân của 4 tầng hoa: Nụ, Hé nở, Nở rộ, Hoa hồng. */
  multipliers: [number, number, number, number];
  garden: { threshold: number; points: number; sunnyPerDew: number };
  mysteryBoxChance: number;
  secretDayPoints: number;
  giftPoints: number;
  comebackPoints: number;
};

export type AppSettings = {
  rewardTiers: RewardTier[];
  weekThemes: string[];
  ribbons: string[];
  boxPrizes: BoxPrize[];
  scoring: ScoringConfig;
  /** Trang /dang-ky có nhận người mới không. Tắt thì mã và SĐT cũ vẫn đăng nhập được. */
  registrationOpen: boolean;
  /** Link mời vào nhóm Zalo của lớp. Để trống thì app không hiện gì về Zalo. */
  zaloLink: string;
};

/**
 * Tên khoá mùa này khác hẳn mùa Trung Thu (ribbons thay cho moon_fragments,
 * scoring_2010 thay cho scoring) — dùng lại DB cũ thì cài đặt của mùa trước
 * không vô tình áp vào mùa mới.
 */
export const SETTING_KEYS = {
  rewardTiers: 'reward_tiers_2010',
  weekThemes: 'week_themes_2010',
  ribbons: 'ribbons',
  boxPrizes: 'box_prizes',
  scoring: 'scoring_2010',
  registrationOpen: 'registration_open',
  zaloLink: 'zalo_link',
} as const;

// ─── Mặc định ───────────────────────────────────────────────────────────────

export const DEFAULT_REWARD_TIERS: RewardTier[] = [
  {
    title: 'Bó hoa đủ 3 dải ruy băng + nộp case study',
    detail:
      'Giảm sâu khoá VPTA nâng cao, chứng nhận "Người thấu hiểu khách hàng nữ", được feature trên trang cá nhân',
  },
  {
    title: 'Chạm tầng Hoa hồng (chuỗi 14 ngày)',
    detail: 'Một buổi hỏi riêng 1-1 với mình, không phụ thuộc các điều kiện khác',
  },
  {
    title: 'Hoàn thành 70–99% chặng đường',
    detail: 'Giảm giá khoá học ở mức thấp hơn, chứng nhận tham gia',
  },
  {
    title: 'Case study xuất sắc nhất',
    detail: '1 buổi mentor 1-1 riêng về lập kế hoạch cho khách nữ',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  rewardTiers: DEFAULT_REWARD_TIERS,
  weekThemes: [...WEEK_THEMES],
  ribbons: [...RIBBONS],
  boxPrizes: MYSTERY_BOX_PRIZES.map((p) => ({ ...p })),
  scoring: {
    kien_thuc: { ...SCORING.kien_thuc },
    quiz_tuan: { ...SCORING.quiz_tuan },
    thu_thach: { ...SCORING.thu_thach },
    webinar: { ...SCORING.webinar },
    case_study: { ...SCORING.case_study },
    multipliers: TIERS.map((t) => t.mult) as ScoringConfig['multipliers'],
    garden: { ...GARDEN },
    mysteryBoxChance: MYSTERY_BOX_CHANCE,
    secretDayPoints: SECRET_DAY_POINTS,
    giftPoints: GIFT_POINTS,
    comebackPoints: COMEBACK_POINTS,
  },
  registrationOpen: true,
  zaloLink: '',
};

// ─── Kiểm tra hình dạng ─────────────────────────────────────────────────────

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function parseRewardTiers(raw: unknown): RewardTier[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_REWARD_TIERS;
  const out = raw
    .map((item) => {
      const t = item as Record<string, unknown>;
      const title = str(t.title, '');
      if (!title) return null;
      return { title, detail: str(t.detail, '') };
    })
    .filter((t): t is RewardTier => t !== null);
  return out.length ? out : DEFAULT_REWARD_TIERS;
}

/** Danh sách cố định số phần tử — thiếu chỗ nào lấy mặc định chỗ đó. */
function parseFixed(raw: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  return fallback.map((def, i) => str(raw[i], def));
}

function parseBoxPrizes(raw: unknown): BoxPrize[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_SETTINGS.boxPrizes;
  const out = raw
    .map((item) => {
      const p = item as Record<string, unknown>;
      const title = str(p.title, '');
      if (!title) return null;
      return { title, detail: str(p.detail, ''), points: Math.round(num(p.points, 0, 0, 100)) };
    })
    .filter((p): p is BoxPrize => p !== null);
  return out.length ? out : DEFAULT_SETTINGS.boxPrizes;
}

function parseScoring(raw: unknown): ScoringConfig {
  const d = DEFAULT_SETTINGS.scoring;
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Record<string, unknown>;
  const grp = (k: string) =>
    typeof s[k] === 'object' && s[k] && !Array.isArray(s[k]) ? (s[k] as Record<string, unknown>) : {};
  const int = (v: unknown, fallback: number) => Math.round(num(v, fallback, 0, 100));

  const rawMult = Array.isArray(s.multipliers) ? s.multipliers : [];
  const multipliers = d.multipliers.map((def, i) => num(rawMult[i], def, 0, 10)) as ScoringConfig['multipliers'];

  return {
    kien_thuc: {
      base: int(grp('kien_thuc').base, d.kien_thuc.base),
      perCorrect: int(grp('kien_thuc').perCorrect, d.kien_thuc.perCorrect),
    },
    quiz_tuan: {
      base: int(grp('quiz_tuan').base, d.quiz_tuan.base),
      bonus: int(grp('quiz_tuan').bonus, d.quiz_tuan.bonus),
      threshold: num(grp('quiz_tuan').threshold, d.quiz_tuan.threshold, 0, 1),
    },
    thu_thach: { base: int(grp('thu_thach').base, d.thu_thach.base) },
    webinar: { base: int(grp('webinar').base, d.webinar.base) },
    case_study: { base: int(grp('case_study').base, d.case_study.base) },
    multipliers,
    garden: {
      threshold: num(grp('garden').threshold, d.garden.threshold, 0, 1),
      points: int(grp('garden').points, d.garden.points),
      sunnyPerDew: Math.max(1, int(grp('garden').sunnyPerDew, d.garden.sunnyPerDew)),
    },
    mysteryBoxChance: num(s.mysteryBoxChance, d.mysteryBoxChance, 0, 1),
    secretDayPoints: Math.round(num(s.secretDayPoints, d.secretDayPoints, 0, 200)),
    giftPoints: int(s.giftPoints, d.giftPoints),
    comebackPoints: int(s.comebackPoints, d.comebackPoints),
  };
}

/** Chỉ nhận link https — link lạ không được thành nút bấm trên trang người chơi. */
export function parseZaloLink(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

// ─── Đọc ────────────────────────────────────────────────────────────────────

/**
 * Đọc toàn bộ cấu hình. Bọc bằng cache() nên nhiều component trong cùng một lần
 * dựng trang chỉ tốn một truy vấn.
 */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const { data, error } = await db().from('settings').select('key,value');
  if (error || !data) return DEFAULT_SETTINGS;

  const map = new Map(data.map((r) => [r.key as string, r.value]));

  return {
    rewardTiers: parseRewardTiers(map.get(SETTING_KEYS.rewardTiers)),
    weekThemes: parseFixed(map.get(SETTING_KEYS.weekThemes), WEEK_THEMES),
    ribbons: parseFixed(map.get(SETTING_KEYS.ribbons), RIBBONS),
    boxPrizes: parseBoxPrizes(map.get(SETTING_KEYS.boxPrizes)),
    scoring: parseScoring(map.get(SETTING_KEYS.scoring)),
    registrationOpen: map.get(SETTING_KEYS.registrationOpen) !== false,
    zaloLink: parseZaloLink(map.get(SETTING_KEYS.zaloLink)),
  };
});

// ─── Ghi ────────────────────────────────────────────────────────────────────

export async function saveSetting(key: string, value: unknown): Promise<{ error?: string }> {
  const { error } = await db()
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { error: error.message } : {};
}

// ─── Tính điểm ──────────────────────────────────────────────────────────────

/** Điểm gốc tối đa của một loại ngày, chưa nhân tầng. */
export function rawPointsFor(type: DayType, s: ScoringConfig, questions = 1): number {
  switch (type) {
    case 'kien_thuc':
      return s.kien_thuc.base + questions * s.kien_thuc.perCorrect;
    case 'quiz_tuan':
      return s.quiz_tuan.base + s.quiz_tuan.bonus;
    case 'thu_thach':
      return s.thu_thach.base;
    case 'webinar':
      return s.webinar.base;
    case 'case_study':
      return s.case_study.base;
    default:
      return 0;
  }
}

/** Nhân điểm gốc với hệ số của tầng, làm tròn về số nguyên. */
export function applyMultiplier(raw: number, tier: number, s: ScoringConfig): number {
  return Math.round(raw * (s.multipliers[tier] ?? 1));
}

/**
 * Tổng điểm tối đa của cả mùa, tính theo bảng điểm đang dùng: học đều từ ngày
 * đầu, đúng hết mỗi ngày một câu, cộng thưởng các mốc tầng. Chưa tính quà ngẫu
 * nhiên và vườn chung.
 */
export function maxPoints(s: ScoringConfig): number {
  let total = 0;
  DAY_PLAN.forEach((type, i) => {
    total += applyMultiplier(rawPointsFor(type, s), tierIndexFor(i + 1), s);
  });
  return total + MILESTONES.reduce((sum, m) => sum + m.points, 0);
}
