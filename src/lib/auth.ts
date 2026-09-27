import 'server-only';
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Số điện thoại và mã PIN cho người chơi tự đăng ký.
 *
 * PIN chỉ 4 số nên an toàn nằm ở chỗ khác: băm bằng scrypt kèm salt riêng từng
 * người (lộ bảng cũng không đọc ngược ra PIN được), và giới hạn số lần thử ở
 * trang đăng nhập.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

/**
 * Chuẩn hoá SĐT Việt Nam về dạng 0xxxxxxxxx. Nhận cả khoảng trắng, dấu chấm,
 * gạch ngang và đầu +84 / 84. Trả null nếu không phải số di động 10 chữ số.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2);
  return /^0[35789]\d{8}$/.test(s) ? s : null;
}

/** 0912345678 → "0912 345 678" để hiển thị. */
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

// Bỏ các ký tự dễ đọc nhầm: I, O, 0, 1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mã cá nhân HOA-XXXX — người tự đăng ký cũng có mã, để admin tra cứu như mọi người. */
export function makePlayerCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `HOA-${s}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, salt, hex] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(pin, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
