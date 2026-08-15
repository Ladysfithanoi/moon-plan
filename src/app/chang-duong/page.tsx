import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Countdown from '@/components/Countdown';
import MoonRing from '@/components/MoonRing';
import DayCard from '@/components/DayCard';
import PastDays, { type PastDay } from '@/components/PastDays';
import WebinarBanner from '@/components/WebinarBanner';
import { getPlayerSession } from '@/lib/session';
import {
  FESTIVAL_AT,
  KICKOFF_AT,
  TOTAL_DAYS,
  currentDayNumber,
  eventStatus,
  fullDate,
} from '@/lib/event';
import { getSettings } from '@/lib/settings';
import {
  getAllDays,
  getAnswers,
  getCheckins,
  getDay,
  getFragments,
  getPlayer,
  getPublicQuestions,
  getReveal,
  getRewards,
  getSubmission,
} from '@/lib/game';
import { DAY_TYPE_LABEL, type DayType } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Chặng đường', here: true },
  { href: '/chung-ket', label: 'Chung kết' },
  { href: '/vinh-danh', label: 'Vinh danh' },
  { href: '/roi-di', label: 'Thoát' },
];

export default async function ChangDuongPage() {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const player = await getPlayer(session.pid);
  if (!player) redirect('/roi-di');

  const status = eventStatus();
  const [checkins, fragments, rewards, settings] = await Promise.all([
    getCheckins(session.pid),
    getFragments(session.pid),
    getRewards(session.pid),
    getSettings(),
  ]);
  const moonFragments = settings.moonFragments.slice(0, 6);

  const realCheckins = checkins.filter((c) => !c.by_freeze);
  const completed = realCheckins.length;
  const fragmentWeeks = new Set(fragments.map((f) => f.week));
  const unseen = rewards.filter((r) => !r.seen);

  // ─── Trước ngày khởi động ────────────────────────────────────────────────
  if (status === 'truoc') {
    return (
      <>
        <TopBar nav={NAV} />
        <WebinarBanner />
        <section className="fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Chào {player.display_name}</span>
            </p>
            <h1 className="display">Vòng trăng chưa mở</h1>
            <p className="body">
              Mã của bạn đã sẵn sàng. Ngày 10/08 mình mở ngày đầu tiên, và từ đó mỗi sáng bạn quay lại
              đây một lần.
            </p>
            <Countdown target={KICKOFF_AT} note="tới ngày khởi động · 10/08/2026" />
            <p className="coach-note">
              Mã của bạn: <span className="mono">{player.code}</span> — lưu lại giúp mình nhé.
            </p>
          </div>
        </section>
        <footer>
          <div className="wrap">Precision Coach · Mùa trăng 2026</div>
        </footer>
      </>
    );
  }

  const todayDay = currentDayNumber() ?? TOTAL_DAYS;
  const dayRow = await getDay(todayDay);

  const [questions, savedAnswers, submission, allDays] = await Promise.all([
    getPublicQuestions(todayDay),
    getAnswers(session.pid, todayDay),
    getSubmission(session.pid, todayDay),
    getAllDays(),
  ]);

  // Chỉ những ngày đã mở, mới nhất lên trước. Cắt gọn còn đúng phần hiện ra —
  // bài đọc và link webinar của ngày chưa tới không được xuống trình duyệt.
  const pastDays: PastDay[] = allDays
    .filter((d) => d.day <= todayDay)
    .sort((a, b) => b.day - a.day)
    .map((d) => {
      const c = checkins.find((x) => x.day === d.day);
      return {
        day: d.day,
        date: d.date,
        dateLabel: fullDate(d.date),
        title: d.title,
        dayType: d.day_type,
        typeLabel: DAY_TYPE_LABEL[d.day_type as DayType] ?? d.day_type,
        week: d.week,
        status: !c ? 'missed' : c.by_freeze ? 'freeze' : 'done',
        points: c?.points_awarded ?? 0,
      };
    });

  const todayCheckin = checkins.find((c) => c.day === todayDay && !c.by_freeze);
  const done = Boolean(todayCheckin);
  const reveal = done ? await getReveal(todayDay) : null;

  const pctDone = Math.round((completed / TOTAL_DAYS) * 100);

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      {/* ─── Vòng trăng ────────────────────────────────────────────────── */}
      <section className="moonpath fade-in">
        <div className="wrap moonpath-grid">
          <MoonRing
            day={todayDay}
            totalDays={TOTAL_DAYS}
            completed={completed}
            phase={dayRow?.phase ?? '—'}
          />
          <div className="stats-col">
            <div className="stat-row">
              <div>
                <span className="stat-num mono">{player.streak}</span>
                <span className="stat-label">ngày liên tiếp</span>
              </div>
              <div>
                <span className="stat-num mono">{player.points}</span>
                <span className="stat-label">điểm</span>
              </div>
              <div>
                <span className="stat-num mono">{player.freezes_left}</span>
                <span className="stat-label">vé cứu còn lại</span>
              </div>
            </div>
            <div>
              <div className="fragments">
                {moonFragments.map((name, i) => (
                  <div
                    key={i}
                    className={`frag${fragmentWeeks.has(i + 1) ? ' done' : ''}`}
                    title={name}
                  >
                    {fragmentWeeks.has(i + 1) ? '✓' : i + 1}
                  </div>
                ))}
              </div>
              <p className="frag-caption">
                mảnh trăng đã thu thập — {fragments.length}/6 · đã đi {pctDone}% quãng đường
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Quà chưa xem ──────────────────────────────────────────────── */}
      {unseen.length ? (
        <section className="tight fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Có thứ dành cho bạn</span>
            </p>
            {unseen.map((r) => (
              <div className="gift-card" key={r.id}>
                <h4>{r.title}</h4>
                {r.detail ? <p>{r.detail}</p> : null}
                {r.points ? <p className="gift-points mono">+{r.points}đ</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ─── Ngày hôm nay ──────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap">
          {dayRow ? (
            <DayCard
              day={dayRow.day}
              dayType={dayRow.day_type as DayType}
              title={dayRow.title}
              body={dayRow.body}
              prompt={dayRow.prompt}
              week={dayRow.week}
              weekTheme={dayRow.week_theme}
              questions={questions}
              done={done}
              savedAnswers={savedAnswers}
              reveal={reveal}
              submission={
                submission
                  ? {
                      body: submission.body,
                      files: submission.files,
                      status: submission.status,
                      note: submission.player_note,
                    }
                  : null
              }
              webinarAt={dayRow.webinar_at}
              webinarLink={dayRow.webinar_link}
              bonusThreshold={settings.scoring.quiz_tuan.threshold}
              bonusPoints={settings.scoring.quiz_tuan.bonus}
            />
          ) : (
            <p className="notice info">Nội dung ngày hôm nay chưa được đăng. Bạn quay lại sau nhé.</p>
          )}
        </div>
      </section>

      {/* ─── Đếm ngược tới đêm hội ─────────────────────────────────────── */}
      <section className="tight fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Đêm hội trăng rằm</span>
          </p>
          <Countdown target={FESTIVAL_AT} note="tới đêm 25/09/2026" />
        </div>
      </section>

      {/* ─── Sáu chặng ─────────────────────────────────────────────────── */}
      <section className="ladder fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Chặng đường</span>
          </p>
          <ol className="ladder-list">
            {moonFragments.map((name, i) => {
              const wk = i + 1;
              const has = fragmentWeeks.has(wk);
              const active = !has && dayRow?.week === wk;
              return (
                <li key={i} className={has ? 'done' : active ? 'active' : ''}>
                  <span>
                    Tuần {wk} — {name}
                  </span>
                  {has ? (
                    <span className="ladder-check">✓ đã thu</span>
                  ) : active ? (
                    <span className="ladder-current">đang chạy</span>
                  ) : null}
                </li>
              );
            })}
            <li className={fragments.length === 6 ? 'done' : ''}>
              <span>Chung kết — Precision Coach trọn vẹn</span>
              {fragments.length === 6 ? (
                <span className="ladder-check">✓ mở khoá</span>
              ) : (
                <span className="ladder-current">khoá</span>
              )}
            </li>
          </ol>
        </div>
      </section>

      {/* ─── Những ngày đã qua ─────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Những ngày đã đi qua</span>
          </p>
          <PastDays days={pastDays} />
        </div>
      </section>

      <footer>
        <div className="wrap">
          {player.display_name} · <span className="mono">{player.code}</span> —{' '}
          <Link href="/roi-di">thoát</Link>
        </div>
      </footer>
    </>
  );
}
