import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { buildQuizWorkbook, type QuizExportRow } from '@/lib/quiz-excel';

export const dynamic = 'force-dynamic';

/**
 * Tải bộ câu hỏi ra file Excel.
 *
 *   /admin/noi-dung/tai-quiz           → tất cả câu hỏi hiện có
 *   /admin/noi-dung/tai-quiz?ngay=6    → chỉ một ngày
 *
 * Sửa trong Excel rồi nạp ngược lại bằng khung "Nhập từ Excel" — cùng một bộ
 * cột nên đi vòng tròn được. File rỗng vẫn có dòng tiêu đề để dùng làm mẫu.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Cần đăng nhập admin.' }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get('ngay');
  const day = Number(raw);
  const oneDay = raw !== null && Number.isInteger(day) ? day : null;

  let query = db()
    .from('questions')
    .select('day,ord,prompt,options,correct_index,explain')
    .order('day')
    .order('ord');
  if (oneDay !== null) query = query.eq('day', oneDay);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buffer = await buildQuizWorkbook((data ?? []) as QuizExportRow[]);
  const name = oneDay !== null ? `quiz-ngay-${oneDay}.xlsx` : 'quiz-tat-ca.xlsx';

  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  });
}
