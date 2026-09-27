import 'server-only';
import { cache } from 'react';
import { db, fetchAllRows } from './supabase';
import {
  MILESTONES,
  TIERS,
  UNLOCK_DEEP_TIER,
  UNLOCK_TIP_TIER,
  isNeutralDay,
  type DayType,
  type TierIndex,
} from './scoring';
import { applyMultiplier, getSettings } from './settings';
import {
  RIBBON_WEEKS,
  TOTAL_DAYS,
  WEEKS,
  dayNumberFor,
  maxUnlockedDay,
  rawDayNumber,
} from './event';
import { MAKEUP_DAYS, computeBloom, type Bloom } from './bloom';
import type {
  CheckinResult,
  CheckinRow,
  DayRow,
  PlayerRow,
  PublicQuestion,
  QuestionRow,
  RewardRow,
  SubmissionRow,
} from './types';

type Gift = { title: string; detail: string; points: number };

// ═══════════════════════════════════════════════════════════════════════════
// Đọc dữ liệu
// ═══════════════════════════════════════════════════════════════════════════

export async function findPlayerByCode(code: string): Promise<PlayerRow | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const { data } = await db()
    .from('players')
    .select('*')
    .eq('code', clean)
    .maybeSingle();
  return (data as PlayerRow) ?? null;
}

export async function getPlayer(playerId: string): Promise<PlayerRow | null> {
  const { data } = await db().from('players').select('*').eq('id', playerId).maybeSingle();
  return (data as PlayerRow) ?? null;
}

/** Một ngày đầy đủ — kể cả mã điểm danh và nội dung mở khoá. Chỉ dùng ở server. */
export async function getDay(day: number): Promise<DayRow | null> {
  const { data } = await db().from('days').select('*').eq('day', day).maybeSingle();
  return (data as DayRow) ?? null;
}

export async function getAllDays(): Promise<DayRow[]> {
  const { data } = await db()
    .from('days')
    .select('day,date,weekday,week,phase,week_theme,day_type,title,prompt,mechanic,webinar_at,webinar_link,body')
    .order('day');
  return (data as DayRow[]) ?? [];
}

/** Loại của từng ngày — đủ để biết ngày nào là Trạm hoa (trung tính). */
const getDayTypes = cache(async (): Promise<Map<number, DayType>> => {
  const { data } = await db().from('days').select('day,day_type');
  return new Map(((data ?? []) as { day: number; day_type: DayType }[]).map((d) => [d.day, d.day_type]));
});

/** Câu hỏi kèm đáp án — chỉ dùng trong code server. */
async function getQuestionsWithAnswers(day: number): Promise<QuestionRow[]> {
  const { data } = await db().from('questions').select('*').eq('day', day).order('ord');
  return (data as QuestionRow[]) ?? [];
}

/** Câu hỏi đã bỏ đáp án — an toàn để gửi xuống trình duyệt. */
export async function getPublicQuestions(day: number): Promise<PublicQuestion[]> {
  const rows = await getQuestionsWithAnswers(day);
  return rows.map((q) => ({ id: q.id, ord: q.ord, prompt: q.prompt, options: q.options }));
}

export async function getCheckins(playerId: string): Promise<CheckinRow[]> {
  const { data } = await db()
    .from('checkins')
    .select('day,correct_count,total_count,points_awarded,by_freeze,late,created_at')
    .eq('player_id', playerId)
    .order('day');
  return (data as CheckinRow[]) ?? [];
}

/** Dải ruy băng đã nhận — lưu ở bảng `fragments` của mùa trước. */
export async function getRibbons(playerId: string): Promise<{ week: number; name: string }[]> {
  const { data } = await db()
    .from('fragments')
    .select('week,name')
    .eq('player_id', playerId)
    .order('week');
  return (data as { week: number; name: string }[]) ?? [];
}

export async function getRewards(playerId: string): Promise<RewardRow[]> {
  const { data } = await db()
    .from('rewards')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  return (data as RewardRow[]) ?? [];
}

export async function getSubmission(playerId: string, day: number): Promise<SubmissionRow | null> {
  const { data } = await db()
    .from('submissions')
    .select('*')
    .eq('player_id', playerId)
    .eq('day', day)
    .maybeSingle();
  return (data as SubmissionRow) ?? null;
}

