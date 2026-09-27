'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/supabase';
import { findPlayerByCode } from '@/lib/game';
import { getSettings } from '@/lib/settings';
import { DEWS_PER_PLAYER } from '@/lib/scoring';
import { hashPin, isValidPin, makePlayerCode, normalizePhone, verifyPin } from '@/lib/auth';
import { startPlayerSession, endPlayerSession } from '@/lib/session';

export type LoginState = { error?: string };

/**
 * Hạn chế đoán mã, đoán PIN và tạo tài khoản hàng loạt. Bộ nhớ nằm trong tiến
 * trình nên không tuyệt đối trên serverless, nhưng đủ để chặn kiểu dò tự động
 * ở quy mô sự kiện này.
 */
const attempts = new Map<string, { count: number; until: number }>();

function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.until) {
    attempts.set(key, { count: 1, until: now + windowMs });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

const SLOW_DOWN = 'Bạn thử hơi nhiều lần rồi. Đợi một phút rồi nhập lại giúp mình.';

async function enter(player: { id: string; code: string; display_name: string }): Promise<never> {
  await db()
    .from('players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', player.id);
  await startPlayerSession({ pid: player.id, code: player.code, name: player.display_name });
  redirect('/chang-duong');
}

export async function loginWithCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = String(formData.get('code') ?? '').trim();
  if (!raw) return { error: 'Bạn nhập mã cá nhân trước nhé.' };

  if (tooMany(`code:${await clientIp()}`, 8, 60_000)) return { error: SLOW_DOWN };

  const player = await findPlayerByCode(raw);
  if (!player) {
    return { error: 'Mã này chưa có trong danh sách. Bạn kiểm tra lại tin nhắn Messenger nhé.' };
  }
  if (!player.is_active) {
    return { error: 'Mã này đang tạm khoá. Bạn nhắn cho mình để mở lại.' };
  }

  return enter(player);
}

/**
 * Đăng nhập bằng SĐT + PIN. Giới hạn theo cả địa chỉ lẫn theo SĐT: PIN chỉ có
 * 10.000 khả năng, nên không để ai đổi mạng liên tục mà dò một số được.
 */
export async function loginWithPhone(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  const pin = String(formData.get('pin') ?? '').trim();
  if (!phone) return { error: 'Số điện thoại chưa đúng dạng — 10 số, bắt đầu bằng 0.' };
  if (!isValidPin(pin)) return { error: 'Mã PIN gồm đúng 4 chữ số.' };

  if (tooMany(`phone-ip:${await clientIp()}`, 8, 60_000)) return { error: SLOW_DOWN };
  if (tooMany(`phone:${phone}`, 10, 15 * 60_000)) {
    return { error: 'Số này nhập sai PIN nhiều lần quá. Đợi 15 phút, hoặc nhắn mình để đặt lại PIN.' };
  }

  const { data } = await db()
    .from('players')
    .select('id,code,display_name,is_active,pin_hash')
    .eq('phone', phone)
    .maybeSingle();

  // Cùng một câu báo cho "không có số này" và "sai PIN" — không cho dò xem
  // SĐT nào đã đăng ký.
  if (!data || !(await verifyPin(pin, data.pin_hash))) {
    return { error: 'Số điện thoại hoặc mã PIN chưa đúng.' };
  }
  if (!data.is_active) {
    return { error: 'Tài khoản này đang tạm khoá. Bạn nhắn cho mình để mở lại.' };
  }

  return enter(data);
}

/** Tự tạo tài khoản: tên hiển thị + SĐT + PIN 4 số. */
export async function registerPlayer(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const { registrationOpen } = await getSettings();
  if (!registrationOpen) {
    return { error: 'Đăng ký đang đóng. Bạn nhắn cho mình qua Messenger để được cấp mã nhé.' };
  }

  const name = String(formData.get('display_name') ?? '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  const pin = String(formData.get('pin') ?? '').trim();
  const pin2 = String(formData.get('pin_confirm') ?? '').trim();

  if (name.length < 2 || name.length > 40) return { error: 'Tên hiển thị từ 2 đến 40 ký tự.' };
  if (!phone) return { error: 'Số điện thoại chưa đúng dạng — 10 số, bắt đầu bằng 0.' };
  if (!isValidPin(pin)) return { error: 'Mã PIN gồm đúng 4 chữ số.' };
  if (pin !== pin2) return { error: 'Hai lần nhập PIN chưa khớp nhau.' };

  if (tooMany(`register:${await clientIp()}`, 5, 10 * 60_000)) {
    return { error: 'Máy này vừa tạo nhiều tài khoản quá. Đợi ít phút rồi thử lại nhé.' };
  }

  const supabase = db();
  const { data: taken } = await supabase.from('players').select('id').eq('phone', phone).maybeSingle();
  if (taken) {
    return { error: 'Số này đã đăng ký rồi. Bạn đăng nhập bằng SĐT và PIN ở trang Vào nhé.' };
  }

  const pinHash = await hashPin(pin);
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase
      .from('players')
      .insert({
        code: makePlayerCode(),
        display_name: name,
        phone,
        pin_hash: pinHash,
        dews: DEWS_PER_PLAYER,
      })
      .select('id,code,display_name')
      .single();

    if (!error && data) return enter(data);
    // Trùng mã thì sinh mã khác; trùng SĐT (hai người bấm cùng lúc) thì báo.
    if (error?.message.includes('players_phone_unique')) {
      return { error: 'Số này đã đăng ký rồi. Bạn đăng nhập bằng SĐT và PIN ở trang Vào nhé.' };
    }
    if (!error?.message.includes('duplicate')) {
      return { error: 'Chưa tạo được tài khoản, bạn thử lại giúp mình.' };
    }
  }
  return { error: 'Chưa tạo được tài khoản, bạn thử lại giúp mình.' };
}

export async function logout(): Promise<void> {
  await endPlayerSession();
  redirect('/');
}
