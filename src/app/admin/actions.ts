'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomInt } from 'node:crypto';
import { db, CASE_STUDY_BUCKET } from '@/lib/supabase';
import { checkAdminPassword, endAdminSession, isAdmin, startAdminSession } from '@/lib/session';
import { drawHonorRoll } from '@/lib/game';
import { FREEZES_PER_PLAYER } from '@/lib/scoring';
import { SETTING_KEYS, saveSetting } from '@/lib/settings';
import { OPTION_COUNT, parseQuizWorkbook } from '@/lib/quiz-excel';

export type ActionState = { ok?: boolean; message?: string };

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/vao');
}

// ─── Đăng nhập ──────────────────────────────────────────────────────────────

export async function adminLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get('password') ?? '');
  if (!checkAdminPassword(password)) {
    return { ok: false, message: 'Mật khẩu chưa đúng.' };
  }
  await startAdminSession();
  redirect('/admin');
}

export async function adminLogout(): Promise<void> {
  await endAdminSession();
  redirect('/admin/vao');
}

// ─── Người chơi ─────────────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1

function makeCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `THO-${s}`;
}

export async function createPlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get('display_name') ?? '').trim();
  const contact = String(formData.get('contact') ?? '').trim();
  if (!name) return { ok: false, message: 'Cần tên hiển thị.' };

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = makeCode();
    const { error } = await db()
      .from('players')
      .insert({ code, display_name: name, contact: contact || null, freezes_left: FREEZES_PER_PLAYER });
    if (!error) {
      revalidatePath('/admin/nguoi-choi');
      return { ok: true, message: `Đã tạo mã ${code} cho ${name}.` };
    }
    if (!error.message.includes('duplicate')) {
      return { ok: false, message: `Không tạo được: ${error.message}` };
    }
  }
  return { ok: false, message: 'Sinh mã bị trùng liên tục, thử lại giúp mình.' };
}

export async function updatePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const patch: Record<string, unknown> = {};

  const name = String(formData.get('display_name') ?? '').trim();
  if (name) patch.display_name = name;

  const contact = formData.get('contact');
  if (contact !== null) patch.contact = String(contact).trim() || null;

  // Checkbox không được tick thì trình duyệt không gửi gì cả, nên phải có ô ẩn
  // đi kèm để biết form này *có* quản lý trường is_active hay không. Thiếu nó
  // thì bỏ tick sẽ không bao giờ khoá được người chơi.
  if (formData.get('is_active_present') !== null) {
    patch.is_active = formData.get('is_active') === 'on';
  }

  const freezes = formData.get('freezes_left');
  if (freezes !== null && freezes !== '') {
    const n = Number(freezes);
    if (Number.isInteger(n) && n >= 0 && n <= 10) patch.freezes_left = n;
  }

  const { error } = await db().from('players').update(patch).eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/nguoi-choi');
  return { ok: true, message: 'Đã lưu.' };
}

/**
 * Xoá hẳn một người chơi.
 *
 * Mọi bảng con đều `on delete cascade` theo players(id) — checkins, answers,
 * fragments, submissions, rewards, honor_roll, carrot_gifts. Nghĩa là xoá là
 * mất sạch lịch sử, không khôi phục được. Vì vậy bắt gõ đúng mã để xác nhận;
 * muốn tạm dừng một người thì bỏ tick "đang hoạt động" chứ đừng xoá.
 */
export async function deletePlayer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const typed = String(formData.get('confirm_code') ?? '').trim().toUpperCase();
  if (!id) return { ok: false, message: 'Thiếu người chơi cần xoá.' };

  const supabase = db();
  const { data: player } = await supabase
    .from('players')
    .select('code,display_name')
    .eq('id', id)
    .maybeSingle();

  if (!player) return { ok: false, message: 'Không tìm thấy người chơi này.' };
  if (typed !== player.code) {
    return { ok: false, message: `Gõ đúng mã ${player.code} vào ô xác nhận rồi mới xoá được.` };
  }

  // File đính kèm nằm trong storage, khoá ngoại không với tới — phải dọn tay
  // trước, nếu không bucket sẽ đầy dần những file không còn ai sở hữu.
  const { data: subs } = await supabase.from('submissions').select('files').eq('player_id', id);
  const paths = ((subs ?? []) as { files: { path: string }[] | null }[])
    .flatMap((s) => s.files ?? [])
    .map((f) => f.path)
    .filter(Boolean);
  if (paths.length) await supabase.storage.from(CASE_STUDY_BUCKET).remove(paths);

  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/nguoi-choi');
  revalidatePath('/admin');
  revalidatePath('/vinh-danh');
  return {
    ok: true,
    message: `Đã xoá ${player.display_name} (${player.code}) cùng toàn bộ lịch sử${
      paths.length ? ` và ${paths.length} file đính kèm` : ''
    }.`,
  };
}

