import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { buildDayWorkbook, type DayExportRow } from '@/lib/day-excel';

export const dynamic = 'force-dynamic';

/**
 * Tải nội dung 47 ngày ra file Excel.
 *
 *   /admin/noi-dung/tai-noi-dung        → tất cả ngày đang có
 *   /admin/noi-dung/tai-noi-dung?ngay=3 → chỉ một ngày
 *
 * File này cũng chính là file mẫu để nạp ngược lại: cùng bộ cột, cùng tên sheet.
 * Lưu ý cột "Mã điểm danh" có mã thật của webinar — đừng gửi file cho học viên.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Cần đăng nhập admin.' }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get('ngay');
  const day = Number(raw);
  const oneDay = raw !== null && Number.isInteger(day) ? day : null;

  let query = db()
    .from('days')
    .select('day,date,weekday,week,day_type,phase,week_theme,title,body,prompt,mechanic,webinar_code,webinar_link')
    .order('day');
  if (oneDay !== null) query = query.eq('day', oneDay);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const buffer = await buildDayWorkbook((data ?? []) as DayExportRow[]);
  const name = oneDay !== null ? `noi-dung-ngay-${oneDay}.xlsx` : 'noi-dung-47-ngay.xlsx';

  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
