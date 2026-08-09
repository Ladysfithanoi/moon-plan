import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber } from '@/lib/event';
import { createPlayer, updatePlayer } from '../actions';
import type { PlayerRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NguoiChoiPage() {
  if (!(await isAdmin())) redirect('/admin/vao');

  const supabase = db();
  const today = currentDayNumber() ?? 0;

  const [{ data: players }, { data: checkins }, { data: fragments }] = await Promise.all([
    supabase.from('players').select('*').order('points', { ascending: false }),
    supabase.from('checkins').select('player_id,by_freeze'),
    supabase.from('fragments').select('player_id'),
  ]);

  const doneBy = new Map<string, number>();
  for (const c of checkins ?? []) {
    if (c.by_freeze) continue;
    doneBy.set(c.player_id, (doneBy.get(c.player_id) ?? 0) + 1);
  }
  const fragBy = new Map<string, number>();
  for (const f of fragments ?? []) fragBy.set(f.player_id, (fragBy.get(f.player_id) ?? 0) + 1);

  const list = (players ?? []) as PlayerRow[];

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{list.length} người có mã</span>
          </p>
          <h1 className="display">Người chơi</h1>

          <h2 className="card-title" style={{ marginTop: 28 }}>
            Tạo mã mới
          </h2>
          <ActionForm action={createPlayer} submitLabel="Tạo mã" style={{ maxWidth: 420 }}>
            <div className="field">
              <label htmlFor="display_name">Tên hiển thị</label>
              <input id="display_name" name="display_name" type="text" required />
            </div>
            <div className="field">
              <label htmlFor="contact">Liên hệ (Messenger / Zalo / SĐT)</label>
              <input id="contact" name="contact" type="text" />
              <span className="hint">Chỉ mình thấy, người chơi không thấy thông tin này.</span>
            </div>
          </ActionForm>

          <p className="coach-note" style={{ marginTop: 18 }}>
            Cần tạo hàng loạt lúc mở màn: chạy <span className="mono">npm run make-codes -- 50</span>{' '}
            ở máy, sẽ in ra CSV mã để gửi Messenger.
          </p>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Danh sách</span>
          </p>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Liên hệ</th>
                  <th>Điểm</th>
                  <th>Chuỗi</th>
                  <th>Xong</th>
                  <th>Mảnh</th>
                  <th>Vé cứu</th>
                  <th>Sửa</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const done = doneBy.get(p.id) ?? 0;
                  return (
                    <tr key={p.id}>
                      <td className="num">{p.code}</td>
                      <td>
                        {p.display_name}
                        {!p.is_active ? <> · <span className="tag bad">khoá</span></> : null}
                      </td>
                      <td>{p.contact ?? '—'}</td>
                      <td className="num">{p.points}</td>
                      <td className="num">{p.streak}</td>
                      <td className="num">
                        {done}/{today || TOTAL_DAYS}
                      </td>
                      <td className="num">{fragBy.get(p.id) ?? 0}/6</td>
                      <td className="num">{p.freezes_left}</td>
                      <td>
                        <ActionForm action={updatePlayer} submitLabel="Lưu" ghost>
                          <input type="hidden" name="id" value={p.id} />
                          <div className="field">
                            <input
                              name="display_name"
                              type="text"
                              defaultValue={p.display_name}
                              aria-label={`Tên của ${p.code}`}
                            />
                          </div>
                          <div className="field">
                            <input
                              name="contact"
                              type="text"
                              defaultValue={p.contact ?? ''}
                              placeholder="liên hệ"
                              aria-label={`Liên hệ của ${p.code}`}
                            />
                          </div>
                          <div className="field">
                            <input
                              name="freezes_left"
                              type="number"
                              min={0}
                              max={10}
                              defaultValue={p.freezes_left}
                              aria-label={`Vé cứu của ${p.code}`}
                            />
                            <span className="hint">vé cứu còn lại</span>
                          </div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                            <input
                              type="checkbox"
                              name="is_active"
                              defaultChecked={p.is_active}
                              style={{ width: 'auto', marginRight: 6 }}
                            />
                            đang hoạt động
                          </label>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
                {!list.length ? (
                  <tr>
                    <td colSpan={9}>Chưa có ai. Tạo mã ở khung phía trên.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