// ─── Nội dung ngày ──────────────────────────────────────────────────────────

export async function updateDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const day = Number(formData.get('day'));
  if (!Number.isInteger(day)) return { ok: false, message: 'Ngày không hợp lệ.' };

  const patch: Record<string, unknown> = {
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? ''),
    prompt: String(formData.get('prompt') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const webinarCode = formData.get('webinar_code');
  if (webinarCode !== null) {
    patch.webinar_code = String(webinarCode).trim().toUpperCase() || null;
  }
  const webinarLink = formData.get('webinar_link');
  if (webinarLink !== null) patch.webinar_link = String(webinarLink).trim() || null;

  if (!patch.title) return { ok: false, message: 'Cần có tiêu đề.' };

  const { error } = await db().from('days').update(patch).eq('day', day);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/noi-dung');
  revalidatePath('/chang-duong');
  return { ok: true, message: `Đã lưu nội dung ngày ${day}.` };
}

// ─── Câu hỏi quiz ───────────────────────────────────────────────────────────

function revalidateQuizConsumers(day?: number): void {
  revalidatePath('/admin/noi-dung');
  revalidatePath('/chang-duong');
  if (day) revalidatePath(`/ngay/${day}`);
}

type QuestionInput = {
  prompt: string;
  options: string[];
  correct_index: number;
  explain: string | null;
};

/** Đọc một câu hỏi từ form và soát luật "đúng 4 lựa chọn, đúng 1 đáp án". */
function readQuestionForm(formData: FormData): QuestionInput | { error: string } {
  const prompt = String(formData.get('prompt') ?? '').trim();
  if (!prompt) return { error: 'Cần có nội dung câu hỏi.' };

  const options: string[] = [];
  for (let i = 1; i <= OPTION_COUNT; i++) {
    const v = String(formData.get(`option_${i}`) ?? '').trim();
    if (!v) return { error: `Đáp án ${i} còn trống — cần đủ ${OPTION_COUNT} lựa chọn.` };
    options.push(v);
  }

  const dup = options.findIndex(
    (o, i) => options.findIndex((x) => x.toLowerCase() === o.toLowerCase()) !== i,
  );
  if (dup >= 0) return { error: `Đáp án ${dup + 1} trùng nội dung với một đáp án phía trên.` };

  const correct = Number(formData.get('correct'));
  if (!Number.isInteger(correct) || correct < 1 || correct > OPTION_COUNT) {
    return { error: 'Chọn một đáp án đúng.' };
  }

  const explain = String(formData.get('explain') ?? '').trim();
  return { prompt, options, correct_index: correct - 1, explain: explain || null };
}

export async function createQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const day = Number(formData.get('day'));
  if (!Number.isInteger(day)) return { ok: false, message: 'Ngày không hợp lệ.' };

  const parsed = readQuestionForm(formData);
  if ('error' in parsed) return { ok: false, message: parsed.error };

  const supabase = db();
  const { data: last } = await supabase
    .from('questions')
    .select('ord')
    .eq('day', day)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('questions')
    .insert({ day, ord: (last?.ord ?? 0) + 1, ...parsed });
  if (error) return { ok: false, message: error.message };

  revalidateQuizConsumers(day);
  return { ok: true, message: 'Đã thêm câu hỏi.' };
}

/**
 * Sửa một câu hỏi tại chỗ.
 *
 * Cố tình update chứ không xoá rồi chèn lại: bảng `answers` trỏ vào
 * questions(id) với `on delete cascade`, nên chèn lại sẽ sinh id mới và cuốn
 * theo toàn bộ câu trả lời học viên đã nộp cho câu đó.
 */
