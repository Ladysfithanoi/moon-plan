import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { isAdmin } from '@/lib/session';
import { db, fetchAllRows } from '@/lib/supabase';
import { styleSheet } from '@/lib/excel-io';
import { formatPhone } from '@/lib/auth';
import { zaloClicksFor } from '@/lib/zalo';
import { TZ } from '@/lib/event';
import { TIERS, tierIndexFor } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  display_name: string;
  phone: string | null;
  contact: string | null;
  points: number;
  streak: number;
  best_streak: number;
  is_active: boolean;
  joined_at: string;
};

const DATE = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Tải danh sách người chơi ra Excel — để thêm vào nhóm Zalo, nhắn tin, hay đối
 * chiếu. File chứa số điện thoại thật: chỉ admin tải được, đừng gửi file đi.
 */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Cần đăng nhập admin.' }, { status: 401 });
  }

  const supabase = db();
  const players = await fetchAllRows<Row>((f, t) =>
    supabase
      .from('players')
      .select('id,code,display_name,phone,contact,points,streak,best_streak,is_active,joined_at')
      .order('joined_at')
      .range(f, t),
  );
  const [zalo, checkins] = await Promise.all([
    zaloClicksFor(players.map((p) => p.id)),
    fetchAllRows<{ player_id: string }>((f, t) =>
      supabase.from('checkins').select('player_id').eq('by_freeze', false).range(f, t),
    ),
  ]);
  const doneBy = new Map<string, number>();
  for (const c of checkins) doneBy.set(c.player_id, (doneBy.get(c.player_id) ?? 0) + 1);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chạy dần đến 20/10';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Người chơi');
  sheet.columns = [
    { header: 'Mã', key: 'code', width: 11 },
    { header: 'Tên hiển thị', key: 'name', width: 26 },
    { header: 'Số điện thoại', key: 'phone', width: 15 },
    { header: 'Liên hệ khác', key: 'contact', width: 24 },
    { header: 'Vào nhóm Zalo', key: 'zalo', width: 14 },
    { header: 'Ngày tham gia', key: 'joined', width: 14 },
    { header: 'Số ngày đã học', key: 'done', width: 14 },
    { header: 'Điểm', key: 'points', width: 8 },
    { header: 'Chuỗi', key: 'streak', width: 8 },
    { header: 'Tầng hoa', key: 'tier', width: 11 },
    { header: 'Chuỗi dài nhất', key: 'best', width: 14 },
    { header: 'Trạng thái', key: 'status', width: 12 },
  ];

  for (const p of players) {
    sheet.addRow({
      code: p.code,
      name: p.display_name,
      // Để dạng chữ, không để Excel biến 0912… thành số và mất số 0 đầu.
      phone: p.phone ? formatPhone(p.phone) : '',
      contact: p.contact ?? '',
      zalo: zalo.has(p.id) ? 'đã bấm' : 'chưa',
      joined: DATE.format(new Date(p.joined_at)),
      done: doneBy.get(p.id) ?? 0,
      points: p.points,
      streak: p.streak,
      tier: TIERS[tierIndexFor(p.streak)].name,
      best: p.best_streak,
      status: p.is_active ? 'hoạt động' : 'đã khoá',
    });
  }

  styleSheet(sheet);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="nguoi-choi-${stamp}.xlsx"`,
      'cache-control': 'no-store',
    },
  });
}
