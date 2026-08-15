#!/usr/bin/env node
/**
 * Nạp nội dung 47 ngày vào Supabase.
 *
 *   npm run seed
 *
 * Chạy lại được nhiều lần: nội dung ngày và câu hỏi sẽ được ghi đè theo file
 * trong thư mục content/. Riêng hai thứ sau thì KHÔNG bị đụng tới nếu đã có:
 *   · mã điểm danh webinar (Trung đặt trong trang admin)
 *   · Ngày Thỏ Ngọc (chọn ngẫu nhiên đúng một lần, giữ kín)
 *
 * Câu hỏi thì bị xoá sạch rồi nạp lại — nên nếu đã thêm/sửa câu hỏi trong
 * /admin/noi-dung mà chỉ muốn cập nhật phần chữ (tiêu đề, bài đọc, đề bài):
 *
 *   npm run seed:noi-dung        (= node scripts/seed.mjs --giu-cau-hoi)
 *
 * Thêm `--ngay 6,13` để chỉ nạp đúng vài ngày, những ngày còn lại để yên:
 *
 *   npm run seed:noi-dung -- --ngay 6,13,20,27,34,41
 */

import { readFileSync, readdirSync } from 'node:fs';
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

const db = createClient(url, key, { auth: { persistSession: false } });

const argv = process.argv.slice(2);

/** Giữ nguyên bộ câu hỏi đang có trong cơ sở dữ liệu, chỉ nạp phần chữ. */
const keepQuestions = argv.some((a) => a === '--giu-cau-hoi' || a === '--keep-questions');

/**
 * `--ngay 6,13` chỉ nạp đúng những ngày đó, những ngày khác để yên. Hợp khi cần
 * sửa vài ngày mà không muốn ghi đè lên nội dung đã chỉnh trong trang admin.
 */
const onlyDays = (() => {
  const i = argv.findIndex((a) => a === '--ngay' || a.startsWith('--ngay='));
  if (i < 0) return null;
  const raw = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  const list = String(raw ?? '')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1);
  if (!list.length) {
    console.error('✗ --ngay cần danh sách số ngày, ví dụ: --ngay 6,13,20');
    process.exit(1);
  }
  return new Set(list);
})();

// ─── Đọc nội dung ───────────────────────────────────────────────────────────
const contentDir = join(root, 'content');
const files = readdirSync(contentDir)
  .filter((f) => /^week-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

const days = [];
for (const f of files) {
  const parsed = JSON.parse(readFileSync(join(contentDir, f), 'utf8'));
  days.push(...parsed);
}
days.sort((a, b) => a.day - b.day);

if (days.length !== 47) {
  console.error(`✗ Cần đúng 47 ngày, đang có ${days.length}. Kiểm tra lại content/week-*.json`);
  process.exit(1);
}

const seen = new Set();
for (const d of days) {
  if (seen.has(d.day)) {
    console.error(`✗ Ngày ${d.day} bị lặp trong content/`);
    process.exit(1);
  }
  seen.add(d.day);
}

// ─── Nạp ngày ───────────────────────────────────────────────────────────────
if (onlyDays) {
  const missing = [...onlyDays].filter((n) => !seen.has(n));
  if (missing.length) {
    console.error(`✗ content/ không có ngày ${missing.join(', ')}`);
    process.exit(1);
  }
}

const chosen = onlyDays ? days.filter((d) => onlyDays.has(d.day)) : days;
console.log(`→ Nạp ${chosen.length} ngày${onlyDays ? ` (${[...onlyDays].sort((a, b) => a - b).join(', ')})` : ''}...`);

const dayRows = chosen.map((d) => ({
  day: d.day,
  date: d.date,
  weekday: d.weekday,
  week: d.week,
  phase: d.phase,
  week_theme: d.week_theme,
  day_type: d.day_type,
  title: d.title,
  body: d.body,
  prompt: d.prompt ?? null,
  mechanic: d.mechanic ?? null,
  webinar_at: d.webinar_at ?? null,
  updated_at: new Date().toISOString(),
}));

{
  const { error } = await db.from('days').upsert(dayRows, { onConflict: 'day' });
  if (error) {
    console.error('✗ Nạp ngày lỗi:', error.message);
    process.exit(1);
  }
}
console.log(`✓ Đã nạp ${dayRows.length} ngày`);

// ─── Nạp câu hỏi ────────────────────────────────────────────────────────────
// Xoá rồi nạp lại để nội dung trong file luôn là bản đúng.
if (keepQuestions) {
  console.log('· Giữ nguyên câu hỏi đang có trong cơ sở dữ liệu (--giu-cau-hoi)');
} else {
  console.log('→ Nạp câu hỏi quiz...');
}

const questionRows = [];
for (const d of chosen) {
  (d.questions ?? []).forEach((q, i) => {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      console.error(`✗ Ngày ${d.day}, câu ${i + 1}: thiếu danh sách lựa chọn`);
      process.exit(1);
    }
    if (q.correct_index < 0 || q.correct_index >= q.options.length) {
      console.error(`✗ Ngày ${d.day}, câu ${i + 1}: correct_index nằm ngoài danh sách lựa chọn`);
      process.exit(1);
    }
    questionRows.push({
      day: d.day,
      ord: i + 1,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      explain: q.explain ?? null,
    });
  });
}

