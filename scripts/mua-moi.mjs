#!/usr/bin/env node
/**
 * Dọn sạch dữ liệu mùa trước để dùng lại cùng project Supabase cho mùa mới.
 *
 *   npm run mua-moi                    → chỉ đếm, không xoá gì
 *   npm run mua-moi -- --xac-nhan      → xoá thật
 *
 * Xoá: toàn bộ người chơi (kéo theo check-in, câu trả lời, ruy băng/mảnh trăng,
 * bài nộp, phần thưởng, vinh danh, quà tặng), file đính kèm trong kho, toàn bộ
 * nội dung ngày (kéo theo câu hỏi, ngày bí mật, vườn chung).
 *
 * Giữ: bảng settings (khoá của mùa này đặt tên khác mùa trước nên không lẫn).
 *
 * KHÔNG hoàn tác được. Muốn giữ lại dữ liệu Trung Thu để xem sau thì tạo một
 * project Supabase mới cho mùa này thay vì chạy script này.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
config({ path: join(root, '.env.local') });
config({ path: join(root, '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
  process.exit(1);
}

const confirmed = process.argv.includes('--xac-nhan');
const db = createClient(url, key, { auth: { persistSession: false } });

async function count(table) {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true });
  return error ? `lỗi: ${error.message}` : n ?? 0;
}

console.log(`Project: ${new URL(url).host}\n`);
for (const t of ['players', 'checkins', 'submissions', 'rewards', 'days', 'questions']) {
  console.log(`  ${t.padEnd(12)} ${await count(t)}`);
}

if (!confirmed) {
  console.log('\nChưa xoá gì. Chạy lại với --xac-nhan để dọn sạch:');
  console.log('  npm run mua-moi -- --xac-nhan');
  process.exit(0);
}

// File đính kèm nằm trong storage, khoá ngoại không với tới — dọn tay trước.
const { data: subs } = await db.from('submissions').select('files');
const paths = (subs ?? []).flatMap((s) => s.files ?? []).map((f) => f.path).filter(Boolean);
for (let i = 0; i < paths.length; i += 100) {
  await db.storage.from('case-study').remove(paths.slice(i, i + 100));
}
console.log(`\n✓ Đã xoá ${paths.length} file đính kèm`);

const { error: pErr } = await db.from('players').delete().not('id', 'is', null);
if (pErr) {
  console.error('✗ Không xoá được người chơi:', pErr.message);
  process.exit(1);
}
console.log('✓ Đã xoá người chơi và toàn bộ lịch sử của họ');

const { error: dErr } = await db.from('days').delete().gte('day', 1);
if (dErr) {
  console.error('✗ Không xoá được nội dung ngày:', dErr.message);
  process.exit(1);
}
console.log('✓ Đã xoá nội dung ngày, câu hỏi, ngày bí mật và vườn chung');

console.log('\nXong. Tiếp theo: npm run seed, rồi npm run make-codes -- 50');
