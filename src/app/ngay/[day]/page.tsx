import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import DayCard from '@/components/DayCard';
import WebinarBanner from '@/components/WebinarBanner';
import { getPlayerSession } from '@/lib/session';
import { TOTAL_DAYS, dateForDay, fullDate, maxUnlockedDay } from '@/lib/event';
import {
  getAnswers,
  getCheckins,
  getDay,
  getPublicQuestions,
  getReveal,
  getSubmission,
} from '@/lib/game';
import { getSettings } from '@/lib/settings';
import type { DayType } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Chặng đường' },
  { href: '/chung-ket', label: 'Chung kết' },
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
              Vòng trăng đi từng bước một. Ngày này sẽ mở vào {fullDate(dateForDay(day))}.
            </p>
            <Link href="/chang-duong" className="btn-primary">
              Về chặng đường
            </Link>
          </div>
        </section>
      </>
    );
  }

  const dayRow = await getDay(day);
  if (!dayRow) notFound();

  const isToday = day === unlocked;

  const [questions, savedAnswers, submission, checkins, settings] = await Promise.all([
    getPublicQuestions(day),
    getAnswers(session.pid, day),
    getSubmission(session.pid, day),
    getCheckins(session.pid),
    getSettings(),
  ]);

  const checkin = checkins.find((c) => c.day === day && !c.by_freeze);
  const done = Boolean(checkin);
  const reveal = done ? await getReveal(day) : null;

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      <section className="fade-in">
        <div className="wrap">
          <p className="coach-note">
            Ngày {day}/{TOTAL_DAYS} · {dayRow.weekday}, {fullDate(dayRow.date)}
            {isToday ? ' · hôm nay' : ''}
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
            readOnly={!isToday}
          />

          {!isToday ? (
            <p className="coach-note" style={{ marginTop: 22 }}>
              Đây là ngày đã qua — bạn xem lại được nhưng không ghi điểm nữa.
            </p>
          ) : null}
        </div>
      </section>

      <footer>
        <div className="wrap">
          <Link href="/chang-duong">Về chặng đường</Link>
        </div>
      </footer>
    </>
  );
}