export async function getSubmissions(playerId: string): Promise<SubmissionRow[]> {
  const { data } = await db()
    .from('submissions')
    .select('*')
    .eq('player_id', playerId)
    .order('day');
  return (data as SubmissionRow[]) ?? [];
}

/** Câu trả lời người chơi đã chọn ở một ngày. */
export async function getAnswers(
  playerId: string,
  day: number,
): Promise<Record<string, { chosen: number; correct: boolean }>> {
  const { data } = await db()
    .from('answers')
    .select('question_id,chosen_index,is_correct')
    .eq('player_id', playerId)
    .eq('day', day);
  const out: Record<string, { chosen: number; correct: boolean }> = {};
  for (const r of (data ?? []) as { question_id: string; chosen_index: number; is_correct: boolean }[]) {
    out[r.question_id] = { chosen: r.chosen_index, correct: r.is_correct };
  }
  return out;
}

/** Đáp án + giải thích, chỉ gọi sau khi người chơi đã nộp bài ngày đó. */
export async function getReveal(day: number) {
  const rows = await getQuestionsWithAnswers(day);
  return rows.map((q) => ({
    questionId: q.id,
    correctIndex: q.correct_index ?? 0,
    explain: q.explain,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Cây hoa: chuỗi, tầng, giọt sương
// ═══════════════════════════════════════════════════════════════════════════

/** Ngày đầu tiên người chơi được tính chuỗi — không phạt những ngày trước khi họ có mã. */
function joinDayOf(player: PlayerRow): number {
  const joined = player.joined_at?.slice(0, 10);
  const n = joined ? dayNumberFor(joined) : 1;
  return n ?? 1;
}

/**
 * Dựng cây hoa của một người từ danh sách ngày đã làm. `extra` là một ngày
 * đang chuẩn bị ghi — tính trước để biết điểm của nó nhân với tầng nào.
 */
async function bloomFor(
  player: PlayerRow,
  checkins: CheckinRow[],
  extra?: { day: number; late: boolean },
): Promise<Bloom> {
  const [types, garden] = await Promise.all([getDayTypes(), getGardenSummary()]);
  const neutral = new Set([...types.entries()].filter(([, t]) => isNeutralDay(t)).map(([d]) => d));
  const marks = new Map(
    checkins.filter((c) => !c.by_freeze).map((c) => [c.day, { late: Boolean(c.late) }] as const),
  );
  if (extra) marks.set(extra.day, { late: extra.late });

  return computeBloom({
    today: rawDayNumber(),
    totalDays: TOTAL_DAYS,
    joinDay: joinDayOf(player),
    neutral,
    marks,
    dews: (player.dews ?? 0) + garden.dewBonus,
  });
}

/** Cây hoa hiện tại của người chơi — dùng cho các trang hiển thị. */
export async function getBloom(player: PlayerRow): Promise<Bloom> {
  return bloomFor(player, await getCheckins(player.id));
}

/**
 * Nội dung mở khoá của một ngày. Đủ tầng thì mở: hoặc tầng hiện tại đủ cao,
 * hoặc hôm làm ngày đó đang ở tầng đủ cao — cái đã giành được thì giữ lại.
 * Chưa đủ tầng thì chỉ trả về cờ "đang khoá", nội dung không rời server.
 */
export function unlockedExtras(dayRow: DayRow, bloom: Bloom) {
  const earned = bloom.cells[dayRow.day - 1];
  const earnedTier =
    earned && (earned.state === 'done' || earned.state === 'late') ? earned.tier : 0;
  const reach = Math.max(bloom.tier, earnedTier);

  const tip = dayRow.bonus_tip?.trim() || null;
  const deep = dayRow.bonus_deep?.trim() || null;
  return {
    tip: tip && reach >= UNLOCK_TIP_TIER ? tip : null,
    tipLocked: Boolean(tip) && reach < UNLOCK_TIP_TIER,
    deep: deep && reach >= UNLOCK_DEEP_TIER ? deep : null,
    deepLocked: Boolean(deep) && reach < UNLOCK_DEEP_TIER,
  };
}

/**
 * Thưởng những mốc tầng và lần hồi xuân chưa từng thưởng. Chỉ số duy nhất
 * trong DB chặn thưởng trùng, nên gọi lại bao nhiêu lần cũng an toàn.
 */
async function grantBloomEvents(playerId: string, bloom: Bloom): Promise<Gift[]> {
  if (!bloom.events.length) return [];
  const { data } = await db()
    .from('rewards')
    .select('kind,day')
    .eq('player_id', playerId)
    .in('kind', ['moc_3', 'moc_7', 'moc_14', 'hoi_xuan']);
  const have = new Set(((data ?? []) as { kind: string; day: number | null }[]).map((r) =>
    r.kind === 'hoi_xuan' ? `hoi_xuan:${r.day}` : r.kind,
  ));

  const { scoring } = await getSettings();
  const gifts: Gift[] = [];

  for (const ev of bloom.events) {
    const key = ev.kind === 'hoi_xuan' ? `hoi_xuan:${ev.day}` : ev.kind;
    if (have.has(key)) continue;

    const gift: Gift =
      ev.kind === 'hoi_xuan'
        ? {
            title: 'Hồi xuân',
            detail:
              'Ba ngày liền sau một quãng nghỉ — cây của bạn tỉnh dậy và lấy lại một nửa chuỗi cũ. Quay lại luôn khó hơn bắt đầu, và bạn vừa làm được.',
            points: scoring.comebackPoints,
          }
        : (() => {
            const m = MILESTONES.find((x) => x.kind === ev.kind)!;
            return { title: `Chạm tầng ${m.title}`, detail: m.detail, points: m.points };
          })();

    const { error } = await db().from('rewards').insert({
      player_id: playerId,
      kind: ev.kind,
      day: ev.day,
      title: gift.title,
      detail: gift.detail,
      points: gift.points,
    });
    if (!error) gifts.push(gift);
  }
  return gifts;
}

// ═══════════════════════════════════════════════════════════════════════════
// Vườn chung
// ═══════════════════════════════════════════════════════════════════════════

export type GardenDay = { day: number; participants: number; active: number; sunny: boolean };

/**
 * Chốt sổ vườn chung cho những ngày đã qua mà chưa ai chốt. Người đầu tiên mở
 * app sau nửa đêm làm việc này; đếm theo người học đúng hạn, học bù không tính
 * — vườn chung là chuyện "hôm đó cả lớp có mặt không".
 */
async function settleGarden(): Promise<void> {
  const lastClosed = Math.min(rawDayNumber() - 1, TOTAL_DAYS);
  if (lastClosed < 1) return;

  const supabase = db();
  const { data: settled } = await supabase.from('garden_days').select('day');
  const have = new Set(((settled ?? []) as { day: number }[]).map((r) => r.day));
  const pending = Array.from({ length: lastClosed }, (_, i) => i + 1).filter((d) => !have.has(d));
  if (!pending.length) return;

  const { scoring } = await getSettings();
  const [{ count: active }, rows] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('is_active', true),
    fetchAllRows<{ player_id: string; day: number }>((f, t) =>
      supabase
        .from('checkins')
        .select('player_id,day')
        .in('day', pending)
        .eq('late', false)
        .eq('by_freeze', false)
        .range(f, t),
    ),
  ]);

  const byDay = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!byDay.has(r.day)) byDay.set(r.day, new Set());
    byDay.get(r.day)!.add(r.player_id);
  }

  const total = active ?? 0;
  await supabase.from('garden_days').upsert(
    pending.map((day) => {
      const participants = byDay.get(day)?.size ?? 0;
      return {
        day,
        participants,
        active: total,
        sunny: total > 0 && participants / total >= scoring.garden.threshold,
      };
    }),
    { onConflict: 'day', ignoreDuplicates: true },
  );
}