export async function updateQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'Thiếu câu hỏi cần sửa.' };

  const parsed = readQuestionForm(formData);
  if ('error' in parsed) return { ok: false, message: parsed.error };

  const supabase = db();
  const { data: row } = await supabase.from('questions').select('day').eq('id', id).maybeSingle();

  const { error } = await supabase.from('questions').update(parsed).eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidateQuizConsumers(row?.day);
  return { ok: true, message: 'Đã lưu câu hỏi.' };
}

/** Xoá một câu hỏi rồi đánh lại STT cho liền mạch. */
export async function deleteQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'Thiếu câu hỏi cần xoá.' };

  const supabase = db();
  const { data: row } = await supabase.from('questions').select('day,ord').eq('id', id).maybeSingle();
  if (!row) return { ok: false, message: 'Câu hỏi này không còn nữa.' };

  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  await resequence(row.day);
  revalidateQuizConsumers(row.day);
  return { ok: true, message: `Đã xoá câu ${row.ord}. Các câu sau được đánh lại số.` };
}

/**
 * Đánh lại ord thành 1..n cho một ngày.
 *
 * Chạy theo thứ tự tăng dần nên số đích luôn ≤ số hiện tại, không bao giờ đụng
 * ràng buộc unique(day, ord) giữa chừng.
 */
async function resequence(day: number): Promise<void> {
  const supabase = db();
  const { data } = await supabase.from('questions').select('id,ord').eq('day', day).order('ord');
  for (const [i, q] of (data ?? []).entries()) {
    if (q.ord !== i + 1) await supabase.from('questions').update({ ord: i + 1 }).eq('id', q.id);
  }
}

/**
 * Nhập bộ câu hỏi từ file Excel.
 *
 * Chỉ đụng tới những ngày có mặt trong file. Trong mỗi ngày, câu thứ i của file
 * ghi đè lên câu thứ i đang có (update tại chỗ, giữ nguyên câu trả lời đã nộp),
 * dư thì xoá, thiếu thì thêm.
 *
 * File sai một dòng là không ghi gì cả — thà báo lỗi còn hơn nhập nửa chừng
 * rồi không biết dữ liệu đang ở trạng thái nào.
 */
export async function importQuizExcel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Chưa chọn file. Cần một file .xlsx.' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: 'File lớn hơn 5MB — nhiều khả năng không phải file quiz.' };
  }

  const parsed = await parseQuizWorkbook(await file.arrayBuffer());
  if (!parsed.ok) {
    const shown = parsed.errors.slice(0, 6);
    const rest = parsed.errors.length - shown.length;
    return {
      ok: false,
      message:
        `Chưa nhập gì cả — file có ${parsed.errors.length} lỗi. ` +
        shown.join(' ') +
        (rest > 0 ? ` …và ${rest} lỗi nữa.` : ''),
    };
  }

  const supabase = db();
  const daysInFile = [...new Set(parsed.rows.map((r) => r.day))].sort((a, b) => a - b);

  const { data: known } = await supabase.from('days').select('day').in('day', daysInFile);
  const knownDays = new Set((known ?? []).map((d) => d.day));
  const unknown = daysInFile.filter((d) => !knownDays.has(d));
  if (unknown.length) {
    return {
      ok: false,
      message: `Chưa có ngày ${unknown.join(', ')} trong cơ sở dữ liệu. Chạy npm run seed trước đã.`,
    };
  }

  let inserted = 0;
  let updated = 0;
  let removed = 0;

  for (const day of daysInFile) {
    const rows = parsed.rows
      .filter((r) => r.day === day)
      .sort((a, b) => (a.ord ?? Number.MAX_SAFE_INTEGER) - (b.ord ?? Number.MAX_SAFE_INTEGER)
        || a.excelRow - b.excelRow);

    const { data: existingData } = await supabase
      .from('questions')
      .select('id,ord')
      .eq('day', day)
      .order('ord');
    const existing = existingData ?? [];

    // Xoá phần dư trước khi đánh lại số, tránh đụng unique(day, ord).
    const extras = existing.slice(rows.length);
    if (extras.length) {
      const { error } = await supabase
        .from('questions')
        .delete()
        .in('id', extras.map((e) => e.id));
      if (error) return { ok: false, message: `Ngày ${day}: ${error.message}` };
      removed += extras.length;
    }

    for (const [i, row] of rows.entries()) {
      const payload = {
        day,
        ord: i + 1,
        prompt: row.prompt,
        options: row.options,
        correct_index: row.correctIndex,
        explain: row.explain,
      };
      const target = existing[i];
      const { error } = target
        ? await supabase.from('questions').update(payload).eq('id', target.id)
        : await supabase.from('questions').insert(payload);
      if (error) return { ok: false, message: `Ngày ${day}, câu ${i + 1}: ${error.message}` };
      if (target) updated++;
      else inserted++;
    }
  }

  revalidateQuizConsumers();
  for (const day of daysInFile) revalidatePath(`/ngay/${day}`);

  return {
    ok: true,
    message:
      `Đã nhập ${parsed.rows.length} câu cho ${daysInFile.length} ngày ` +
      `(${updated} sửa, ${inserted} thêm mới, ${removed} xoá bớt).`,
  };
}

