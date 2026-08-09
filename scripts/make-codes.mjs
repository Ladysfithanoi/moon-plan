#!/usr/bin/env node
/**
 * Tạo hàng loạt mã cá nhân cho người chơi.
 *
 *   npm run make-codes -- 50
 *
 * In ra danh sách mã dạng CSV để Trung gửi qua Messenger.
 * Trang admin cũng tạo được từng mã một — script này dành cho lúc mở màn.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
config({ path: join(root, '.env.local') });
config({ path: join(root, '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Thiếu biến môi trường Supabase trong .env.local');
  process.exit(1);
}

const n = Number(process.argv[2] ?? 20);
if (!Number.isInteger(n) || n < 1 || n > 500) {
  console.error('✗ Số lượng phải là số nguyên từ 1 đến 500. Ví dụ: npm run make-codes -- 50');
  process.exit(1);
}

// Bỏ các ký tự dễ đọc nhầm: I, O, 0, 1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `THO-${s}`;
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await db.from('players').select('code');
const taken = new Set((existing ?? []).map((r) => r.code));

const codes = [];
while (codes.length < n) {
  const c = makeCode();
  if (taken.has(c)) continue;
  taken.add(c);
  codes.push(c);
}

const rows = codes.map((code, i) => ({
  code,
  display_name: `Người chạy ${String(i + 1).padStart(3, '0')}`,
  freezes_left: 2,
}));

const { error } = await db.from('players').insert(rows);
if (error) {
  console.error('✗ Tạo mã lỗi:', error.message);
  process.exit(1);
}

console.log(`✓ Đã tạo ${codes.length} mã\n`);
console.log('ma_ca_nhan,ten_hien_thi');
for (const r of rows) console.log(`${r.code},${r.display_name}`);
console.log('\nGửi mã cho học viên qua Messenger. Tên hiển thị sửa được ở /admin/nguoi-choi.');