export type GardenSummary = {
  days: GardenDay[];
  sunnyCount: number;
  /** Giọt sương cả lớp được thêm nhờ ngày nắng. */
  dewBonus: number;
  /** Còn mấy ngày nắng nữa thì cả lớp có thêm giọt kế tiếp. */
  sunnyToNextDew: number;
  today: { day: number; participants: number; active: number } | null;
  threshold: number;
  points: number;
};

export const getGardenSummary = cache(async (): Promise<GardenSummary> => {
  const supabase = db();
  const { scoring } = await getSettings();
  const todayNum = rawDayNumber();

  const { data } = await supabase.from('garden_days').select('day,participants,active,sunny').order('day');
  const days = (data ?? []) as GardenDay[];
  const sunnyCount = days.filter((d) => d.sunny).length;
  const per = scoring.garden.sunnyPerDew;

  let today: GardenSummary['today'] = null;
  if (todayNum >= 1 && todayNum <= TOTAL_DAYS) {
    const [{ count: active }, { data: rows }] = await Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('checkins').select('player_id').eq('day', todayNum).eq('late', false),
    ]);
    const participants = new Set(((rows ?? []) as { player_id: string }[]).map((r) => r.player_id)).size;
    today = { day: todayNum, participants, active: active ?? 0 };
  }

  return {
    days,
    sunnyCount,
    dewBonus: Math.floor(sunnyCount / per),
    sunnyToNextDew: per - (sunnyCount % per),
    today,
    threshold: scoring.garden.threshold,
    points: scoring.garden.points,
  };
});