if (!keepQuestions) {
  const del = db.from('questions').delete();
  const { error: delErr } = await (onlyDays ? del.in('day', [...onlyDays]) : del.gte('day', 1));
  if (delErr) {
    console.error('✗ Không xoá được câu hỏi cũ:', delErr.message);
    process.exit(1);
  }
  const { error } = await db.from('questions').insert(questionRows);
  if (error) {
    console.error('✗ Nạp câu hỏi lỗi:', error.message);
    process.exit(1);
  }
  console.log(`✓ Đã nạp ${questionRows.length} câu hỏi`);
}

// ─── Ngày Thỏ Ngọc ──────────────────────────────────────────────────────────
// Chọn ngẫu nhiên đúng một lần rồi giữ nguyên. Không in ra màn hình — chính
// Trung cũng không cần biết, và biết rồi thì dễ lỡ miệng.
const { count: secretCount } = await db
  .from('secret_days')
  .select('day', { count: 'exact', head: true });

if ((secretCount ?? 0) > 0) {
  console.log('· Ngày Thỏ Ngọc đã được chọn từ trước — giữ nguyên, không đụng tới');
} else {
  const candidates = days
    .filter((d) => d.day >= 5 && d.day <= 42)
    .filter((d) => d.day_type === 'kien_thuc' || d.day_type === 'thu_thach')
    .map((d) => d.day);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Hai ngày bí mật, cách nhau ít nhất 7 ngày cho rải đều.
  const picked = [candidates[0]];
  for (const c of candidates.slice(1)) {
    if (Math.abs(c - picked[0]) >= 7) {
      picked.push(c);
      break;
    }
  }

  const { error } = await db.from('secret_days').insert(
    picked.map((day) => ({
      day,
      kind: 'tho_ngoc',
      title: 'Ngày Thỏ Ngọc',
      detail:
        'Bạn vừa bước đúng vào một ngày mà thỏ ngọc để lại quà dưới gốc đa. ' +
        'Không ai biết trước ngày này — kể cả những người đã đi trước bạn.',
      points: 15,
    })),
  );
  if (error) {
    console.error('✗ Không đặt được Ngày Thỏ Ngọc:', error.message);
    process.exit(1);
  }
  console.log(`✓ Đã chọn ${picked.length} Ngày Thỏ Ngọc (giữ kín phía server)`);
}

// ─── Tổng kết ───────────────────────────────────────────────────────────────
const byType = {};
for (const d of chosen) byType[d.day_type] = (byType[d.day_type] ?? 0) + 1;

console.log('\nTổng kết nội dung:');
for (const [t, n] of Object.entries(byType)) console.log(`  ${t.padEnd(12)} ${n} ngày`);
console.log(
  keepQuestions ? '  câu hỏi      giữ nguyên' : `  câu hỏi      ${questionRows.length}`,
);
console.log('\nXong. Nhớ vào /admin/noi-dung đặt mã điểm danh cho 6 buổi webinar.');
