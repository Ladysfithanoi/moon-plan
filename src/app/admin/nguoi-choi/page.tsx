import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import PlayerRowActions from '@/components/PlayerRowActions';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber } from '@/lib/event';
import { createPlayer } from '../actions';
import type { PlayerRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Mỗi dòng giờ chỉ cao một hàng (form sửa nằm trong modal) nên xem 10 người
 *  một trang vẫn gọn trong một màn hình. */
const PAGE_SIZE = 10;

/** Số nút trang hiện cùng lúc trên thanh phân trang. */
const PAGER_WINDOW = 7;

type Status = 'hoat_dong' | 'khoa';

/**
 * PostgREST tách các nhánh của or() bằng dấu phẩy và ngoặc đơn, còn % và * là
 * ký tự đại diện của ilike. Người dùng gõ mấy ký tự đó vào ô tìm kiếm thì câu
 * truy vấn vỡ, nên bỏ hết ra trước khi ghép chuỗi.
 */
function sanitize(raw: string): string {
  return raw
    .replace(/[,()*%\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export default async function NguoiChoiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; loc?: string; trang?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/vao');

  const sp = await searchParams;
  const rawQuery = (sp.q ?? '').trim();
  const term = sanitize(rawQuery);
  const status: Status | null =
    sp.loc === 'hoat_dong' || sp.loc === 'khoa' ? (sp.loc as Status) : null;
  const filtering = Boolean(term || status);

  const supabase = db();
  const today = currentDayNumber() ?? 0;

  /** Cùng bộ điều kiện dùng cho cả lần đếm lẫn lần lấy dữ liệu. */
  const filtered = (select: string, head = false) => {
    let q = supabase.from('players').select(select, { count: 'exact', head });
    if (term) {
      q = q.or(
        `code.ilike.%${term}%,display_name.ilike.%${term}%,contact.ilike.%${term}%`,
      );
    }
    if (status) q = q.eq('is_active', status === 'hoat_dong');
    return q;
  };

  // Đếm trước để biết có bao nhiêu trang, rồi mới kẹp số trang vào khoảng hợp
  // lệ — tránh trang trắng khi xoá người cuối cùng của trang cuối.
  const { count } = await filtered('id', true);
  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.trang) || 1), pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const { data: players } = await filtered('*')
    // Sắp xếp phụ theo mã: khi hai người bằng điểm, thứ tự phải cố định giữa
    // các lần truy vấn, nếu không sẽ có người bị nhảy trang hoặc hiện hai lần.
    .order('points', { ascending: false })
    .order('code', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const list = (players ?? []) as unknown as PlayerRow[];
  const ids = list.map((p) => p.id);

  // Chỉ đếm check-in và mảnh trăng cho 5 người đang hiện, không kéo cả bảng về.
  const doneBy = new Map<string, number>();
  const fragBy = new Map<string, number>();
  if (ids.length) {
    const [{ data: checkins }, { data: fragments }] = await Promise.all([
      supabase.from('checkins').select('player_id,by_freeze').in('player_id', ids),
      supabase.from('fragments').select('player_id').in('player_id', ids),
    ]);
    for (const c of checkins ?? []) {
      if (c.by_freeze) continue;
      doneBy.set(c.player_id, (doneBy.get(c.player_id) ?? 0) + 1);
    }
    for (const f of fragments ?? []) fragBy.set(f.player_id, (fragBy.get(f.player_id) ?? 0) + 1);
  }

  /** Giữ nguyên bộ lọc khi chuyển trang. */
  const hrefFor = (n: number) => {
    const p = new URLSearchParams();
    if (rawQuery) p.set('q', rawQuery);
    if (status) p.set('loc', status);
    if (n > 1) p.set('trang', String(n));
    const qs = p.toString();
    return qs ? `/admin/nguoi-choi?${qs}` : '/admin/nguoi-choi';
  };

  let windowStart = Math.max(1, page - Math.floor(PAGER_WINDOW / 2));
  const windowEnd = Math.min(pageCount, windowStart + PAGER_WINDOW - 1);
  windowStart = Math.max(1, windowEnd - PAGER_WINDOW + 1);
  const pageNumbers = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i,
  );

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{totalCount} người có mã</span>
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
          <p className="coach-note" style={{ marginBottom: 0 }}>
            Bấm vào tên để xem hành trình học tập chi tiết của từng người.
          </p>

          {/* Form GET: không cần JS, và bỏ qua "trang" nên tìm xong luôn về trang 1. */}
          <form method="get" className="filter-bar">
            <div className="field" style={{ marginBottom: 0, flex: '1 1 260px' }}>
              <label htmlFor="q">Tìm người chơi</label>
              <input
                id="q"
                name="q"
                type="text"
                defaultValue={rawQuery}
                placeholder="mã, tên hoặc liên hệ"
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: '0 1 180px' }}>
              <label htmlFor="loc">Trạng thái</label>
              <select id="loc" name="loc" defaultValue={status ?? ''}>
                <option value="">Tất cả</option>
                <option value="hoat_dong">Đang hoạt động</option>
                <option value="khoa">Đã khoá</option>
              </select>
            </div>
            <div className="btn-row" style={{ paddingBottom: 2 }}>
              <button type="submit" className="btn-primary btn-small">
                Tìm
              </button>
              {filtering ? (
                <a href="/admin/nguoi-choi" className="btn-ghost btn-small">
                  Xoá lọc
                </a>
              ) : null}
            </div>
          </form>

          {filtering ? (
            <p className="notice ok">
              {totalCount} kết quả
              {term ? <> cho “{term}”</> : null}
              {status ? <> · {status === 'hoat_dong' ? 'đang hoạt động' : 'đã khoá'}</> : null}
            </p>
          ) : null}

          <div className="table-scroll">
            <table className="data wide">
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
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const done = doneBy.get(p.id) ?? 0;
                  return (
                    <tr key={p.id}>
                      <td className="num">{p.code}</td>
                      <td>
                        <Link href={`/admin/nguoi-choi/${p.id}`} className="player-link">
                          {p.display_name}
                        </Link>
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
                        <PlayerRowActions player={p} />
                      </td>
                    </tr>
                  );
                })}
                {!list.length ? (
                  <tr>
                    <td colSpan={9}>
                      {filtering
                        ? 'Không có ai khớp bộ lọc này.'
                        : 'Chưa có ai. Tạo mã ở khung phía trên.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <nav className="pager" aria-label="Phân trang danh sách người chơi">
              {page > 1 ? (
                <a href={hrefFor(page - 1)} rel="prev">
                  ← Trước
                </a>
              ) : (
                <span className="off">← Trước</span>
              )}

              {windowStart > 1 ? <span className="gap">…</span> : null}

              {pageNumbers.map((n) =>
                n === page ? (
                  <span key={n} className="here" aria-current="page">
                    {n}
                  </span>
                ) : (
                  <a key={n} href={hrefFor(n)}>
                    {n}
                  </a>
                ),
              )}

              {windowEnd < pageCount ? <span className="gap">…</span> : null}

              {page < pageCount ? (
                <a href={hrefFor(page + 1)} rel="next">
                  Sau →
                </a>
              ) : (
                <span className="off">Sau →</span>
              )}

              <span className="pager-info">
                Trang {page}/{pageCount} · {totalCount} người
              </span>
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
