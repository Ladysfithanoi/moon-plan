import 'server-only';
import QRCode from 'qrcode';
import { db } from './supabase';

/**
 * Nhóm Zalo của lớp. Zalo không cho app thêm người vào nhóm, nên cách làm là
 * đưa link mời tới đúng lúc (ngay sau khi đăng ký, trên trang cành hoa) và ghi
 * lại ai đã bấm để admin biết nên nhắc ai.
 *
 * Mọi truy vấn ở đây đều nuốt lỗi: nếu chưa chạy migration 0005 thì app vẫn
 * chạy bình thường, chỉ là chưa ghi được ai đã bấm.
 */

export async function hasClickedZalo(playerId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('zalo_clicks')
    .select('player_id')
    .eq('player_id', playerId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function recordZaloClick(playerId: string): Promise<void> {
  await db()
    .from('zalo_clicks')
    .upsert({ player_id: playerId }, { onConflict: 'player_id', ignoreDuplicates: true });
}

/** Ai trong danh sách đã bấm, kèm lúc bấm. */
export async function zaloClicksFor(playerIds: string[]): Promise<Map<string, string>> {
  if (!playerIds.length) return new Map();
  const { data, error } = await db()
    .from('zalo_clicks')
    .select('player_id,clicked_at')
    .in('player_id', playerIds);
  if (error) return new Map();
  return new Map(((data ?? []) as { player_id: string; clicked_at: string }[]).map((r) => [r.player_id, r.clicked_at]));
}

/** Mã QR của link mời, dạng SVG — để người đang xem trên máy tính quét bằng điện thoại. */
export async function zaloQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#14110E', light: '#F6F2EA' },
  });
}
