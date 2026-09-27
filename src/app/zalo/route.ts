import { NextResponse } from 'next/server';
import { getPlayerSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { recordZaloClick } from '@/lib/zalo';

export const dynamic = 'force-dynamic';

/**
 * Nút "Vào nhóm Zalo" trỏ về đây thay vì thẳng tới Zalo: ghi lại người này đã
 * bấm rồi mới chuyển tiếp, để admin biết ai chưa vào nhóm mà nhắc.
 */
export async function GET(request: Request): Promise<Response> {
  const { zaloLink } = await getSettings();
  if (!zaloLink) return NextResponse.redirect(new URL('/chang-duong', request.url));

  const session = await getPlayerSession();
  if (session) await recordZaloClick(session.pid);

  return NextResponse.redirect(zaloLink);
}
