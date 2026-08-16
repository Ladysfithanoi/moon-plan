import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import { isAdmin } from '@/lib/session';
import { db, describeSupabaseConfig } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber, dateForDay, fullDate, vnDateTimeInput } from '@/lib/event';
import { DAY_TYPE_LABEL, type DayType } from '@/lib/scoring';
import QuestionForm, { OPTION_LABELS, type QuestionDraft } from '@/components/QuestionForm';
import {
  createDay,
  createQuestion,
  deleteDay,
  deleteQuestion,
  importDaysExcel,
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
  phase: string;
  week_theme: string;
  day_type: DayType;
  title: string;
  body: string;
  prompt: string | null;
  mechanic: string | null;
  webinar_code: string | null;
  webinar_link: string | null;
  webinar_at: string | null;
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

              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="day_type">Loại ngày</label>
                  <select id="day_type" name="day_type" defaultValue={d.day_type}>
                    {Object.entries(DAY_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Quyết định điểm và cơ chế của ngày.</span>
                </div>
                <div className="field">
                  <label htmlFor="phase">Giai đoạn</label>
                  <input id="phase" name="phase" type="text" defaultValue={d.phase} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="week_theme">Chủ đề tuần</label>
                <input id="week_theme" name="week_theme" type="text" defaultValue={d.week_theme} />
              </div>
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
                <label htmlFor="prompt">Đề bài / case study</label>
                <textarea id="prompt" name="prompt" rows={8} defaultValue={d.prompt ?? ''} />
                <span className="hint">
                  Ngày thử thách và case study chung kết: đây là đề để người chơi nộp bài. Các ngày
                  còn lại — kể cả trạm dừng gốc đa: phần này hiện ngay dưới bài đọc, dùng để đặt
                  tình huống case study cho buổi.
                </span>
              </div>
              <div className="field">
                <label htmlFor="mechanic">Cơ chế (dòng mô tả luật chơi hiện cho người chơi)</label>
                <input id="mechanic" name="mechanic" type="text" defaultValue={d.mechanic ?? ''} />
              </div>

              {isWebinar ? (
                <>
                  <div className="field">
                    <label htmlFor="webinar_at">Giờ vào phòng</label>
                    <input
                      id="webinar_at"
                      name="webinar_at"
                      type="datetime-local"
                      defaultValue={d.webinar_at ? vnDateTimeInput(d.webinar_at) : ''}
                    />
                    <span className="hint">
                      Giờ Việt Nam. Người chơi thấy giờ này trên thẻ ngày, và được nhắc bằng một
                      dải báo từ sáng hôm trước cho tới khi buổi kết thúc.
                    </span>
                  </div>
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

            <div className="btn-row" style={{ marginTop: 22 }}>
              <a className="btn-ghost btn-small" href={`/admin/noi-dung/tai-noi-dung?ngay=${d.day}`}>
                Tải nội dung ngày này (.xlsx)
              </a>
            </div>

            <hr className="divider" />
            <h3 className="card-title">Xoá ngày này</h3>
            <p className="hint" style={{ maxWidth: 620, marginBottom: 12 }}>
              Xoá ngày {d.day} sẽ cuốn theo toàn bộ câu hỏi, lượt check-in và bài nộp của ngày đó —
              không khôi phục được. Muốn tạm ẩn thì sửa nội dung, đừng xoá.
            </p>
            <ActionForm action={deleteDay} submitLabel="Xoá ngày" busyLabel="Đang xoá…" ghost>
              <input type="hidden" name="day" value={d.day} />
              <div className="field" style={{ maxWidth: 220 }}>
                <input
                  name="confirm_day"
                  type="text"
                  placeholder={String(d.day)}
                  autoComplete="off"
                  aria-label={`Gõ số ${d.day} để xác nhận xoá`}
                />
                <span className="hint">gõ số {d.day} để xác nhận</span>
              </div>
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
  const [{ data: days, error: daysError }, { data: questions }] = await Promise.all([
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
  const config = describeSupabaseConfig();
  const present = new Set(list.map((d) => d.day));
  const missingDays = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1).filter(
    (n) => !present.has(n),
  );

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{list.length}/47 ngày đã có nội dung</span>
          </p>
          <h1 className="display">Nội dung 47 ngày</h1>

          {/*
            Phân biệt hai chuyện rất khác nhau mà trước đây hiện giống hệt: cơ sở
            dữ liệu thật sự chưa có nội dung, hay là không kết nối được. Kết nối
            hỏng mà báo "thiếu 47 ngày" thì càng chạy seed càng không ra.
          */}
          {daysError ? (
            <div className="notice err">
              <p>Không đọc được bảng nội dung: {daysError.message}</p>
              <p style={{ marginTop: 6 }}>
                Supabase đang trỏ tới <span className="mono">{config.host}</span>
              </p>
              {config.problem ? (
                <p style={{ marginTop: 6 }}>{config.problem}</p>
              ) : (
                <p style={{ marginTop: 6 }}>
                  Cấu hình trông đúng dạng — kiểm tra service_role key và xem project Supabase này
                  đã chạy migration chưa.
                </p>
              )}
            </div>
          ) : missingDays.length ? (
            <div className="notice err">
              <p>
                Thiếu {missingDays.length} ngày: {missingDays.slice(0, 12).join(', ')}
                {missingDays.length > 12 ? '…' : ''}. Chạy{' '}
                <span className="mono">npm run seed</span> để nạp cả loạt từ thư mục content/, hoặc
                tạo tay ở khung bên dưới.
              </p>
              {missingDays.length === TOTAL_DAYS ? (
                <p style={{ marginTop: 6 }}>
                  Trống sạch cả {TOTAL_DAYS} ngày thường là do bản deploy trỏ nhầm project
                  Supabase. Bản này đang dùng <span className="mono">{config.host}</span>
                  {config.problem ? ` — ${config.problem}` : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Nội dung bằng Excel</span>
          </p>
          <h2 className="section-title">Sửa hàng loạt {list.length} ngày</h2>
          <p className="lede">
            Tải file về, sửa trong Excel, rồi nạp ngược lại. Ngày nào có trong file thì ghi đè, chưa
            có thì tạo mới; ngày không xuất hiện trong file được để yên.
          </p>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <a className="btn-ghost btn-small" href="/admin/noi-dung/tai-noi-dung">
              Tải toàn bộ nội dung (.xlsx)
            </a>
          </div>

          <div style={{ maxWidth: 520, marginTop: 24 }}>
            <ActionForm
              action={importDaysExcel}
              submitLabel="Nhập nội dung từ Excel"
              busyLabel="Đang đọc file…"
            >
              <div className="field">
                <label htmlFor="file-days">Chọn file .xlsx</label>
                <input
                  id="file-days"
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                />
              </div>
            </ActionForm>
          </div>

          <p className="coach-note" style={{ marginTop: 18 }}>
            Cột <span className="mono">Ngày dương lịch</span> và <span className="mono">Thứ</span>{' '}
            chỉ để đối chiếu — nhập vào sẽ bị bỏ qua và tính lại từ mốc khởi động, tránh lệch với
            phép tính “hôm nay là ngày thứ mấy”. Cột <span className="mono">Mã điểm danh</span> chứa
            mã thật của webinar, đừng gửi file này cho học viên.
          </p>

          <hr className="divider" />
          <h3 className="card-title">Thêm một ngày còn trống</h3>
          {missingDays.length ? (
            <ActionForm action={createDay} submitLabel="Tạo ngày" style={{ maxWidth: 620 }}>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="new-day">Số ngày</label>
                  <select id="new-day" name="day" defaultValue={String(missingDays[0])}>
                    {missingDays.map((n) => (
                      <option key={n} value={n}>
                        Ngày {n} · {fullDate(dateForDay(n))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="new-type">Loại ngày</label>
                  <select id="new-type" name="day_type" defaultValue="kien_thuc">
                    {Object.entries(DAY_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-title">Tiêu đề</label>
                <input id="new-title" name="title" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="new-body">Bài đọc</label>
                <textarea id="new-body" name="body" rows={6} required />
              </div>
            </ActionForm>
          ) : (
            <p className="hint">Đủ cả {TOTAL_DAYS} ngày, không thiếu ngày nào.</p>
          )}
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
