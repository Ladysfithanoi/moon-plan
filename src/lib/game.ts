import 'server-only';
import { db } from './supabase';
import { type DayType } from './scoring';
import { getSettings } from './settings';
import { TOTAL_DAYS, dayNumberFor, maxUnlockedDay, vnToday } from './event';
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

/**
 * Nếu bật, mảnh trăng chỉ trao khi người chơi vừa dự webinar vừa hoàn thành đủ
 * 6 ngày trước đó của tuần. Mặc định tắt cho nhẹ nhàng — đúng cột "cơ chế" trong
 * khung nội dung: dự webinar là nhận mảnh trăng.
 */
const FRAGMENT_REQUIRES_FULL_WEEK = false;

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
    .select('day,correct_count,total_count,points_awarded,by_freeze,created_at')
    .eq('player_id', playerId)
    .order('day');
  return (data as CheckinRow[]) ?? [];
}

export async function getFragments(playerId: string): Promise<{ week: number; name: string }[]> {
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
// Chuỗi ngày (streak)
// ═══════════════════════════════════════════════════════════════════════════

/** Số ngày liên tiếp tính ngược từ `upto`. */
export function streakEndingAt(days: number[], upto: number): number {
  const set = new Set(days);
  let n = 0;
  for (let d = upto; d >= 1; d--) {
    if (!set.has(d)) break;
    n++;
  }
  return n;
}

/** Ngày đầu tiên người chơi được tính streak — không phạt những ngày trước khi họ có mã. */
function joinDayOf(player: PlayerRow): number {
  const joined = player.joined_at?.slice(0, 10);
  const n = joined ? dayNumberFor(joined) : 1;
  return n ?? 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// Check-in — trái tim của luật chơi
// ═══════════════════════════════════════════════════════════════════════════

type CheckinInput = {
  playerId: string;
  day: number;
  /** questionId → chỉ số lựa chọn */
  answers?: Record<string, number>;
  /** Mã điểm danh, chỉ dùng cho ngày webinar. */
  webinarCode?: string;
};

export async function checkIn(input: CheckinInput): Promise<CheckinResult> {
  const supabase = db();
  const { playerId, day } = input;

  const player = await getPlayer(playerId);
  if (!player) return { ok: false, message: 'Không tìm thấy mã của bạn. Thử đăng nhập lại nhé.' };
  if (!player.is_active) return { ok: false, message: 'Mã này đang tạm khoá. Bạn nhắn cho mình để mở lại.' };

  const today = vnToday();
  const unlocked = maxUnlockedDay(today);
  if (day > unlocked) {
    return { ok: false, message: 'Ngày này chưa mở. Vòng trăng đi từng bước một, không có đường tắt.' };
  }
  if (day < 1 || day > TOTAL_DAYS) return { ok: false, message: 'Ngày không hợp lệ.' };

  const dayRow = await getDay(day);
  if (!dayRow) return { ok: false, message: 'Chưa có nội dung cho ngày này.' };

  const existing = await getCheckins(playerId);
  if (existing.some((c) => c.day === day && !c.by_freeze)) {
    return { ok: false, message: 'Bạn đã hoàn thành ngày này rồi.' };
  }

  const dayType = dayRow.day_type as DayType;

  // ─── Ngày webinar cần mã điểm danh ──────────────────────────────────────
  if (dayType === 'webinar') {
    const { data: secret } = await supabase
      .from('days')
      .select('webinar_code')
      .eq('day', day)
      .maybeSingle();
    const expected = (secret?.webinar_code ?? '').trim().toUpperCase();
    const given = (input.webinarCode ?? '').trim().toUpperCase();
    if (!expected) {
      return { ok: false, message: 'Mã điểm danh của buổi này chưa được mở. Đợi mình công bố trong buổi nhé.' };
    }
    if (given !== expected) {
      return { ok: false, message: 'Mã điểm danh chưa đúng. Mã được đọc trong buổi trạm dừng gốc đa.' };
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
          ? 'Bạn chọn một đáp án trước đã — sai cũng không sao, thỏ vẫn đi tiếp.'
          : `Còn ${questions.length - answerRows.length} câu chưa chọn đáp án.`,
    };
  }

  // ─── Tính điểm ──────────────────────────────────────────────────────────
  const settings = await getSettings();
  const scoring = settings.scoring;
  let points = 0;
  const gifts: { title: string; detail: string; points: number }[] = [];

  if (dayType === 'kien_thuc') {
    points = scoring.kien_thuc.base + correct * scoring.kien_thuc.perCorrect;
  } else if (dayType === 'quiz_tuan') {
    points = scoring.quiz_tuan.base;
    const ratio = questions.length ? correct / questions.length : 0;
    if (ratio >= scoring.quiz_tuan.threshold) {
      points += scoring.quiz_tuan.bonus;
      gifts.push({
        title: 'Tia sáng bonus',
        detail: `Bạn đúng ${correct}/${questions.length} câu của tuần này.`,
        points: scoring.quiz_tuan.bonus,
      });
    }
  } else if (dayType === 'webinar') {
    points = scoring.webinar.base;
  }

  // ─── Vé cứu bù cho những ngày đã lỡ ─────────────────────────────────────
  const freezeResult = await applyFreezes(player, day, existing);

  // ─── Ghi check-in ───────────────────────────────────────────────────────
  const { error: ciErr } = await supabase.from('checkins').upsert(
    {
      player_id: playerId,
      day,
      correct_count: correct,
      total_count: questions.length,
      points_awarded: points,
      by_freeze: false,
    },
    { onConflict: 'player_id,day' },
  );
  if (ciErr) return { ok: false, message: 'Không lưu được, bạn thử lại giúp mình.' };

  if (answerRows.length) {
    await supabase.from('answers').upsert(answerRows, { onConflict: 'player_id,question_id' });
  }

  // ─── Ngày Thỏ Ngọc ──────────────────────────────────────────────────────
  const rabbit = await grantRabbitDay(playerId, day);
  if (rabbit) {
    points += rabbit.points;
    gifts.push(rabbit);
  }

  // ─── Mảnh trăng khi dự webinar ──────────────────────────────────────────
  let fragmentAwarded: string | undefined;
  if (dayType === 'webinar' && dayRow.week >= 1 && dayRow.week <= 6) {
    const eligible = FRAGMENT_REQUIRES_FULL_WEEK ? await hasFullWeek(playerId, dayRow.week) : true;
    if (eligible) {
      const name = settings.moonFragments[dayRow.week - 1];
      const { error } = await supabase
        .from('fragments')
        .insert({ player_id: playerId, week: dayRow.week, name });
      if (!error) fragmentAwarded = name;
    }
  }

  // ─── Cập nhật điểm & streak ─────────────────────────────────────────────
  const allDays = [...existing.map((c) => c.day), ...freezeResult.filledDays, day];
  const streak = streakEndingAt(allDays, day);

  await supabase
    .from('players')
    .update({
      points: player.points + points + freezeResult.pointsDelta,
      streak,
      best_streak: Math.max(player.best_streak, streak),
      freezes_left: player.freezes_left - freezeResult.used,
      freezes_used: player.freezes_used + freezeResult.used,
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
    message:
      dayType === 'webinar'
        ? 'Điểm danh xong. Thỏ của bạn vừa tới trạm dừng gốc đa.'
        : dayType === 'dem_hoi'
          ? 'Vòng khép lại đúng chỗ nó bắt đầu. Cảm ơn bạn đã chạy cùng mình mùa này.'
          : 'Thỏ vừa tiến thêm một bước trên vòng trăng.',
    pointsAwarded: points,
    correctCount: correct,
    totalCount: questions.length,
    reveal,
    fragmentAwarded,
    gifts,
    freezesUsed: freezeResult.used,
    streak,
  };
}

/**
 * Vé cứu tự kích hoạt: lấp những ngày đã lỡ nằm giữa lần check-in gần nhất và
 * hôm nay, mỗi ngày tốn 1 vé. Hết vé thì chuỗi đứt — đúng như brief, người chơi
 * không phải bấm gì cả.
 */
async function applyFreezes(
  player: PlayerRow,
  targetDay: number,
  existing: CheckinRow[],
): Promise<{ used: number; filledDays: number[]; pointsDelta: number }> {
  const done = new Set(existing.map((c) => c.day));
  const from = Math.max(joinDayOf(player), 1);

  // Chỉ lấp phần đuôi liền kề ngay trước hôm nay — vé cứu để giữ chuỗi đang
  // chạy, không phải để mua lại cả tháng đã bỏ.
  const tail: number[] = [];
  for (let d = targetDay - 1; d >= from; d--) {
    if (done.has(d)) break;
    tail.unshift(d);
  }

  // Không đủ vé cho toàn bộ quãng đứt thì không tiêu vé nào — tiêu một phần
  // cũng không cứu được chuỗi, chỉ phí vé của người chơi.
  if (tail.length === 0 || tail.length > player.freezes_left) {
    return { used: 0, filledDays: [], pointsDelta: 0 };
  }

  const rows = tail.map((d) => ({
    player_id: player.id,
    day: d,
    correct_count: 0,
    total_count: 0,
    points_awarded: 0,
    by_freeze: true,
  }));
  const { error } = await db().from('checkins').upsert(rows, { onConflict: 'player_id,day' });
  if (error) return { used: 0, filledDays: [], pointsDelta: 0 };

  return { used: tail.length, filledDays: tail, pointsDelta: 0 };
}

/** Người chơi đã hoàn thành cả 6 ngày trước webinar của tuần chưa. */
async function hasFullWeek(playerId: string, week: number): Promise<boolean> {
  const first = (week - 1) * 7 + 1;
  const { count } = await db()
    .from('checkins')
    .select('day', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .gte('day', first)
    .lte('day', first + 5);
  return (count ?? 0) >= 6;
}

/**
 * Ngày Thỏ Ngọc — ngày bí mật chọn ngẫu nhiên lúc seed, lưu trong bảng
 * secret_days mà trình duyệt không đọc được. Chỉ lộ ra đúng lúc người chơi
 * check-in trúng ngày đó.
 */
async function grantRabbitDay(
  playerId: string,
  day: number,
): Promise<{ title: string; detail: string; points: number } | null> {
  const { data } = await db().from('secret_days').select('*').eq('day', day).maybeSingle();
  if (!data) return null;

  const settings = await getSettings();
  const points = data.points ?? settings.scoring.rabbitDayPoints;
  const { error } = await db().from('rewards').insert({
    player_id: playerId,
    kind: 'tho_ngoc',
    day,
    title: data.title,
    detail: data.detail,
    points,
  });
  if (error) return null; // đã nhận rồi

  return { title: data.title, detail: data.detail, points };
}

// ═══════════════════════════════════════════════════════════════════════════
// Nộp bài: thử thách áp dụng & case study chung kết
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

  // Sửa lại bài đã nộp thì không cộng điểm lần nữa.
  if (already) {
    return { ok: true, message: 'Đã cập nhật bài nộp của bạn.', pointsAwarded: 0 };
  }

  const existing = await getCheckins(playerId);
  const freezeResult = await applyFreezes(player, day, existing);

  const { scoring } = await getSettings();
  const points = kind === 'thu_thach' ? scoring.thu_thach.base : scoring.case_study.base;

  await supabase.from('checkins').upsert(
    {
      player_id: playerId,
      day,
      correct_count: 0,
      total_count: 0,
      points_awarded: points,
      by_freeze: false,
    },
    { onConflict: 'player_id,day' },
  );

  const gifts: { title: string; detail: string; points: number }[] = [];
  let bonus = 0;

  // Hộp quà bí ẩn — chỉ sau thử thách áp dụng, tối đa 1 lần/tuần/người.
  if (kind === 'thu_thach') {
    const box = await rollMysteryBox(playerId, dayRow.week, day);
    if (box) {
      bonus += box.points;
      gifts.push(box);
    }
  }

  const rabbit = await grantRabbitDay(playerId, day);
  if (rabbit) {
    bonus += rabbit.points;
    gifts.push(rabbit);
  }

  const allDays = [...existing.map((c) => c.day), ...freezeResult.filledDays, day];
  const streak = streakEndingAt(allDays, day);

  await supabase
    .from('players')
    .update({
      points: player.points + points + bonus,
      streak,
      best_streak: Math.max(player.best_streak, streak),
      freezes_left: player.freezes_left - freezeResult.used,
      freezes_used: player.freezes_used + freezeResult.used,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  return {
    ok: true,
    message:
      kind === 'thu_thach'
        ? 'Đã nhận bài. Thỏ của bạn nhảy hai bước.'
        : 'Đã nhận phần này của case study.',
    pointsAwarded: points + bonus,
    gifts,
    streak,
    freezesUsed: freezeResult.used,
  };
}

async function rollMysteryBox(
  playerId: string,
  week: number,
  day: number,
): Promise<{ title: string; detail: string; points: number } | null> {
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
// Tặng cà rốt
// ═══════════════════════════════════════════════════════════════════════════

export async function giveCarrot(
  fromPlayerId: string,
  toCode: string,
  message: string,
): Promise<{ ok: boolean; message: string }> {
  const target = await findPlayerByCode(toCode);
  if (!target) return { ok: false, message: 'Không tìm thấy mã đó.' };
  if (target.id === fromPlayerId) return { ok: false, message: 'Cà rốt này để dành tặng bạn khác nhé.' };

  const { scoring } = await getSettings();
  const carrotPoints = scoring.carrotPoints;

  const { error } = await db().from('carrot_gifts').insert({
    from_player_id: fromPlayerId,
    to_player_id: target.id,
    points: carrotPoints,
    message: message.slice(0, 200),
  });
  if (error) return { ok: false, message: 'Bạn đã tặng cà rốt cho người này rồi.' };

  await db()
    .from('players')
    .update({ points: target.points + carrotPoints })
    .eq('id', target.id);

  await db().from('rewards').insert({
    player_id: target.id,
    kind: 'ca_rot',
    title: 'Có người tặng bạn một củ cà rốt',
    detail: message.slice(0, 200) || 'Một người bạn cùng chạy vừa gửi điểm cho bạn.',
    points: carrotPoints,
  });

  return { ok: true, message: `Đã gửi ${carrotPoints} điểm cho ${target.display_name}.` };
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
 * Bốc ngẫu nhiên 10% người chơi có hoạt động trong tuần. Trung bấm nút này ở
 * trang admin sau mỗi tuần. Không xếp hạng, không so sánh điểm công khai.
 */
export async function drawHonorRoll(week: number): Promise<{ ok: boolean; message: string }> {
  const first = (week - 1) * 7 + 1;
  const last = week === 7 ? TOTAL_DAYS : first + 6;

  const { data } = await db()
    .from('checkins')
    .select('player_id')
    .gte('day', first)
    .lte('day', last)
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