/** Cộng điểm những ngày nắng người chơi đã góp mặt mà chưa nhận. */
async function claimGardenBonus(player: PlayerRow, checkins: CheckinRow[], garden: GardenSummary): Promise<Gift[]> {
  const onTime = new Set(checkins.filter((c) => !c.late && !c.by_freeze).map((c) => c.day));
  const sunny = garden.days.filter((d) => d.sunny && onTime.has(d.day)).map((d) => d.day);
  if (!sunny.length || !garden.points) return [];

  const { data } = await db()
    .from('rewards')
    .select('day')
    .eq('player_id', player.id)
    .eq('kind', 'vuon_chung');
  const have = new Set(((data ?? []) as { day: number }[]).map((r) => r.day));

  const gifts: Gift[] = [];
  for (const day of sunny) {
    if (have.has(day)) continue;
    const gift = {
      title: `Ngày nắng — ngày ${day}`,
      detail: 'Hôm đó đủ đông người cùng học đúng hạn, vườn chung được nắng. Bạn là một trong số đó.',
      points: garden.points,
    };
    const { error } = await db()
      .from('rewards')
      .insert({ player_id: player.id, kind: 'vuon_chung', day, ...gift });
    if (!error) gifts.push(gift);
  }
  return gifts;
}

/**
 * Chăm cây mỗi lần người chơi mở trang: chốt sổ vườn chung, nhận điểm ngày
 * nắng còn nợ, tính lại cây và ghi chuỗi mới nhất vào hồ sơ (để trang admin
 * thấy đúng cả khi người chơi đã bỏ vài ngày mà chưa quay lại check-in).
 */
export async function tendPlayer(player: PlayerRow): Promise<{
  player: PlayerRow;
  bloom: Bloom;
  garden: GardenSummary;
  checkins: CheckinRow[];
}> {
  await settleGarden();
  const [garden, checkins] = await Promise.all([getGardenSummary(), getCheckins(player.id)]);

  const gardenGifts = await claimGardenBonus(player, checkins, garden);
  const bloom = await bloomFor(player, checkins);
  const bloomGifts = await grantBloomEvents(player.id, bloom);

  const bonus = [...gardenGifts, ...bloomGifts].reduce((s, g) => s + g.points, 0);
  const next: PlayerRow = {
    ...player,
    points: player.points + bonus,
    streak: bloom.streak,
    best_streak: Math.max(player.best_streak, bloom.best),
    freezes_used: bloom.dewsUsed,
  };

  if (
    bonus ||
    next.streak !== player.streak ||
    next.best_streak !== player.best_streak ||
    next.freezes_used !== player.freezes_used
  ) {
    await db()
      .from('players')
      .update({
        points: next.points,
        streak: next.streak,
        best_streak: next.best_streak,
        freezes_used: next.freezes_used,
      })
      .eq('id', player.id);
  }

  return { player: next, bloom, garden, checkins };
}

// ═══════════════════════════════════════════════════════════════════════════
// Check-in — trái tim của luật chơi
// ═══════════════════════════════════════════════════════════════════════════

type CheckinInput = {
  playerId: string;
  day: number;
  /** questionId → chỉ số lựa chọn */
  answers?: Record<string, number>;
  /** Mã điểm danh, chỉ dùng cho ngày Trạm hoa. */
  webinarCode?: string;
};

/**
 * Ngày này còn ghi nhận được không, và nếu được thì có phải học bù không.
 * Dùng chung cho check-in và nộp bài.
 */
