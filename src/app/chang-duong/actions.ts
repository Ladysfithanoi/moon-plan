'use server';

import { revalidatePath } from 'next/cache';
import { db, CASE_STUDY_BUCKET } from '@/lib/supabase';
import { getPlayerSession } from '@/lib/session';
import { checkIn, giveCarrot, submitWork } from '@/lib/game';
import type { CheckinResult } from '@/lib/types';

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

const NOT_LOGGED_IN: CheckinResult = {
  ok: false,
  message: 'Phiên của bạn đã hết hạn. Bạn nhập lại mã cá nhân nhé.',
};

/** Đánh dấu hoàn thành ngày kiến thức / quiz tuần / webinar. */
export async function doCheckIn(_prev: CheckinResult, formData: FormData): Promise<CheckinResult> {
  const session = await getPlayerSession();
  if (!session) return NOT_LOGGED_IN;

  const day = Number(formData.get('day'));
  if (!Number.isInteger(day)) return { ok: false, message: 'Ngày không hợp lệ.' };

  // Đáp án gửi lên dạng answer:<questionId> = <chỉ số lựa chọn>
  const answers: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('answer:')) continue;
    const n = Number(value);
    if (Number.isInteger(n)) answers[key.slice(7)] = n;
  }

  const result = await checkIn({
    playerId: session.pid,
    day,
    answers,
    webinarCode: String(formData.get('webinarCode') ?? ''),
  });

  if (result.ok) revalidatePath('/chang-duong');
  return result;
}

/** Nộp bài thử thách áp dụng hoặc một phần case study chung kết. */
export async function doSubmitWork(
  _prev: CheckinResult,
  formData: FormData,
): Promise<CheckinResult> {
  const session = await getPlayerSession();
  if (!session) return NOT_LOGGED_IN;

  const day = Number(formData.get('day'));
  if (!Number.isInteger(day)) return { ok: false, message: 'Ngày không hợp lệ.' };

  const body = String(formData.get('body') ?? '');

  const incoming = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (incoming.length > MAX_FILES) {
    return { ok: false, message: `Đính kèm tối đa ${MAX_FILES} file thôi nhé.` };
  }

  const uploaded: { path: string; name: string; size: number }[] = [];
  for (const file of incoming) {
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, message: `File "${file.name}" nặng quá 5MB.` };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, message: `File "${file.name}" không phải ảnh hoặc PDF.` };
    }

    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80);
    const path = `${session.pid}/${day}/${Date.now()}-${safeName}`;

    const { error } = await db()
      .storage.from(CASE_STUDY_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (error) return { ok: false, message: 'Tải file lên chưa được, bạn thử lại giúp mình.' };
    uploaded.push({ path, name: file.name, size: file.size });
  }

  // Giữ lại file đã đính kèm ở lần nộp trước nếu lần này không gửi file mới.
  let files = uploaded;
  if (!uploaded.length) {
    const { data } = await db()
      .from('submissions')
      .select('files')
      .eq('player_id', session.pid)
      .eq('day', day)
      .maybeSingle();
    files = (data?.files as typeof uploaded) ?? [];
  }

  const result = await submitWork({ playerId: session.pid, day, body, files });
  if (result.ok) {
    revalidatePath('/chang-duong');
    revalidatePath('/chung-ket');
  }
  return result;
}

/** Đánh dấu đã xem các phần thưởng, để lần sau không hiện lại. */
export async function markRewardsSeen(): Promise<void> {
  const session = await getPlayerSession();
  if (!session) return;
  await db().from('rewards').update({ seen: true }).eq('player_id', session.pid).eq('seen', false);
  revalidatePath('/chang-duong');
}

export type CarrotState = { ok?: boolean; message?: string };

/** Tặng điểm cho một người bạn cùng chạy. */
export async function doGiveCarrot(
  _prev: CarrotState,
  formData: FormData,
): Promise<CarrotState> {
  const session = await getPlayerSession();
  if (!session) return { ok: false, message: 'Phiên của bạn đã hết hạn.' };

  const code = String(formData.get('toCode') ?? '');
  const message = String(formData.get('message') ?? '');
  const result = await giveCarrot(session.pid, code, message);
  if (result.ok) revalidatePath('/chang-duong');
  return result;
}