// ─── Bài nộp ────────────────────────────────────────────────────────────────

export async function reviewSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? 'pending');
  const note = String(formData.get('admin_note') ?? '').trim();

  if (!['pending', 'approved', 'needs_work'].includes(status)) {
    return { ok: false, message: 'Trạng thái không hợp lệ.' };
  }

  const { error } = await db()
    .from('submissions')
    .update({ status, admin_note: note || null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/bai-nop');
  return { ok: true, message: 'Đã lưu nhận xét.' };
}

/** Đánh dấu case study xuất sắc nhất — mỗi mùa chỉ một bài. */
export async function markBestCaseStudy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const supabase = db();

  await supabase.from('submissions').update({ is_best: false }).eq('is_best', true);
  const { error } = await supabase.from('submissions').update({ is_best: true }).eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/bai-nop');
  return { ok: true, message: 'Đã chọn case study xuất sắc nhất.' };
}

/** Link xem file đính kèm, có hạn 1 giờ. Bucket là riêng tư nên phải ký. */
export async function signedFileUrl(path: string): Promise<string | null> {
  if (!(await isAdmin())) return null;
  const { data } = await db().storage.from(CASE_STUDY_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ─── Cài đặt ────────────────────────────────────────────────────────────────

/** Trang nào hiển thị dữ liệu lấy từ bảng settings. */
function revalidateSettingsConsumers(): void {
  revalidatePath('/');
  revalidatePath('/admin/cai-dat');
  revalidatePath('/chang-duong');
  revalidatePath('/chung-ket');
  revalidatePath('/vinh-danh');
  revalidatePath('/admin');
}

/** Bậc thưởng cuối sự kiện — hiện trên trang giới thiệu. */
export async function saveRewardTiers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const titles = formData.getAll('tier_title').map(String);
  const details = formData.getAll('tier_detail').map(String);

  const tiers = titles
    .map((title, i) => ({ title: title.trim(), detail: (details[i] ?? '').trim() }))
    .filter((t) => t.title);

  if (!tiers.length) {
    return { ok: false, message: 'Cần ít nhất một bậc thưởng có tiêu đề.' };
  }

  const { error } = await saveSetting(SETTING_KEYS.rewardTiers, tiers);
  if (error) return { ok: false, message: error };

  revalidateSettingsConsumers();
  return { ok: true, message: `Đã lưu ${tiers.length} bậc thưởng. Trang giới thiệu cập nhật ngay.` };
}

/** Chủ đề 6 tuần và tên 6 mảnh trăng. */
export async function saveWeekLabels(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const themes = formData.getAll('week_theme').map((v) => String(v).trim());
  const fragments = formData.getAll('moon_fragment').map((v) => String(v).trim());

  if (themes.length !== 6 || fragments.length !== 6) {
    return { ok: false, message: 'Cần đủ 6 chủ đề tuần và 6 tên mảnh trăng.' };
  }
  if (themes.some((t) => !t) || fragments.some((f) => !f)) {
    return { ok: false, message: 'Không được để trống ô nào.' };
  }

  const a = await saveSetting(SETTING_KEYS.weekThemes, themes);
  if (a.error) return { ok: false, message: a.error };
  const b = await saveSetting(SETTING_KEYS.moonFragments, fragments);
  if (b.error) return { ok: false, message: b.error };

  revalidateSettingsConsumers();
  return {
    ok: true,
    message:
      'Đã lưu. Lưu ý: mảnh trăng đã trao trước đó vẫn giữ tên cũ — chỉ mảnh trao từ giờ mới mang tên mới.',
  };
}

/** Danh sách quà trong hộp quà bí ẩn. */
export async function saveBoxPrizes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const titles = formData.getAll('prize_title').map(String);
  const details = formData.getAll('prize_detail').map(String);
  const points = formData.getAll('prize_points').map(String);

  const prizes = titles
    .map((title, i) => ({
      title: title.trim(),
      detail: (details[i] ?? '').trim(),
      points: Math.max(0, Math.min(100, Math.round(Number(points[i]) || 0))),
    }))
    .filter((p) => p.title);

  if (!prizes.length) {
    return { ok: false, message: 'Cần ít nhất một phần quà, nếu không hộp quà sẽ luôn rỗng.' };
  }

  const { error } = await saveSetting(SETTING_KEYS.boxPrizes, prizes);
  if (error) return { ok: false, message: error };

  revalidateSettingsConsumers();
  return { ok: true, message: `Đã lưu ${prizes.length} phần quà.` };
}

