import Link from 'next/link';
import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import { isAdmin } from '@/lib/session';
import { db, fetchAllRows } from '@/lib/supabase';
import { TOTAL_DAYS, currentDayNumber, eventStatus, shortDate, vnToday } from '@/lib/event';
import { getSettings, maxPoints } from '@/lib/settings';
import { DAY_TYPE_LABEL, type DayType } from '@/lib/scoring';
import { adminLogout, drawHonorRollAction } from './actions';

export const dynamic = 'force-dynamic';

type PlayerLite = {
  id: string;
  code: string;
  display_name: string;
  points: number;
  streak: number;
  is_active: boolean;
  freezes_used: number;
};
type DayLite = { day: number; week: number; date: string; day_type: DayType; title: string };
type CheckinLite = {
  player_id: string;
  day: number;
  by_freeze: boolean;
  correct_count: number;
  total_count: number;
};
type SubLite = { player_id: string; day: number; kind: string; status: string; is_best: boolean };
type QuestionLite = { id: string; day: number; ord: number; prompt: string };

/** Bao nhiêu lượt trả lời thì con số "tỉ lệ sai" mới đáng tin. */
const MIN_ANSWERS = 3;

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Một dòng thanh ngang: nhãn · thanh · số. */
function Bar({
  label,
  hint,
  value,
  percent,
  tone,
}: {
  label: string;
  hint?: string;
  value: string;
  percent: number;
  tone?: 'herb' | 'clay';
}) {
  return (
    <div className="bar-row" title={hint}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill${tone ? ` ${tone}` : ''}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="bar-val">{value}</span>
    </div>
  );
}

