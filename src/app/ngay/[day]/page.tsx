import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import DayCard from '@/components/DayCard';
import WebinarBanner from '@/components/WebinarBanner';
import { getPlayerSession } from '@/lib/session';
import {
  TOTAL_DAYS,
  dateForDay,
  fullDate,
  maxUnlockedDay,
  rawDayNumber,
  shortDate,
} from '@/lib/event';
import {
  getAnswers,
  getBloom,
  getCheckins,
  getDay,
  getPlayer,
  getPublicQuestions,
  getReveal,
  getSubmission,
  unlockedExtras,
} from '@/lib/game';
import { MAKEUP_DAYS } from '@/lib/bloom';
import { getSettings } from '@/lib/settings';
import { TIERS, type DayType } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Cành hoa' },
  { href: '/chung-ket', label: 'Về đích' },
  { href: '/vinh-danh', label: 'Vinh danh' },
  { href: '/roi-di', label: 'Thoát' },
];

export default async function NgayPage({ params }: { params: Promise<{ day: string }> }) {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const day = Number((await params).day);
  if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) notFound();

  // Không cho xem trước nội dung của ngày chưa mở.
  const unlocked = maxUnlockedDay();
  if (day > unlocked) {
    return (
      <>
        <TopBar nav={NAV} />
        <WebinarBanner />
        <section className="fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Ngày {day}</span>
            </p>
            <h1 className="display">Chưa mở</h1>
            <p className="body">
              Cành hoa mọc từng đốt một. Ngày này sẽ mở vào {fullDate(dateForDay(day))}.
            </p>
            <Link href="/chang-duong" className="btn-primary">
              Về cành hoa
            </Link>
          </div>
        </section>
      </>
    );
  }

  const [player, dayRow] = await Promise.all([getPlayer(session.pid), getDay(day)]);
  if (!player) redirect('/roi-di');
  if (!dayRow) notFound();

  const today = rawDayNumber();
  const isToday = day === today;

  const [questions, savedAnswers, submission, checkins, settings, bloom] = await Promise.all([
    getPublicQuestions(day),
    getAnswers(session.pid, day),
    getSubmission(session.pid, day),
    getCheckins(session.pid),
    getSettings(),
    getBloom(player),
  ]);

  const done = checkins.some((c) => c.day === day && !c.by_freeze);
  const reveal = done ? await getReveal(day) : null;

  // Trạm hoa không điểm danh bù được — vắng thì cũng không làm héo hoa.
  const canMakeUp =
    !isToday && !done && day >= today - MAKEUP_DAYS && dayRow.day_type !== 'webinar';
  const mode = isToday ? 'today' : canMakeUp ? 'makeup' : 'readonly';
  const nextTier =
    isToday && bloom.nextTier !== null
      ? { name: TIERS[bloom.nextTier].name, multiplier: settings.scoring.multipliers[bloom.nextTier] }
      : null;

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      <section className="fade-in">
        <div className="wrap">
          <p className="coach-note">
            Ngày {day}/{TOTAL_DAYS} · {dayRow.weekday}, {fullDate(dayRow.date)}
            {isToday ? ' · hôm nay' : ''}
            {canMakeUp ? ` · học bù được đến hết ${shortDate(dateForDay(day + MAKEUP_DAYS))}` : ''}
          </p>

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
            mode={mode}
            extras={unlockedExtras(dayRow, bloom)}
            nextTier={nextTier}
          />

          {mode === 'readonly' && !done ? (
            <p className="coach-note" style={{ marginTop: 22 }}>
              Ngày này đã quá 48 giờ học bù — bạn xem lại được nhưng không ghi nhận nữa.
            </p>
          ) : null}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <Link href="/chang-duong">Về cành hoa</Link>
        </div>
      </footer>
    </>
  );
}
