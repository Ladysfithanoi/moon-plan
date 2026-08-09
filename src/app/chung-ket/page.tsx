import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import RichText from '@/components/RichText';
import { getPlayerSession } from '@/lib/session';
import { fullDate, maxUnlockedDay } from '@/lib/event';
import { getAllDays, getFragments, getSubmissions } from '@/lib/game';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Chặng đường' },
  { href: '/chung-ket', label: 'Chung kết', here: true },
  { href: '/vinh-danh', label: 'Vinh danh' },
  { href: '/roi-di', label: 'Thoát' },
];

const CASE_STUDY_DAYS = [43, 44, 45, 46];

export default async function ChungKetPage() {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const [days, submissions, fragments, { rewardTiers }] = await Promise.all([
    getAllDays(),
    getSubmissions(session.pid),
    getFragments(session.pid),
    getSettings(),
  ]);

  const unlocked = maxUnlockedDay();
  const parts = days.filter((d) => CASE_STUDY_DAYS.includes(d.day));
  const submitted = new Map(submissions.map((s) => [s.day, s]));
  const doneCount = CASE_STUDY_DAYS.filter((d) => submitted.has(d)).length;
  const briefDay = parts.find((p) => p.day === 43);

  return (
    <>
      <TopBar nav={NAV} />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Tuần chung kết · 21–25/09</span>
          </p>
          <h1 className="display">Case study tổng hợp</h1>
          <p className="body">
            Bốn phần, một khách hàng, sáu trụ cột. Mỗi phần nộp được một lần và sửa lại thoải mái tới
            hết ngày 25/09. Mình đọc từng bài — phần thưởng cụ thể liệt kê ở cuối trang này.
          </p>

          <div className="stat-row" style={{ marginTop: 26 }}>
            <div>
              <span className="stat-num mono">
                {doneCount}/{CASE_STUDY_DAYS.length}
              </span>
              <span className="stat-label">phần đã nộp</span>
            </div>
            <div>
              <span className="stat-num mono">{fragments.length}/6</span>
              <span className="stat-label">mảnh trăng</span>
            </div>
          </div>

          {fragments.length < 6 ? (
            <p className="notice info" style={{ marginTop: 18 }}>
              Bạn còn thiếu mảnh trăng của tuần{' '}
              {[1, 2, 3, 4, 5, 6]
                .filter((w) => !fragments.some((f) => f.week === w))
                .join(', ')}
              . Vẫn nộp case study bình thường được — mảnh trăng và case study xét riêng.
            </p>
          ) : null}
        </div>
      </section>

      {unlocked >= 43 && briefDay ? (
        <section className="fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Đề bài</span>
            </p>
            <h2 className="section-title">{briefDay.title}</h2>
            <RichText text={briefDay.body} />
          </div>
        </section>
      ) : null}

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Bốn phần</span>
          </p>
          <ol className="ladder-list">
            {parts.map((p, i) => {
              const open = p.day <= unlocked;
              const sub = submitted.get(p.day);
              return (
                <li key={p.day} className={sub ? 'done' : open ? 'active' : ''}>
                  <span>
                    {open ? (
                      <Link href={`/ngay/${p.day}`} style={{ color: 'inherit' }}>
                        Phần {i + 1} — {p.title}
                      </Link>
                    ) : (
                      <>
                        Phần {i + 1} — mở ngày {fullDate(p.date)}
                      </>
                    )}
                  </span>
                  {sub ? (
                    <span className="ladder-check">
                      ✓ {sub.status === 'approved' ? 'đã duyệt' : 'đã nộp'}
                    </span>
                  ) : open ? (
                    <span className="ladder-current">chưa nộp</span>
                  ) : (
                    <span className="ladder-current">khoá</span>
                  )}
                </li>
              );
            })}
          </ol>

          {unlocked < 43 ? (
            <p className="coach-note" style={{ marginTop: 22 }}>
              Đề bài chung kết được công bố ở buổi trạm dừng gốc đa cuối cùng, tối 20/09.
            </p>
          ) : null}
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Phần thưởng</span>
          </p>
          <h2 className="section-title">Đêm hội trăng rằm, 25/09</h2>
          <ul className="rewards">
            {rewardTiers.map((tier, i) => (
              <li key={i}>
                <span className="rw-check mono">✓</span>
                <span>
                  {tier.title}
                  {tier.detail ? `: ${tier.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
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