export default async function AdminHome() {
  if (!(await isAdmin())) redirect('/admin/vao');

  const supabase = db();
  const today = currentDayNumber();
  const status = eventStatus();
  const openedDays = Math.min(today ?? 0, TOTAL_DAYS);

  const settings = await getSettings();
  const weekThemes = settings.weekThemes;

  const [players, days, checkins, subs, fragments, honor, answers, questions] = await Promise.all([
    fetchAllRows<PlayerLite>((f, t) =>
      supabase
        .from('players')
        .select('id,code,display_name,points,streak,is_active,freezes_used')
        .range(f, t),
    ),
    fetchAllRows<DayLite>((f, t) =>
      supabase.from('days').select('day,week,date,day_type,title').order('day').range(f, t),
    ),
    fetchAllRows<CheckinLite>((f, t) =>
      supabase
        .from('checkins')
        .select('player_id,day,by_freeze,correct_count,total_count')
        .range(f, t),
    ),
    fetchAllRows<SubLite>((f, t) =>
      supabase.from('submissions').select('player_id,day,kind,status,is_best').range(f, t),
    ),
    fetchAllRows<{ player_id: string; week: number }>((f, t) =>
      supabase.from('fragments').select('player_id,week').range(f, t),
    ),
    fetchAllRows<{ week: number }>((f, t) => supabase.from('honor_roll').select('week').range(f, t)),
    fetchAllRows<{ question_id: string; is_correct: boolean }>((f, t) =>
      supabase.from('answers').select('question_id,is_correct').range(f, t),
    ),
    fetchAllRows<QuestionLite>((f, t) =>
      supabase.from('questions').select('id,day,ord,prompt').range(f, t),
    ),
  ]);

  const activePlayers = players.filter((p) => p.is_active);
  const realCheckins = checkins.filter((c) => !c.by_freeze);

  // ─── Con số tổng ─────────────────────────────────────────────────────────
  const doneToday = today
    ? new Set(realCheckins.filter((c) => c.day === today).map((c) => c.player_id)).size
    : 0;
  const pendingSubs = subs.filter((s) => s.status === 'pending').length;
  const avgCompletion = pct(realCheckins.length, players.length * openedDays);
  const avgPoints = players.length
    ? Math.round(players.reduce((s, p) => s + p.points, 0) / players.length)
    : 0;
  const freezesUsed = players.reduce((s, p) => s + p.freezes_used, 0);

  const totalQ = checkins.reduce((s, c) => s + c.total_count, 0);
  const correctQ = checkins.reduce((s, c) => s + c.correct_count, 0);

  const fragBy = new Map<string, number>();
  for (const f of fragments) fragBy.set(f.player_id, (fragBy.get(f.player_id) ?? 0) + 1);
  const fullSix = [...fragBy.values()].filter((n) => n >= 6).length;

  const drawnWeeks = new Set(honor.map((h) => h.week));

  // ─── Nhịp theo ngày ──────────────────────────────────────────────────────
  const doneByDay = new Map<number, number>();
  const freezeByDay = new Map<number, number>();
  for (const c of checkins) {
    const bucket = c.by_freeze ? freezeByDay : doneByDay;
    bucket.set(c.day, (bucket.get(c.day) ?? 0) + 1);
  }
  const dayRows = days.filter((d) => d.day <= openedDays).reverse();

  // ─── Theo tuần ───────────────────────────────────────────────────────────
  const weekRows = weekThemes.map((theme, i) => {
    const week = i + 1;
    const weekDays = days.filter((d) => d.week === week && d.day <= openedDays);
    const dayNums = new Set(weekDays.map((d) => d.day));
    const done = realCheckins.filter((c) => dayNums.has(c.day)).length;
    return {
      week,
      theme,
      openedDays: weekDays.length,
      participation: pct(done, weekDays.length * players.length),
      fragments: fragments.filter((f) => f.week === week).length,
      submissions: subs.filter((s) => dayNums.has(s.day)).length,
      drawn: drawnWeeks.has(week),
      started: (today ?? 0) >= (week - 1) * 7 + 1,
    };
  });

  // ─── Từng người: đã làm bao nhiêu ngày, im ắng bao lâu ───────────────────
  const doneByPlayer = new Map<string, number>();
  const lastDayByPlayer = new Map<string, number>();
  for (const c of realCheckins) {
    doneByPlayer.set(c.player_id, (doneByPlayer.get(c.player_id) ?? 0) + 1);
    lastDayByPlayer.set(c.player_id, Math.max(lastDayByPlayer.get(c.player_id) ?? 0, c.day));
  }

  const BUCKETS = [
    { label: '90–100%', min: 90 },
    { label: '70–89%', min: 70 },
    { label: '40–69%', min: 40 },
    { label: '1–39%', min: 1 },
    { label: 'chưa bắt đầu', min: 0 },
  ];
  const buckets = BUCKETS.map((b, i) => {
    const upper = i === 0 ? 101 : BUCKETS[i - 1].min;
    const count = players.filter((p) => {
      const v = pct(doneByPlayer.get(p.id) ?? 0, openedDays);
      return v >= b.min && v < upper;
    }).length;
    return { ...b, count };
  });

  const leaders = [...players].sort((a, b) => b.points - a.points || a.code.localeCompare(b.code)).slice(0, 5);

  const quiet = activePlayers
    .map((p) => ({
      player: p,
      quiet: openedDays - (lastDayByPlayer.get(p.id) ?? 0),
      done: doneByPlayer.get(p.id) ?? 0,
    }))
    .filter((q) => openedDays > 0 && q.quiet >= 2)
    .sort((a, b) => b.quiet - a.quiet || a.done - b.done)
    .slice(0, 8);

  // ─── Câu hỏi cả lớp hay sai ──────────────────────────────────────────────
  const questionBy = new Map(questions.map((q) => [q.id, q]));
  const answerStat = new Map<string, { total: number; wrong: number }>();
  for (const a of answers) {
    const s = answerStat.get(a.question_id) ?? { total: 0, wrong: 0 };
    s.total += 1;
    if (!a.is_correct) s.wrong += 1;
    answerStat.set(a.question_id, s);
  }
  const hardest = [...answerStat.entries()]
    .filter(([, s]) => s.total >= MIN_ANSWERS && s.wrong > 0)
    .map(([qid, s]) => ({ q: questionBy.get(qid), ...s, rate: pct(s.wrong, s.total) }))
    .filter((x): x is { q: QuestionLite; total: number; wrong: number; rate: number } => Boolean(x.q))
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
    .slice(0, 6);

  const statusLabel =
    status === 'truoc'
      ? 'chưa khởi động'
      : status === 'da-xong'
        ? 'đã kết thúc'
        : `ngày ${today}/${TOTAL_DAYS}`;

  const maxDayCount = Math.max(1, ...dayRows.map((d) => doneByDay.get(d.day) ?? 0));

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>
              {vnToday()} · {statusLabel}
            </span>
          </p>
          <h1 className="display">Tổng quan</h1>

          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-num">{players.length}</span>
              <span className="kpi-label">người có mã ({activePlayers.length} đang hoạt động)</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{doneToday}</span>
              <span className="kpi-label">đã check-in hôm nay</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{avgCompletion}%</span>
              <span className="kpi-label">tỉ lệ hoàn thành trung bình</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{avgPoints}</span>
              <span className="kpi-label">điểm trung bình / {maxPoints(settings.scoring)} tối đa</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{totalQ ? `${pct(correctQ, totalQ)}%` : '—'}</span>
              <span className="kpi-label">câu quiz trả lời đúng ({correctQ}/{totalQ})</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{fullSix}</span>
              <span className="kpi-label">người đủ 6 mảnh trăng</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{freezesUsed}</span>
              <span className="kpi-label">vé cứu đã dùng</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{pendingSubs}</span>
              <span className="kpi-label">
                bài chờ đọc — <Link href="/admin/bai-nop">xem</Link>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Nhịp theo ngày ─────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Nhịp theo ngày</span>
          </p>
          <h2 className="section-title">Mỗi ngày có bao nhiêu người làm</h2>
          <p className="lede">
            Ngày mới nhất ở trên. Thanh đo theo {players.length} người có mã; số trong ngoặc là số
            ngày được vé cứu bù vào.
          </p>

          <div className="bar-list">
            {dayRows.map((d) => {
              const done = doneByDay.get(d.day) ?? 0;
              const freeze = freezeByDay.get(d.day) ?? 0;
              return (
                <Bar
                  key={d.day}
                  label={`Ngày ${d.day}`}
                  hint={`${shortDate(d.date)} · ${d.title} · ${DAY_TYPE_LABEL[d.day_type]}`}
                  percent={pct(done, players.length)}
                  tone={done >= maxDayCount * 0.6 ? 'herb' : undefined}
                  value={`${done}${freeze ? ` (+${freeze})` : ''} · ${pct(done, players.length)}%`}
                />
              );
            })}
            {!dayRows.length ? <p className="notice info">Sự kiện chưa mở ngày nào.</p> : null}
          </div>
        </div>
      </section>

      {/* ─── Theo tuần ──────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Theo tuần</span>
          </p>
          <h2 className="section-title">Từng chặng đi thế nào</h2>

          <div className="table-scroll">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Tuần</th>
                  <th>Chủ đề</th>
                  <th>Ngày đã mở</th>
                  <th>Tham gia</th>
                  <th>Mảnh trăng</th>
                  <th>Bài nộp</th>
                  <th>Vinh danh</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map((w) => (
                  <tr key={w.week}>
                    <td className="num">{w.week}</td>
                    <td>{w.theme}</td>
                    <td className="num">{w.openedDays}</td>
                    <td>
                      {w.openedDays ? (
                        <span className="inline-bar">
                          <span className="bar-track">
                            <span className="bar-fill" style={{ width: `${w.participation}%` }} />
                          </span>
                          <span className="mono">{w.participation}%</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">{w.fragments}</td>
                    <td className="num">{w.submissions}</td>
                    <td>
                      {w.drawn ? (
                        <span className="tag ok">đã bốc</span>
                      ) : w.started ? (
                        <span className="tag wait">chưa bốc</span>
                      ) : (
                        <span className="tag wait">chưa tới</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Phân bố & con người ────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Ai đang ở đâu</span>
          </p>
          <h2 className="section-title">Phân bố mức hoàn thành</h2>

          <div className="bar-list" style={{ maxWidth: 520 }}>
            {buckets.map((b) => (
              <Bar
                key={b.label}
                label={b.label}
                percent={pct(b.count, players.length)}
                value={`${b.count} người`}
                tone={b.min >= 70 ? 'herb' : b.min === 0 ? 'clay' : undefined}
              />
            ))}
          </div>

          <div className="two-col">
            <div>
              <h3 className="card-title">Đang dẫn đầu</h3>
              <ul className="ladder-list">
                {leaders.map((p) => (
                  <li key={p.id} className="done">
                    <Link href={`/admin/nguoi-choi/${p.id}`} className="player-link">
                      {p.display_name}
                    </Link>
                    <span className="ladder-check">
                      {p.points}đ · {doneByPlayer.get(p.id) ?? 0}/{openedDays || TOTAL_DAYS} ngày
                    </span>
                  </li>
                ))}
                {!leaders.length ? <li>Chưa có ai.</li> : null}
              </ul>
            </div>

            <div>
              <h3 className="card-title">Cần nhắc một câu</h3>
              <ul className="ladder-list">
                {quiet.map((q) => (
                  <li key={q.player.id}>
                    <Link href={`/admin/nguoi-choi/${q.player.id}`} className="player-link">
                      {q.player.display_name}
                    </Link>
                    <span className="ladder-check" style={{ color: 'var(--clay)' }}>
                      im {q.quiet} ngày · {q.done}/{openedDays} ngày
                    </span>
                  </li>
                ))}
                {!quiet.length ? <li>Không ai bỏ lỡ quá 1 ngày. Cả lớp đang đều.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Câu hay sai ────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Chỗ cả lớp còn hổng</span>
          </p>
          <h2 className="section-title">Câu bị trả lời sai nhiều nhất</h2>
          <p className="lede">
            Chỉ tính câu đã có từ {MIN_ANSWERS} lượt trả lời trở lên — ít hơn thì con số chưa nói được gì.
          </p>

          <div className="table-scroll">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Câu hỏi</th>
                  <th>Sai</th>
                  <th>Tỉ lệ sai</th>
                </tr>
              </thead>
              <tbody>
                {hardest.map((h) => (
                  <tr key={h.q.id}>
                    <td className="num">{h.q.day}</td>
                    <td>{h.q.prompt}</td>
                    <td className="num">
                      {h.wrong}/{h.total}
                    </td>
                    <td>
                      <span className="inline-bar">
                        <span className="bar-track">
                          <span className="bar-fill clay" style={{ width: `${h.rate}%` }} />
                        </span>
                        <span className="mono">{h.rate}%</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {!hardest.length ? (
                  <tr>
                    <td colSpan={4}>Chưa đủ dữ liệu — hoặc cả lớp đang trả lời đúng hết.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Vinh danh ──────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Bảng vinh danh mềm</span>
          </p>
          <h2 className="section-title">Bốc ngẫu nhiên 10% mỗi tuần</h2>
          <p className="lede">
            Bốc lại một tuần sẽ thay thế danh sách cũ của tuần đó. Chỉ những người có check-in thật
            trong tuần mới nằm trong hộp bốc.
          </p>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Tuần</th>
                  <th>Chủ đề</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {weekRows.map((w) => (
                  <tr key={w.week}>
                    <td className="num">{w.week}</td>
                    <td>{w.theme}</td>
                    <td>
                      {w.drawn ? (
                        <span className="tag ok">đã bốc</span>
                      ) : w.started ? (
                        <span className="tag wait">chưa bốc</span>
                      ) : (
                        <span className="tag wait">chưa tới</span>
                      )}
                    </td>
                    <td>
                      {w.started ? (
                        <ActionForm action={drawHonorRollAction} submitLabel="Bốc" busyLabel="Đang bốc…" ghost>
                          <input type="hidden" name="week" value={w.week} />
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap-wide">
          <form action={adminLogout}>
            <button type="submit" className="btn-ghost btn-small">
              Thoát khỏi trang điều hành
            </button>
          </form>
        </div>
      </footer>
    </>
  );
}
