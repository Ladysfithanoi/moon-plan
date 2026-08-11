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

const PAGE_ROWS = 1000;

/**
 * Kéo hết một bảng, đi từng khúc 1000 dòng.
 *
 * PostgREST mặc định cắt ở 1000 dòng và không báo gì cả. Bảng `answers` hay
 * `checkins` của cả mùa vượt ngưỡng đó rất nhanh (mỗi người ~100 câu trả lời),
 * nên trang tổng quan mà gọi select() một phát là thống kê âm thầm sai.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE_ROWS) break;
  }
  return out;
}

export type SupabaseConfigNote = {
  /** Host đang dùng, để đối chiếu nhanh giữa máy nhà và bản deploy. */
  host: string;
  /** Mô tả vấn đề nhìn thấy được ngay từ cấu hình, null nếu trông ổn. */
  problem: string | null;
};

/**
 * Soi cấu hình Supabase để hiện lên trang admin khi truy vấn thất bại.
 *
 * Bẫy hay gặp nhất: dán nguyên đường dẫn REST từ Supabase Dashboard, tức là
 * kèm đuôi /rest/v1. supabase-js tự nối phần đó vào nên URL thành
 * .../rest/v1/rest/v1/... và mọi query trả 404 — trang hiện trống trơn chứ
 * không báo gì, rất khó đoán nếu không nói thẳng ra.
 */
export function describeSupabaseConfig(): SupabaseConfigNote {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!raw) return { host: '(chưa đặt)', problem: 'Thiếu biến NEXT_PUBLIC_SUPABASE_URL.' };
  if (!key) return { host: raw, problem: 'Thiếu biến SUPABASE_SERVICE_ROLE_KEY.' };

  if (/\/rest\/v1/.test(raw)) {
    return {
      host: raw,
      problem:
        'URL đang kèm đuôi /rest/v1 — supabase-js tự nối phần này nên mọi truy vấn sẽ 404. ' +
        `Sửa thành ${raw.replace(/\/rest\/v1\/?.*$/, '')}`,
    };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(raw)) {
    return { host: raw, problem: 'URL không đúng dạng https://<project>.supabase.co' };
  }

  return { host: raw, problem: null };
}
