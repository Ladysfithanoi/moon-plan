import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import RichText from '@/components/RichText';
import { isAdmin } from '@/lib/session';
import { db, fetchAllRows } from '@/lib/supabase';
import { TOTAL_DAYS, TZ, currentDayNumber, shortDate } from '@/lib/event';
import { getSettings, maxPoints } from '@/lib/settings';
import { DAY_TYPE_LABEL, type DayType } from '@/lib/scoring';
import type { PlayerRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type DayLite = { day: number; date: string; week: number; day_type: DayType; title: string };
type Checkin = {
  day: number;
  correct_count: number;
  total_count: number;
  points_awarded: number;
  by_freeze: boolean;
  created_at: string;
};
type Answer = { day: number; question_id: string; chosen_index: number; is_correct: boolean };
type Question = { id: string; day: number; ord: number; prompt: string; options: string[]; correct_index: number };
type Sub = {
  day: number;
  kind: 'thu_thach' | 'case_study';
  status: 'pending' | 'approved' | 'needs_work';
  body: string;
  admin_note: string | null;
  player_note: string | null;
  is_best: boolean;
  created_at: string;
  files: { name: string }[];
};
type Reward = {
  kind: string;
  week: number | null;
  day: number | null;
  title: string;
  detail: string | null;
  points: number;
  created_at: string;
};
type Carrot = {
  from_player_id: string;
  to_player_id: string;
  points: number;
  message: string | null;
  created_at: string;
};

const SUB_STATUS: Record<Sub['status'], string> = {
  pending: 'chờ đọc',
  approved: 'đã duyệt',
  needs_work: 'cần sửa',
};

const REWARD_LABEL: Record<string, string> = {
  hop_qua: 'Hộp quà bí ẩn',
  tho_ngoc: 'Ngày Thỏ Ngọc',
  bonus_quiz: 'Thưởng quiz',
  ca_rot: 'Cà rốt bạn tặng',
};

const STAMP = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Mốc thời gian trong CSDL là UTC — phải đổi về giờ VN mới đúng "lúc mấy giờ". */
function stamp(iso: string): string {
  return STAMP.format(new Date(iso));
}

const DATE_ONLY = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default async function ChiTietNguoiChoi({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect('/admin/vao');

  const { id } = await params;
  const supabase = db();

  const { data: found } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
  if (!found) notFound();
  const player = found as PlayerRow;

  const settings = await getSettings();
  const today = currentDayNumber() ?? 0;

  const [days, checkins, answers, questions, fragments, subs, rewards, given, received] =
    await Promise.all([
      fetchAllRows<DayLite>((f, t) =>
        supabase.from('days').select('day,date,week,day_type,title').order('day').range(f, t),
      ),
      fetchAllRows<Checkin>((f, t) =>
        supabase
          .from('checkins')
          .select('day,correct_count,total_count,points_awarded,by_freeze,created_at')
          .eq('player_id', id)
          .range(f, t),
      ),
      fetchAllRows<Answer>((f, t) =>
        supabase
          .from('answers')
          .select('day,question_id,chosen_index,is_correct')
          .eq('player_id', id)
          .range(f, t),
      ),
      fetchAllRows<Question>((f, t) =>
        supabase.from('questions').select('id,day,ord,prompt,options,correct_index').range(f, t),
      ),
      fetchAllRows<{ week: number; name: string; awarded_at: string }>((f, t) =>
        supabase.from('fragments').select('week,name,awarded_at').eq('player_id', id).range(f, t),
      ),
      fetchAllRows<Sub>((f, t) =>
        supabase
          .from('submissions')
          .select('day,kind,status,body,admin_note,player_note,is_best,created_at,files')
          .eq('player_id', id)
          .order('day')
          .range(f, t),
      ),
      fetchAllRows<Reward>((f, t) =>
        supabase
          .from('rewards')
          .select('kind,week,day,title,detail,points,created_at')
          .eq('player_id', id)
          .order('created_at', { ascending: false })
          .range(f, t),
      ),
      fetchAllRows<Carrot>((f, t) =>
        supabase
          .from('carrot_gifts')
          .select('from_player_id,to_player_id,points,message,created_at')
          .eq('from_player_id', id)
          .range(f, t),
      ),
      fetchAllRows<Carrot>((f, t) =>
        supabase
          .from('carrot_gifts')
          .select('from_player_id,to_player_id,points,message,created_at')
          .eq('to_player_id', id)
          .range(f, t),
      ),
    ]);

  // Tên của những người có dính đến cà rốt — chỉ lấy đúng mấy người đó.
  const otherIds = [
    ...new Set([...given.map((g) => g.to_player_id), ...received.map((g) => g.from_player_id)]),
  ];
  const nameOf = new Map<string, string>();
  if (otherIds.length) {
    const { data: others } = await supabase
      .from('players')
      .select('id,display_name')
      .in('id', otherIds);
    for (const o of others ?? []) nameOf.set(o.id, o.display_name);
  }

  const checkinBy = new Map(checkins.map((c) => [c.day, c]));
  const questionBy = new Map(questions.map((q) => [q.id, q]));

  const realCheckins = checkins.filter((c) => !c.by_freeze);
  const openedDays = Math.min(today || 0, TOTAL_DAYS);
  const completion = openedDays ? Math.round((realCheckins.length / openedDays) * 100) : 0;

  const totalQ = checkins.reduce((s, c) => s + c.total_count, 0);
  const correctQ = checkins.reduce((s, c) => s + c.correct_count, 0);
  const accuracy = totalQ ? Math.round((correctQ / totalQ) * 100) : 0;

  const missed = days.filter((d) => d.day <= openedDays && !checkinBy.has(d.day));
  const lastActive = realCheckins.length
    ? realCheckins.reduce((a, b) => (a.day > b.day ? a : b))
    : null;
  const daysQuiet = lastActive ? openedDays - lastActive.day : openedDays;

  const fragmentBy = new Map(fragments.map((f) => [f.week, f]));
  const wrong = answers
    .filter((a) => !a.is_correct)
    .map((a) => ({ answer: a, question: questionBy.get(a.question_id) }))
    .filter((x): x is { answer: Answer; question: Question } => Boolean(x.question))
    .sort((a, b) => a.question.day - b.question.day || a.question.ord - b.question.ord);

  const timeline = days.filter((d) => d.day <= openedDays);
  const rewardPoints = rewards.reduce((s, r) => s + r.points, 0);

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>
              <Link href="/admin/nguoi-choi">← Danh sách người chơi</Link>
            </span>
          </p>
          <h1 className="display">{player.display_name}</h1>
          <p className="lede">
            Mã <span className="mono">{player.code}</span>
            {' · '}
            {player.contact ? player.contact : 'chưa có liên hệ'}
            {' · '}vào từ {DATE_ONLY.format(new Date(player.joined_at))}
            {!player.is_active ? (
              <>
                {' · '}
                <span className="tag bad">đã khoá</span>
              </>
            ) : null}
          </p>

          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-num">{player.points}</span>
              <span className="kpi-label">điểm / {maxPoints(settings.scoring)} tối đa</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{completion}%</span>
              <span className="kpi-label">
                hoàn thành — {realCheckins.length}/{openedDays || TOTAL_DAYS} ngày đã mở
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{player.streak}</span>
              <span className="kpi-label">chuỗi hiện tại (dài nhất {player.best_streak})</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{totalQ ? `${accuracy}%` : '—'}</span>
              <span className="kpi-label">
                câu đúng {totalQ ? `(${correctQ}/${totalQ} câu)` : 'chưa làm quiz nào'}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{fragments.length}/6</span>
              <span className="kpi-label">mảnh trăng</span>
            </div>
            <div className="kpi">
              <span className="kpi-num">{player.freezes_left}</span>
              <span className="kpi-label">vé cứu còn (đã dùng {player.freezes_used})</span>
            </div>
          </div>

          <p className="coach-note" style={{ marginTop: 22 }}>
            {!openedDays
              ? 'Sự kiện chưa mở ngày nào — chưa có gì để soi.'
              : lastActive
                ? daysQuiet <= 0
                  ? 'Đã làm ngày hôm nay.'
                  : `Lần cuối check-in là ngày ${lastActive.day} — im ắng ${daysQuiet} ngày rồi.`
                : 'Chưa check-in ngày nào kể từ lúc mở màn.'}
            {missed.length ? ` Bỏ lỡ ${missed.length} ngày: ${missed.map((d) => d.day).join(', ')}.` : ''}
          </p>
        </div>
      </section>

      {/* ─── Mảnh trăng ─────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Mảnh trăng</span>
          </p>
          <h2 className="section-title">Thu được {fragments.length}/6 mảnh</h2>
          <ul className="frag-list">
            {settings.moonFragments.map((name, i) => {
              const week = i + 1;
              const got = fragmentBy.get(week);
              return (
                <li key={week} className={got ? 'got' : ''}>
                  <span className="frag-week mono">T{week}</span>
                  <span className="frag-name">{got?.name ?? name}</span>
                  <span className="frag-when">
                    {got ? stamp(got.awarded_at) : <span className="tag wait">chưa có</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─── Hành trình từng ngày ───────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Hành trình từng ngày</span>
          </p>
          <h2 className="section-title">
            {timeline.length} ngày đã mở · còn {TOTAL_DAYS - openedDays} ngày phía trước
          </h2>

          <div className="table-scroll">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Lịch</th>
                  <th>Nội dung</th>
                  <th>Loại</th>
                  <th>Kết quả</th>
                  <th>Quiz</th>
                  <th>Điểm</th>
                  <th>Lúc</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((d) => {
                  const c = checkinBy.get(d.day);
                  return (
                    <tr key={d.day} className={!c ? 'row-missed' : ''}>
                      <td className="num">{d.day}</td>
                      <td className="num">{shortDate(d.date)}</td>
                      <td>{d.title}</td>
                      <td>{DAY_TYPE_LABEL[d.day_type]}</td>
                      <td>
                        {!c ? (
                          <span className="tag bad">bỏ lỡ</span>
                        ) : c.by_freeze ? (
                          <span className="tag wait">vé cứu bù</span>
                        ) : (
                          <span className="tag ok">xong</span>
                        )}
                      </td>
                      <td className="num">
                        {c && c.total_count ? `${c.correct_count}/${c.total_count}` : '—'}
                      </td>
                      <td className="num">{c && c.points_awarded ? `+${c.points_awarded}` : '—'}</td>
                      <td className="num">{c && !c.by_freeze ? stamp(c.created_at) : '—'}</td>
                    </tr>
                  );
                })}
                {!timeline.length ? (
                  <tr>
                    <td colSpan={8}>Sự kiện chưa mở ngày nào.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Bài nộp ────────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Bài đã nộp</span>
          </p>
          <h2 className="section-title">{subs.length} bài</h2>

          {subs.map((s) => (
            <article key={s.day} className="journey-item">
              <p className="coach-note" style={{ marginBottom: 8 }}>
                Ngày {s.day} ·{' '}
                {s.kind === 'case_study' ? 'Case study chung kết' : 'Thử thách áp dụng'} ·{' '}
                <span
                  className={`tag ${
                    s.status === 'approved' ? 'ok' : s.status === 'needs_work' ? 'bad' : 'wait'
                  }`}
                >
                  {SUB_STATUS[s.status]}
                </span>
                {s.is_best ? (
                  <>
                    {' · '}
                    <span className="tag ok">xuất sắc nhất</span>
                  </>
                ) : null}
                {' · '}
                <span className="mono">{stamp(s.created_at)}</span>
              </p>
              {s.body ? <RichText text={s.body} /> : <p className="notice info">Không có phần chữ.</p>}
              {s.files?.length ? (
                <p className="coach-note">Đính kèm: {s.files.map((f) => f.name).join(', ')}</p>
              ) : null}
              {s.player_note ? (
                <p className="notice ok">Đã gửi học viên: {s.player_note}</p>
              ) : null}
              {s.admin_note ? <p className="notice info">Ghi chú riêng: {s.admin_note}</p> : null}
            </article>
          ))}
          {!subs.length ? <p className="notice info">Chưa nộp bài nào.</p> : null}
        </div>
      </section>

      {/* ─── Quiz sai ───────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Chỗ còn hổng</span>
          </p>
          <h2 className="section-title">{wrong.length} câu trả lời sai</h2>
          <p className="lede">Nhìn danh sách này là biết nên nhắc lại gì khi nói chuyện riêng.</p>

          {wrong.map(({ answer, question }) => (
            <div key={question.id} className="miss-item">
              <p className="miss-q">
                <span className="mono">Ngày {question.day}</span> · {question.prompt}
              </p>
              <p className="miss-line">
                Chọn: <span className="wrong-text">{question.options[answer.chosen_index] ?? '—'}</span>
              </p>
              <p className="miss-line">
                Đúng: <span className="right-text">{question.options[question.correct_index] ?? '—'}</span>
              </p>
            </div>
          ))}
          {!wrong.length ? (
            <p className="notice ok">Chưa sai câu nào — hoặc chưa làm quiz nào.</p>
          ) : null}
        </div>
      </section>

      {/* ─── Quà & cà rốt ───────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Quà đã nhận</span>
          </p>
          <h2 className="section-title">
            {rewards.length} phần quà{rewardPoints ? ` · +${rewardPoints}đ` : ''}
          </h2>

          <ul className="ladder-list">
            {rewards.map((r, i) => (
              <li key={i} className="done">
                <span>
                  <strong>{REWARD_LABEL[r.kind] ?? r.kind}</strong> — {r.title}
                  {r.detail ? <span className="soft-text"> · {r.detail}</span> : null}
                </span>
                <span className="ladder-check">
                  {r.points ? `+${r.points}đ · ` : ''}
                  {stamp(r.created_at)}
                </span>
              </li>
            ))}
            {!rewards.length ? <li>Chưa nhận phần quà nào.</li> : null}
          </ul>

          <h3 className="card-title" style={{ marginTop: 30 }}>
            Cà rốt
          </h3>
          <p className="coach-note">
            Tặng đi {given.length} lần · nhận về {received.length} lần
            {received.length ? ` (+${received.reduce((s, g) => s + g.points, 0)}đ)` : ''}
          </p>
          <ul className="ladder-list">
            {received.map((g, i) => (
              <li key={`r${i}`} className="done">
                <span>
                  Nhận từ <strong>{nameOf.get(g.from_player_id) ?? 'ai đó'}</strong>
                  {g.message ? ` — “${g.message}”` : ''}
                </span>
                <span className="ladder-check">{stamp(g.created_at)}</span>
              </li>
            ))}
            {given.map((g, i) => (
              <li key={`g${i}`}>
                <span>
                  Tặng <strong>{nameOf.get(g.to_player_id) ?? 'ai đó'}</strong>
                  {g.message ? ` — “${g.message}”` : ''}
                </span>
                <span className="ladder-check">{stamp(g.created_at)}</span>
              </li>
            ))}
            {!given.length && !received.length ? <li>Chưa có cà rốt nào qua lại.</li> : null}
          </ul>
        </div>
      </section>
    </>
  );
}