/** Bảng điểm và tỉ lệ ngẫu nhiên. */
export async function saveScoring(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const n = (key: string) => Number(formData.get(key));
  const pct = (key: string) => Number(formData.get(key)) / 100;

  const scoring = {
    kien_thuc: { base: n('kt_base'), perCorrect: n('kt_correct') },
    quiz_tuan: { base: n('qt_base'), bonus: n('qt_bonus'), threshold: pct('qt_threshold') },
    thu_thach: { base: n('tt_base') },
    webinar: { base: n('wb_base') },
    case_study: { base: n('cs_base') },
    mysteryBoxChance: pct('box_chance'),
    rabbitDayPoints: n('rabbit_points'),
    carrotPoints: n('carrot_points'),
  };

  const flat = [
    scoring.kien_thuc.base,
    scoring.kien_thuc.perCorrect,
    scoring.quiz_tuan.base,
    scoring.quiz_tuan.bonus,
    scoring.thu_thach.base,
    scoring.webinar.base,
    scoring.case_study.base,
    scoring.rabbitDayPoints,
    scoring.carrotPoints,
  ];
  if (flat.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    return { ok: false, message: 'Điểm phải là số từ 0 đến 100.' };
  }
  if (![scoring.quiz_tuan.threshold, scoring.mysteryBoxChance].every((v) => v >= 0 && v <= 1)) {
    return { ok: false, message: 'Tỉ lệ phần trăm phải nằm trong khoảng 0–100.' };
  }

  const { error } = await saveSetting(SETTING_KEYS.scoring, scoring);
  if (error) return { ok: false, message: error };

  revalidateSettingsConsumers();
  return {
    ok: true,
    message: 'Đã lưu bảng điểm. Điểm đã cộng trước đó giữ nguyên, luật mới áp dụng từ lần check-in tới.',
  };
}

/** Khôi phục một nhóm cài đặt về mặc định trong code. */
export async function resetSetting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const key = String(formData.get('key') ?? '');
  const valid = Object.values(SETTING_KEYS) as string[];
  if (!valid.includes(key)) return { ok: false, message: 'Nhóm cài đặt không hợp lệ.' };

  const { error } = await db().from('settings').delete().eq('key', key);
  if (error) return { ok: false, message: error.message };

  revalidateSettingsConsumers();
  return { ok: true, message: 'Đã khôi phục về mặc định.' };
}

// ─── Bảng vinh danh ─────────────────────────────────────────────────────────

export async function drawHonorRollAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const week = Number(formData.get('week'));
  if (!Number.isInteger(week) || week < 1 || week > 7) {
    return { ok: false, message: 'Tuần không hợp lệ.' };
  }

  const result = await drawHonorRoll(week);
  revalidatePath('/admin');
  revalidatePath('/vinh-danh');
  return result;
}
