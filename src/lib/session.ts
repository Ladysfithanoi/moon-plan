import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Phiên đăng nhập bằng cookie httpOnly có chữ ký.
 * Người chơi vào bằng mã cá nhân, Trung vào trang admin bằng mật khẩu riêng.
 */

const PLAYER_COOKIE = 'mp_player';
const ADMIN_COOKIE = 'mp_admin';
const MAX_AGE = 60 * 60 * 24 * 60; // 60 ngày — phủ hết 47 ngày sự kiện

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Thiếu SESSION_SECRET (cần chuỗi ngẫu nhiên ≥32 ký tự). Xem .env.example.');
  }
  return new TextEncoder().encode(s);
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

async function read<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
};

// ─── Người chơi ─────────────────────────────────────────────────────────────

export type PlayerSession = { pid: string; code: string; name: string };

export async function startPlayerSession(s: PlayerSession): Promise<void> {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, await sign({ ...s }), cookieOptions);
}

export async function getPlayerSession(): Promise<PlayerSession | null> {
  const jar = await cookies();
  const s = await read<PlayerSession & { exp: number }>(jar.get(PLAYER_COOKIE)?.value);
  return s?.pid ? { pid: s.pid, code: s.code, name: s.name } : null;
}

export async function endPlayerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PLAYER_COOKIE);
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function startAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await sign({ role: 'admin' }), cookieOptions);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const s = await read<{ role?: string }>(jar.get(ADMIN_COOKIE)?.value);
  return s?.role === 'admin';
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/**
 * So sánh mật khẩu admin theo thời gian không đổi, tránh rò rỉ độ dài qua thời
 * gian phản hồi.
 */
export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
