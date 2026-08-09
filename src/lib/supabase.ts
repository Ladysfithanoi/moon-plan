import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase dùng service_role — CHỈ được import từ code chạy trên server.
 *
 * Mọi bảng đều bật RLS và không có policy nào cho anon, nên đây là đường duy nhất
 * đọc/ghi dữ liệu. Nhờ vậy đáp án quiz, mã điểm danh webinar và Ngày Thỏ Ngọc
 * không bao giờ đi xuống trình duyệt.
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. ' +
        'Xem file .env.example để biết cần điền gì.',
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const CASE_STUDY_BUCKET = 'case-study';
