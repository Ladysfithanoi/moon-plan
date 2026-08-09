import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import { MOON_FRAGMENTS, WEEK_THEMES } from './event';
import {
  CARROT_POINTS,
  MYSTERY_BOX_CHANCE,
  MYSTERY_BOX_PRIZES,
  RABBIT_DAY_POINTS,
  SCORING,
} from './scoring';

/**
 * Những thứ Trung đổi được ở /admin/cai-dat mà không cần sửa code hay deploy lại.
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
  mysteryBoxChance: number;
  rabbitDayPoints: number;
  carrotPoints: number;
};

export type AppSettings = {
  rewardTiers: RewardTier[];
  weekThemes: string[];
  moonFragments: string[];
  boxPrizes: BoxPrize[];
  scoring: ScoringConfig;
};

export const SETTING_KEYS = {
  rewardTiers: 'reward_tiers',
  weekThemes: 'week_themes',
  moonFragments: 'moon_fragments',
  boxPrizes: 'box_prizes',
  scoring: 'scoring',
} as const;

// ─── Mặc định ───────────────────────────────────────────────────────────────

export const DEFAULT_REWARD_TIERS: RewardTier[] = [
  {
    title: 'Đủ 6 mảnh trăng + case study',
    detail:
      'Giảm sâu khoá VPTA nâng cao, chứng chỉ "Mùa trăng Precision Coach", được feature trên trang cá nhân',
  },
  {
    title: 'Hoàn thành 70–99% chặng đường',
    detail: 'Giảm giá khoá học ở mức thấp hơn, chứng chỉ tham gia',
  },
  {
    title: 'Case study xuất sắc nhất',
    detail: '1 buổi mentor 1-1 riêng, không phụ thuộc % hoàn thành',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  rewardTiers: DEFAULT_REWARD_TIERS,
  weekThemes: [...WEEK_THEMES],
  moonFragments: [...MOON_FRAGMENTS],
  boxPrizes: MYSTERY_BOX_PRIZES.map((p) => ({ ...p })),
  scoring: {
    kien_thuc: { ...SCORING.kien_thuc },
    quiz_tuan: { ...SCORING.quiz_tuan },
    thu_thach: { ...SCORING.thu_thach },
    webinar: { ...SCORING.webinar },
    case_study: { ...SCORING.case_study },
    mysteryBoxChance: MYSTERY_BOX_CHANCE,
    rabbitDayPoints: RABBIT_DAY_POINTS,
    carrotPoints: CARROT_POINTS,
  },
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

/** Danh sách 6 phần tử — thiếu chỗ nào lấy mặc định chỗ đó. */
function parseSix(raw: unknown, fallback: readonly string[]): string[] {
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
  const s = raw as Record<string, Record<string, unknown> | number>;
  const grp = (k: string) => (typeof s[k] === 'object' && s[k] ? (s[k] as Record<string, unknown>) : {});

  return {
    kien_thuc: {
      base: Math.round(num(grp('kien_thuc').base, d.kien_thuc.base, 0, 100)),
      perCorrect: Math.round(num(grp('kien_thuc').perCorrect, d.kien_thuc.perCorrect, 0, 100)),
    },
    quiz_tuan: {
      base: Math.round(num(grp('quiz_tuan').base, d.quiz_tuan.base, 0, 100)),
      bonus: Math.round(num(grp('quiz_tuan').bonus, d.quiz_tuan.bonus, 0, 100)),
      threshold: num(grp('quiz_tuan').threshold, d.quiz_tuan.threshold, 0, 1),
    },
    thu_thach: { base: Math.round(num(grp('thu_thach').base, d.thu_thach.base, 0, 100)) },
    webinar: { base: Math.round(num(grp('webinar').base, d.webinar.base, 0, 100)) },
    case_study: { base: Math.round(num(grp('case_study').base, d.case_study.base, 0, 100)) },
    mysteryBoxChance: num(s.mysteryBoxChance, d.mysteryBoxChance, 0, 1),
    rabbitDayPoints: Math.round(num(s.rabbitDayPoints, d.rabbitDayPoints, 0, 200)),
    carrotPoints: Math.round(num(s.carrotPoints, d.carrotPoints, 0, 100)),
  };
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
    weekThemes: parseSix(map.get(SETTING_KEYS.weekThemes), WEEK_THEMES),
    moonFragments: parseSix(map.get(SETTING_KEYS.moonFragments), MOON_FRAGMENTS),
    boxPrizes: parseBoxPrizes(map.get(SETTING_KEYS.boxPrizes)),
    scoring: parseScoring(map.get(SETTING_KEYS.scoring)),
  };
});

// ─── Ghi ────────────────────────────────────────────────────────────────────

export async function saveSetting(key: string, value: unknown): Promise<{ error?: string }> {
  const { error } = await db()
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { error: error.message } : {};
}

/** Tổng điểm tối đa của cả mùa, tính theo bảng điểm đang dùng. */
export function maxPoints(s: ScoringConfig): number {
  return (
    24 * (s.kien_thuc.base + s.kien_thuc.perCorrect) +
    6 * (s.quiz_tuan.base + s.quiz_tuan.bonus) +
    6 * s.thu_thach.base +
    6 * s.webinar.base +
    4 * s.case_study.base
  );
}
