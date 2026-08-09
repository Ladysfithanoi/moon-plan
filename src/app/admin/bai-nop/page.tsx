import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import RichText from '@/components/RichText';
import { isAdmin } from '@/lib/session';
import { db, CASE_STUDY_BUCKET } from '@/lib/supabase';
import { fullDate } from '@/lib/event';
import { markBestCaseStudy, reviewSubmission } from '../actions';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  day: number;
  kind: 'thu_thach' | 'case_study';
  body: string;
  files: { path: string; name: string; size: number }[];
  status: 'pending' | 'approved' | 'needs_work';
  admin_note: string | null;
  is_best: boolean;
  created_at: string;
  players: { code: string; display_name: string } | null;
  days: { title: string; date: string } | null;
};

const STATUS_LABEL: Record<Row['status'], string> = {
  pending: 'chờ đọc',
  approved: 'đã duyệt',
  needs_work: 'cần sửa',
};

export default async function BaiNopPage({
  searchParams,
}: {
  searchParams: Promise<{ loc?: string; trang_thai?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/vao');

  const sp = await searchParams;
  const kindFilter = sp.loc === 'case_study' || sp.loc === 'thu_thach' ? sp.loc : null;
  const statusFilter = ['pending', 'approved', 'needs_work'].includes(sp.trang_thai ?? '')
    ? sp.trang_thai
    : null;

  const supabase = db();
  let query = supabase
    .from('submissions')
    .select('*, players(code,display_name), days(title,date)')
    .order('created_at', { ascending: false });

  if (kindFilter) query = query.eq('kind', kindFilter);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Bucket riêng tư — phải ký link mới xem được, hạn 1 giờ.
  const signed = new Map<string, string>();
  for (const r of rows) {
    for (const f of r.files ?? []) {
      const { data: s } = await supabase.storage
        .from(CASE_STUDY_BUCKET)
        .createSignedUrl(f.path, 3600);
      if (s?.signedUrl) signed.set(f.path, s.signedUrl);
    }
  }

  const filters = [
    { href: '/admin/bai-nop', label: 'Tất cả' },
    { href: '/admin/bai-nop?trang_thai=pending', label: 'Chờ đọc' },
    { href: '/admin/bai-nop?loc=case_study', label: 'Case study chung kết' },
    { href: '/admin/bai-nop?loc=thu_thach', label: 'Thử thách tuần' },
  ];

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{rows.length} bài</span>
          </p>
          <h1 className="display">Bài nộp</h1>
          <div className="btn-row" style={{ marginTop: 18 }}>
            {filters.map((f) => (
              <a key={f.href} href={f.href} className="btn-ghost btn-small">
                {f.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          {rows.map((r) => (
            <article key={r.id} style={{ marginBottom: 44 }}>
              <p className="eyebrow">
                <span className="rule" />
                <span>
                  Ngày {r.day} · {r.kind === 'case_study' ? 'Case study chung kết' : 'Thử thách áp dụng'}
                  {r.days ? ` · ${fullDate(r.days.date)}` : ''}
                </span>
              </p>
              <h2 className="card-title">
                {r.players?.display_name ?? 'Không rõ'}{' '}
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-40)' }}>
                  {r.players?.code}
                </span>
                {r.is_best ? <> · <span className="tag ok">xuất sắc nhất</span></> : null}
              </h2>
              <p className="coach-note">
                <span className={`tag ${r.status === 'approved' ? 'ok' : r.status === 'needs_work' ? 'bad' : 'wait'}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {r.days ? ` · ${r.days.title}` : ''}
              </p>

              {r.body ? <RichText text={r.body} /> : <p className="notice info">Không có phần chữ.</p>}

              {r.files?.length ? (
                <p className="coach-note" style={{ marginTop: 14 }}>
                  Đính kèm:{' '}
                  {r.files.map((f, i) => {
                    const url = signed.get(f.path);
                    return (
                      <span key={f.path}>
                        {i > 0 ? ' · ' : ''}
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {f.name}
                          </a>
                        ) : (
                          f.name
                        )}
                      </span>
                    );
                  })}
                </p>
              ) : null}

              <div className="btn-row" style={{ marginTop: 18, alignItems: 'flex-start' }}>
                <ActionForm action={reviewSubmission} submitLabel="Lưu nhận xét" style={{ flex: '1 1 320px' }}>
                  <input type="hidden" name="id" value={r.id} />
                  <div className="field">
                    <label htmlFor={`status-${r.id}`}>Trạng thái</label>
                    <select id={`status-${r.id}`} name="status" defaultValue={r.status}>
                      <option value="pending">Chờ đọc</option>
                      <option value="approved">Đã duyệt</option>
                      <option value="needs_work">Cần sửa</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`note-${r.id}`}>Nhận xét riêng</label>
                    <textarea
                      id={`note-${r.id}`}
                      name="admin_note"
                      rows={3}
                      defaultValue={r.admin_note ?? ''}
                    />
                  </div>
                </ActionForm>

                {r.kind === 'case_study' && !r.is_best ? (
                  <ActionForm action={markBestCaseStudy} submitLabel="Chọn là xuất sắc nhất" ghost>
                    <input type="hidden" name="id" value={r.id} />
                  </ActionForm>
                ) : null}
              </div>

              <hr className="divider" />
            </article>
          ))}

          {!rows.length ? <p className="notice info">Chưa có bài nộp nào ở bộ lọc này.</p> : null}
        </div>
      </section>
    </>
  );
}
