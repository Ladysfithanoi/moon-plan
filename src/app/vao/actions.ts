'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/supabase';
import { findPlayerByCode } from '@/lib/game';
import { startPlayerSession, endPlayerSession } from '@/lib/session';

export type LoginState = { error?: string };

/**
 * Hạn chế đoán mã: tối đa 8 lần sai mỗi phút cho mỗi địa chỉ.
 * Bộ nhớ nằm trong tiến trình nên không tuyệt đối trên serverless, nhưng đủ để
 * chặn kiểu dò mã tự động ở quy mô sự kiện này.
 */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.until) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export async function loginWithCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = String(formData.get('code') ?? '').trim();
  if (!raw) return { error: 'Bạn nhập mã cá nhân trước nhé.' };

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (tooManyAttempts(ip)) {
    return { error: 'Bạn thử hơi nhiều lần rồi. Đợi một phút rồi nhập lại giúp mình.' };
  }

  const player = await findPlayerByCode(raw);
  if (!player) {
    return { error: 'Mã này chưa có trong danh sách. Bạn kiểm tra lại tin nhắn Messenger nhé.' };
  }
  if (!player.is_active) {
    return { error: 'Mã này đang tạm khoá. Bạn nhắn cho mình để mở lại.' };
  }

  await db()
    .from('players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', player.id);

  await startPlayerSession({ pid: player.id, code: player.code, name: player.display_name });
  redirect('/chang-duong');
}

export async function logout(): Promise<void> {
  await endPlayerSession();
  redirect('/');
}