function timing(day: number): { ok: true; late: boolean } | { ok: false; message: string } {
  const today = rawDayNumber();
  if (day < 1 || day > TOTAL_DAYS) return { ok: false, message: 'Ngày không hợp lệ.' };
  if (day > maxUnlockedDay()) {
    return { ok: false, message: 'Ngày này chưa mở. Cành hoa mọc từng đốt một, không có đường tắt.' };
  }
  if (day < today - MAKEUP_DAYS) {
    return {
      ok: false,
      message: 'Ngày này đã quá 48 giờ học bù. Bạn vẫn đọc lại được, chỉ là không ghi nhận nữa.',
    };
  }
  return { ok: true, late: day < today };
}

export async function checkIn(input: CheckinInput): Promise<CheckinResult> {
  const supabase = db();
  const { playerId, day } = input;

  const player = await getPlayer(playerId);
  if (!player) return { ok: false, message: 'Không tìm thấy mã của bạn. Thử đăng nhập lại nhé.' };
  if (!player.is_active) return { ok: false, message: 'Mã này đang tạm khoá. Bạn nhắn cho mình để mở lại.' };

  const when = timing(day);
  if (!when.ok) return { ok: false, message: when.message };

  const dayRow = await getDay(day);
  if (!dayRow) return { ok: false, message: 'Chưa có nội dung cho ngày này.' };

  const existing = await getCheckins(playerId);
  if (existing.some((c) => c.day === day && !c.by_freeze)) {
    return { ok: false, message: 'Bạn đã hoàn thành ngày này rồi.' };
  }

  const dayType = dayRow.day_type as DayType;

  // ─── Trạm hoa cần mã điểm danh, và không học bù được ─────────────────────
  if (dayType === 'webinar') {
    if (when.late) {
      return {
        ok: false,
        message:
          'Trạm hoa không điểm danh bù được. Nhưng đừng lo: vắng Trạm hoa không làm héo hoa của bạn.',
      };
    }
    const expected = (dayRow.webinar_code ?? '').trim().toUpperCase();
    const given = (input.webinarCode ?? '').trim().toUpperCase();
    if (!expected) {
      return { ok: false, message: 'Mã điểm danh của buổi này chưa được mở. Đợi mình công bố trong buổi nhé.' };
    }
    if (given !== expected) {
      return { ok: false, message: 'Mã điểm danh chưa đúng. Mã được đọc ở cuối buổi Trạm hoa.' };
    }
  }

  // ─── Ngày cần nộp bài thì không check-in qua đây ─────────────────────────
  if (dayType === 'thu_thach' || dayType === 'case_study') {
    return { ok: false, message: 'Ngày này bạn nộp bài ở khung bên dưới, không cần bấm hoàn thành.' };
  }

  // ─── Chấm quiz ──────────────────────────────────────────────────────────
  const questions = await getQuestionsWithAnswers(day);
  const given = input.answers ?? {};
  let correct = 0;
  const answerRows: {
    player_id: string;
    question_id: string;
    day: number;
    chosen_index: number;
    is_correct: boolean;
  }[] = [];

  for (const q of questions) {
    const chosen = given[q.id];
    if (chosen === undefined || chosen === null) continue;
    const isCorrect = chosen === q.correct_index;
    if (isCorrect) correct++;
    answerRows.push({
      player_id: playerId,
      question_id: q.id,
      day,
      chosen_index: chosen,
      is_correct: isCorrect,
    });
  }

  if (questions.length > 0 && answerRows.length < questions.length) {
    return {
      ok: false,
      message:
        questions.length === 1
          ? 'Bạn chọn một đáp án trước đã — sai cũng không sao, cây vẫn lớn.'
          : `Còn ${questions.length - answerRows.length} câu chưa chọn đáp án.`,
    };
  }

  // ─── Điểm gốc ───────────────────────────────────────────────────────────
  const settings = await getSettings();
  const scoring = settings.scoring;
  let raw = 0;
  const gifts: Gift[] = [];
  let quizBonus: Gift | null = null;

  if (dayType === 'kien_thuc') {
    raw = scoring.kien_thuc.base + correct * scoring.kien_thuc.perCorrect;
  } else if (dayType === 'quiz_tuan') {
    raw = scoring.quiz_tuan.base;
    const ratio = questions.length ? correct / questions.length : 0;
    if (ratio >= scoring.quiz_tuan.threshold) {
      raw += scoring.quiz_tuan.bonus;
      quizBonus = {
        title: 'Thưởng quiz tuần',
        detail: `Bạn đúng ${correct}/${questions.length} câu của tuần này.`,
        points: scoring.quiz_tuan.bonus,
      };
    }
  } else if (dayType === 'webinar') {
    raw = scoring.webinar.base;
  }

  // ─── Nhân theo tầng hoa ─────────────────────────────────────────────────
  // Tính cây như thể ngày này đã ghi, để biết hôm nay rơi vào tầng nào — kể
  // cả khi chính hôm nay đẩy chuỗi lên tầng mới hoặc là ngày hồi xuân.
  const bloom = await bloomFor(player, existing, { day, late: when.late });
  const tier = (bloom.cells[day - 1]?.tier ?? 0) as TierIndex;
  const multiplier = when.late ? 1 : scoring.multipliers[tier] ?? 1;
  const points = when.late ? raw : applyMultiplier(raw, tier, scoring);
  if (quizBonus) gifts.push(quizBonus);

  // ─── Ghi check-in ───────────────────────────────────────────────────────
  const { error: ciErr } = await supabase.from('checkins').upsert(
    {
      player_id: playerId,
      day,
      correct_count: correct,
      total_count: questions.length,
      points_awarded: points,
      by_freeze: false,
      late: when.late,
    },
    { onConflict: 'player_id,day' },
  );
  if (ciErr) return { ok: false, message: 'Không lưu được, bạn thử lại giúp mình.' };

  if (answerRows.length) {
    await supabase.from('answers').upsert(answerRows, { onConflict: 'player_id,question_id' });
  }

  let bonus = 0;

  // ─── Bông hoa bí mật — chỉ ai có mặt đúng hôm đó ───────────────────────
  if (!when.late) {
    const secret = await grantSecretDay(playerId, day);
    if (secret) {
      bonus += secret.points;
      gifts.push(secret);
    }
  }

  // ─── Ruy băng khi dự Trạm hoa ───────────────────────────────────────────
  let ribbonAwarded: string | undefined;
  if (dayType === 'webinar' && dayRow.week >= 1 && dayRow.week <= RIBBON_WEEKS) {
    const name = settings.ribbons[dayRow.week - 1];
    const { error } = await supabase
      .from('fragments')
      .insert({ player_id: playerId, week: dayRow.week, name });
    if (!error) ribbonAwarded = name;
  }

  // ─── Mốc tầng, hồi xuân ─────────────────────────────────────────────────
  const events = await grantBloomEvents(playerId, bloom);
  for (const g of events) {
    bonus += g.points;
    gifts.push(g);
  }

  await supabase
    .from('players')
    .update({
      points: player.points + points + bonus,
      streak: bloom.streak,
      best_streak: Math.max(player.best_streak, bloom.best),
      freezes_used: bloom.dewsUsed,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  const reveal = questions.map((q) => ({
    questionId: q.id,
    correctIndex: q.correct_index ?? 0,
    explain: q.explain,
  }));

  return {
    ok: true,
    message: when.late
      ? 'Đã học bù. Bông hoa của ngày này nở lại trên cành của bạn.'
      : dayType === 'webinar'
        ? 'Điểm danh xong. Bạn vừa nhận thêm một dải ruy băng cho bó hoa.'
        : dayType === 'dem_hoi'
          ? 'Bó hoa của bạn đã buộc xong. Chúc mừng 20/10 — cảm ơn bạn đã đi cùng mình mùa này.'
          : 'Cành hoa của bạn vừa mọc thêm một đốt.',
    pointsAwarded: points + bonus,
    correctCount: correct,
    totalCount: questions.length,
    reveal,
    ribbonAwarded,
    gifts,
    streak: bloom.streak,
    tierName: TIERS[tier].name,
    multiplier,
    late: when.late,
  };
}

/**
 * Bông hoa bí mật — ngày chọn ngẫu nhiên lúc seed, lưu trong bảng
 * secret_days mà trình duyệt không đọc được. Chỉ lộ ra đúng lúc người chơi
 * check-in trúng ngày đó.
 */
async function grantSecretDay(playerId: string, day: number): Promise<Gift | null> {
  const { data } = await db().from('secret_days').select('*').eq('day', day).maybeSingle();
  if (!data) return null;

  const settings = await getSettings();
  const points = data.points ?? settings.scoring.secretDayPoints;
  const { error } = await db().from('rewards').insert({
    player_id: playerId,
    kind: 'hoa_bi_mat',
    day,
    title: data.title,
    detail: data.detail,
    points,
  });
  if (error) return null; // đã nhận rồi

  return { title: data.title, detail: data.detail, points };
}

// ═══════════════════════════════════════════════════════════════════════════
// Nộp bài: thử thách áp dụng & case study về đích
// ═══════════════════════════════════════════════════════════════════════════

export async function submitWork(args: {
  playerId: string;
  day: number;
  body: string;
  files: { path: string; name: string; size: number }[];
}): Promise<CheckinResult> {
  const supabase = db();
  const { playerId, day } = args;

  const player = await getPlayer(playerId);
  if (!player) return { ok: false, message: 'Không tìm thấy mã của bạn.' };

  if (day > maxUnlockedDay()) return { ok: false, message: 'Ngày này chưa mở.' };

  const dayRow = await getDay(day);
  if (!dayRow) return { ok: false, message: 'Chưa có nội dung cho ngày này.' };

  const kind = dayRow.day_type as DayType;
  if (kind !== 'thu_thach' && kind !== 'case_study') {
    return { ok: false, message: 'Ngày này không nhận bài nộp.' };
  }

  const text = args.body.trim();
  if (text.length < 40 && args.files.length === 0) {
    return { ok: false, message: 'Bài còn ngắn quá — viết thêm vài dòng hoặc đính kèm file giúp mình nhé.' };
  }

  const already = await getSubmission(playerId, day);

  // Bài đã nộp thì sửa lúc nào cũng được — chỉ lần nộp đầu mới tính điểm và
  // mới cần nằm trong khung học bù.
  const when = already ? ({ ok: true, late: false } as const) : timing(day);
  if (!when.ok) return { ok: false, message: when.message };

  await supabase.from('submissions').upsert(
    {
      player_id: playerId,
      day,
      kind,
      body: text,
      files: args.files,
      status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,day' },
  );

  if (already) {
    return { ok: true, message: 'Đã cập nhật bài nộp của bạn.', pointsAwarded: 0 };
  }

  const existing = await getCheckins(playerId);
  const bloom = await bloomFor(player, existing, { day, late: when.late });
  const tier = (bloom.cells[day - 1]?.tier ?? 0) as TierIndex;

  const { scoring } = await getSettings();
  const raw = kind === 'thu_thach' ? scoring.thu_thach.base : scoring.case_study.base;
  const points = when.late ? raw : applyMultiplier(raw, tier, scoring);

  await supabase.from('checkins').upsert(
    {
      player_id: playerId,
      day,
      correct_count: 0,
      total_count: 0,
      points_awarded: points,
      by_freeze: false,
      late: when.late,
    },
    { onConflict: 'player_id,day' },
  );

  const gifts: Gift[] = [];
  let bonus = 0;

  // Hộp quà bí ẩn — chỉ sau thử thách áp dụng, tối đa 1 lần/tuần/người.
  if (kind === 'thu_thach') {
    const box = await rollMysteryBox(playerId, dayRow.week, day);
    if (box) {
      bonus += box.points;
      gifts.push(box);
    }
  }

  if (!when.late) {
    const secret = await grantSecretDay(playerId, day);
    if (secret) {
      bonus += secret.points;
      gifts.push(secret);
    }
  }

  for (const g of await grantBloomEvents(playerId, bloom)) {
    bonus += g.points;
    gifts.push(g);
  }

  await supabase
    .from('players')
    .update({
      points: player.points + points + bonus,
      streak: bloom.streak,
      best_streak: Math.max(player.best_streak, bloom.best),
      freezes_used: bloom.dewsUsed,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  return {
    ok: true,
    message: when.late
      ? 'Đã nhận bài học bù. Bông hoa của ngày này nở lại trên cành của bạn.'
      : kind === 'thu_thach'
        ? 'Đã nhận bài. Cành hoa của bạn vừa mọc thêm một đốt.'
        : 'Đã nhận case study. Chỉ còn một bước nữa là buộc bó hoa.',
    pointsAwarded: points + bonus,
    gifts,
    streak: bloom.streak,
    tierName: TIERS[tier].name,
    multiplier: when.late ? 1 : scoring.multipliers[tier] ?? 1,
    late: when.late,
  };
}

async function rollMysteryBox(playerId: string, week: number, day: number): Promise<Gift | null> {
  const { boxPrizes, scoring } = await getSettings();
  if (!boxPrizes.length) return null;
  if (Math.random() > scoring.mysteryBoxChance) return null;
  const prize = boxPrizes[Math.floor(Math.random() * boxPrizes.length)];
  const { error } = await db().from('rewards').insert({
    player_id: playerId,
    kind: 'hop_qua',
    week,
    day,
    title: `Hộp quà bí ẩn — ${prize.title}`,
    detail: prize.detail,
    points: prize.points,
  });
  if (error) return null; // tuần này đã có hộp quà
  return { title: `Hộp quà bí ẩn — ${prize.title}`, detail: prize.detail, points: prize.points };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tặng hoa (bảng `carrot_gifts` của mùa trước)
// ═══════════════════════════════════════════════════════════════════════════

export async function giveFlower(
  fromPlayerId: string,
  toCode: string,
  message: string,
): Promise<{ ok: boolean; message: string }> {
  const target = await findPlayerByCode(toCode);
  if (!target) return { ok: false, message: 'Không tìm thấy mã đó.' };
  if (target.id === fromPlayerId) return { ok: false, message: 'Bông hoa này để dành tặng bạn khác nhé.' };

  const { scoring } = await getSettings();
  const giftPoints = scoring.giftPoints;

  const { error } = await db().from('carrot_gifts').insert({
    from_player_id: fromPlayerId,
    to_player_id: target.id,
    points: giftPoints,
    message: message.slice(0, 200),
  });
  if (error) return { ok: false, message: 'Bạn đã tặng hoa cho người này rồi.' };

  await db()
    .from('players')
    .update({ points: target.points + giftPoints })
    .eq('id', target.id);

  await db().from('rewards').insert({
    player_id: target.id,
    kind: 'tang_hoa',
    title: 'Có người tặng bạn một bông hoa',
    detail: message.slice(0, 200) || 'Một người bạn cùng lớp vừa gửi điểm tiếp sức cho bạn.',
    points: giftPoints,
  });

  return { ok: true, message: `Đã gửi ${giftPoints} điểm cho ${target.display_name}.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bảng vinh danh mềm — random top 10% mỗi tuần, không xếp hạng công khai
// ═══════════════════════════════════════════════════════════════════════════

export async function getHonorRoll(week: number): Promise<{ name: string; note: string | null }[]> {
  const { data } = await db()
    .from('honor_roll')
    .select('note, players(display_name)')
    .eq('week', week);
  // Supabase khai báo quan hệ lồng nhau là mảng, thực tế trả về một bản ghi.
  type Joined = { note: string | null; players: { display_name: string } | { display_name: string }[] | null };
  return ((data ?? []) as unknown as Joined[])
    .map((r) => {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      return p ? { name: p.display_name, note: r.note } : null;
    })
    .filter((r): r is { name: string; note: string | null } => r !== null);
}

/**
 * Bốc ngẫu nhiên 10% người chơi có hoạt động trong tuần. Bấm nút này ở trang
 * admin sau mỗi tuần. Không xếp hạng, không so sánh điểm công khai.
 */
export async function drawHonorRoll(week: number): Promise<{ ok: boolean; message: string }> {
  const range = WEEKS.find((w) => w.week === week);
  if (!range) return { ok: false, message: 'Tuần không hợp lệ.' };

  const { data } = await db()
    .from('checkins')
    .select('player_id')
    .gte('day', range.first)
    .lte('day', range.last)
    .eq('by_freeze', false);

  const ids = [...new Set(((data ?? []) as { player_id: string }[]).map((r) => r.player_id))];
  if (!ids.length) return { ok: false, message: 'Tuần này chưa có ai check-in.' };

  const take = Math.max(1, Math.ceil(ids.length * 0.1));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const picked = ids.slice(0, take);

  await db().from('honor_roll').delete().eq('week', week);
  await db()
    .from('honor_roll')
    .insert(picked.map((id) => ({ week, player_id: id, note: null })));

  return { ok: true, message: `Đã bốc ${picked.length} người trong ${ids.length} người có mặt tuần ${week}.` };
}
