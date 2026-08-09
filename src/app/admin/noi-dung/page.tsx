import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import { isAdmin } from '@/lib/session';
import { db } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber, fullDate } from '@/lib/event';
import { DAY_TYPE_LABEL, type DayType } from '@/lib/scoring';
import QuestionForm, { OPTION_LABELS, type QuestionDraft } from '@/components/QuestionForm';
import {
  createQuestion,
  deleteQuestion,
  importQuizExcel,
  updateDay,
  updateQuestion,
} from '../actions';

export const dynamic = 'force-dynamic';

type DayRecord = {
  day: number;
  date: string;
  weekday: string;
  week: number;
  day_type: DayType;
  title: string;
  body: string;
  prompt: string | null;
  webinar_code: string | null;
  webinar_link: string | null;
};

export default async function NoiDungPage({
  searchParams,
}: {
  searchParams: Promise<{ ngay?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/vao');

  const sp = await searchParams;
  const selected = Number(sp.ngay);
  const editing = Number.isInteger(selected) && selected >= 1 && selected <= TOTAL_DAYS ? selected : null;
  const today = currentDayNumber();

  const supabase = db();

  if (editing) {
    const [{ data: dayData }, { data: questionData }] = await Promise.all([
      supabase.from('days').select('*').eq('day', editing).maybeSingle(),
      supabase
        .from('questions')
        .select('id,ord,prompt,options,correct_index,explain')
        .eq('day', editing)
        .order('ord'),
    ]);

    const d = dayData as DayRecord | null;
    if (!d) {
      return (
        <section className="fade-in">
          <div className="wrap-wide">
            <p className="notice err">
              Chưa có ngày {editing} trong cơ sở dữ liệu. Chạy <span className="mono">npm run seed</span> trước.
            </p>
            <Link href="/admin/noi-dung">Về danh sách</Link>
          </div>
        </section>
      );
    }

    const questions = (questionData ?? []) as QuestionDraft[];
    const isWebinar = d.day_type === 'webinar' || d.day_type === 'dem_hoi';

    return (
      <>
        <section className="fade-in">
          <div className="wrap-wide">
            <p className="eyebrow">
              <span className="rule" />
              <span>
                Ngày {d.day}/{TOTAL_DAYS} · Tuần {d.week} · {d.weekday} {fullDate(d.date)} ·{' '}
                {DAY_TYPE_LABEL[d.day_type]}
              </span>
            </p>
            <h1 className="display">Sửa nội dung</h1>
            <Link href="/admin/noi-dung" className="btn-ghost btn-small">
              Về danh sách 47 ngày
            </Link>
          </div>
        </section>

        <section className="fade-in">
          <div className="wrap-wide">
            <ActionForm action={updateDay} submitLabel="Lưu nội dung ngày" style={{ maxWidth: 760 }}>
              <input type="hidden" name="day" value={d.day} />
              <div className="field">
                <label htmlFor="title">Tiêu đề</label>
                <input id="title" name="title" type="text" defaultValue={d.title} required />
              </div>
              <div className="field">
                <label htmlFor="body">Bài đọc</label>
                <textarea id="body" name="body" rows={16} defaultValue={d.body} />
                <span className="hint">
                  Dòng trống để ngăn đoạn. Bọc **hai dấu sao** để in đậm. Không nhận thẻ HTML.
                </span>
              </div>
              <div className="field">
                <label htmlFor="prompt">Đề bài (chỉ dùng cho ngày thử thách / case study)</label>
                <textarea id="prompt" name="prompt" rows={8} defaultValue={d.prompt ?? ''} />
              </div>

              {isWebinar ? (
                <>
                  <div className="field">
                    <label htmlFor="webinar_code">Mã điểm danh</label>
                    <input
                      id="webinar_code"
                      name="webinar_code"
                      type="text"
                      className="mono"
                      defaultValue={d.webinar_code ?? ''}
                      placeholder="vd: GOCDA1"
                    />
                    <span className="hint">
                      Đọc mã này ở cuối buổi. Trước khi đặt mã, người chơi không điểm danh được — và mã
                      không bao giờ được gửi xuống trình duyệt.
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="webinar_link">Link phòng họp</label>
                    <input
                      id="webinar_link"
                      name="webinar_link"
                      type="url"
                      defaultValue={d.webinar_link ?? ''}
                      placeholder="https://…"
                    />
                  </div>
                </>
              ) : null}
            </ActionForm>
          </div>
        </section>

        <section className="fade-in">
          <div className="wrap-wide">
            <p className="eyebrow">
              <span className="rule" />
              <span>Câu hỏi quiz</span>
            </p>
            <h2 className="section-title">{questions.length} câu</h2>
            <p className="lede">
              Mỗi câu đúng 4 lựa chọn và đúng 1 đáp án. Đáp án nằm ở máy chủ — người chơi không xem
              được kể cả khi mở mã nguồn trang.
            </p>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <a className="btn-ghost btn-small" href={`/admin/noi-dung/tai-quiz?ngay=${d.day}`}>
                Tải Excel ngày này
              </a>
            </div>

            {questions.map((q) => (
              <div className="repeat-row" key={q.id} style={{ marginTop: 26 }}>
                <div className="repeat-head">
                  <span className="repeat-index">Câu {q.ord}</span>
                  <span className="hint">
                    đáp án đúng: {OPTION_LABELS[q.correct_index] ?? '?'}
                  </span>
                </div>
                <QuestionForm action={updateQuestion} submitLabel="Lưu câu này" question={q} />
                <ActionForm
                  action={deleteQuestion}
                  submitLabel="Xoá câu này"
                  busyLabel="Đang xoá…"
                  ghost
                >
                  <input type="hidden" name="id" value={q.id} />
                </ActionForm>
              </div>
            ))}

            <hr className="divider" />
            <h3 className="card-title">Thêm câu hỏi</h3>
            <QuestionForm action={createQuestion} submitLabel="Thêm câu hỏi" day={d.day} />
          </div>
        </section>
      </>
    );
  }

  // ─── Danh sách 47 ngày ─────────────────────────────────────────────────
  const [{ data: days }, { data: questions }] = await Promise.all([
    supabase.from('days').select('day,date,weekday,week,day_type,title,webinar_code').order('day'),
    supabase.from('questions').select('day'),
  ]);

  const qCount = new Map<number, number>();
  for (const q of questions ?? []) qCount.set(q.day, (qCount.get(q.day) ?? 0) + 1);

  const list = (days ?? []) as Pick<
    DayRecord,
    'day' | 'date' | 'weekday' | 'week' | 'day_type' | 'title' | 'webinar_code'
  >[];

  const totalQuestions = (questions ?? []).length;

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{list.length}/47 ngày đã có nội dung</span>
          </p>
          <h1 className="display">Nội dung 47 ngày</h1>

          {list.length < TOTAL_DAYS ? (
            <p className="notice err">
              Thiếu {TOTAL_DAYS - list.length} ngày. Chạy <span className="mono">npm run seed</span>{' '}
              để nạp từ thư mục content/.
            </p>
          ) : null}
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Quiz bằng Excel</span>
          </p>
          <h2 className="section-title">Sửa hàng loạt {totalQuestions} câu hỏi</h2>
          <p className="lede">
            Tải file về, sửa trong Excel, rồi nạp ngược lại. Cùng một bộ cột nên đi vòng tròn được.
            Cột <span className="mono">Đáp án đúng</span> ghi 1, 2, 3 hoặc 4.
          </p>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <a className="btn-ghost btn-small" href="/admin/noi-dung/tai-quiz">
              Tải toàn bộ quiz (.xlsx)
            </a>
          </div>

          <div style={{ maxWidth: 520, marginTop: 24 }}>
            <ActionForm
              action={importQuizExcel}
              submitLabel="Nhập từ Excel"
              busyLabel="Đang đọc file…"
            >
              <div className="field">
                <label htmlFor="file">Chọn file .xlsx</label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                />
              </div>
            </ActionForm>
          </div>

          <p className="coach-note" style={{ marginTop: 18 }}>
            Chỉ những ngày có trong file mới bị đụng tới. Trong mỗi ngày, câu thứ nhất của file ghi
            đè lên câu thứ nhất đang có, thừa thì xoá, thiếu thì thêm. Sai một dòng là không ghi gì
            cả — báo lỗi kèm số dòng để sửa.
          </p>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Từng ngày</span>
          </p>
          <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Lịch</th>
                <th>Tuần</th>
                <th>Loại</th>
                <th>Tiêu đề</th>
                <th>Câu hỏi</th>
                <th>Mã điểm danh</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.day}>
                  <td className="num">
                    {d.day}
                    {today === d.day ? ' ←' : ''}
                  </td>
                  <td className="num">{fullDate(d.date)}</td>
                  <td className="num">{d.week}</td>
                  <td>{DAY_TYPE_LABEL[d.day_type]}</td>
                  <td>
                    <Link href={`/admin/noi-dung?ngay=${d.day}`}>{d.title}</Link>
                  </td>
                  <td className="num">{qCount.get(d.day) ?? 0}</td>
                  <td>
                    {d.day_type === 'webinar' || d.day_type === 'dem_hoi' ? (
                      d.webinar_code ? (
                        <span className="tag ok">đã đặt</span>
                      ) : (
                        <span className="tag bad">chưa đặt</span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </>
  );
}
