'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomInt } from 'node:crypto';
import { db, CASE_STUDY_BUCKET } from '@/lib/supabase';
import { checkAdminPassword, endAdminSession, isAdmin, startAdminSession } from '@/lib/session';
import { drawHonorRoll } from '@/lib/game';
import { FREEZES_PER_PLAYER } from '@/lib/scoring';
import { SETTING_KEYS, saveSetting } from '@/lib/settings';

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

  if (formData.get('is_active') !== null) {
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

/**
 * Sửa toàn bộ câu hỏi của một ngày bằng JSON.
 * Định dạng: [{ "prompt": "...", "options": ["a","b"], "correct_index": 0, "explain": "..." }]
 */
export async function updateQuestions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const day = Number(formData.get('day'));
  const raw = String(formData.get('questions') ?? '').trim();
  if (!Number.isInteger(day)) return { ok: false, message: 'Ngày không hợp lệ.' };

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    return { ok: false, message: 'JSON chưa đúng cú pháp — kiểm tra lại dấu phẩy và ngoặc.' };
  }
  if (!Array.isArray(parsed)) return { ok: false, message: 'Phải là một danh sách [ ... ].' };

  const rows = [];
  for (const [i, item] of parsed.entries()) {
    const q = item as Record<string, unknown>;
    const options = q.options;
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
      return { ok: false, message: `Câu ${i + 1}: thiếu "prompt".` };
    }
    if (!Array.isArray(options) || options.length < 2) {
      return { ok: false, message: `Câu ${i + 1}: cần ít nhất 2 lựa chọn trong "options".` };
    }
    const ci = Number(q.correct_index);
    if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) {
      return { ok: false, message: `Câu ${i + 1}: "correct_index" nằm ngoài danh sách lựa chọn.` };
    }
    rows.push({
      day,
      ord: i + 1,
      prompt: q.prompt.trim(),
      options,
      correct_index: ci,
      explain: typeof q.explain === 'string' ? q.explain : null,
    });
  }

  const supabase = db();
  const { error: delErr } = await supabase.from('questions').delete().eq('day', day);
  if (delErr) return { ok: false, message: delErr.message };

  if (rows.length) {
    const { error } = await supabase.from('questions').insert(rows);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath('/admin/noi-dung');
  revalidatePath('/chang-duong');
  return { ok: true, message: `Đã lưu ${rows.length} câu hỏi cho ngày ${day}.` };
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
