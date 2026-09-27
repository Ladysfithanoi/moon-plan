import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import WebinarBanner from '@/components/WebinarBanner';
import Bouquet from '@/components/Bouquet';
import RichText from '@/components/RichText';
import { getPlayerSession } from '@/lib/session';
import { RIBBON_WEEKS, fullDate, maxUnlockedDay } from '@/lib/event';
import { getAllDays, getBloom, getPlayer, getRibbons, getSubmissions } from '@/lib/game';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Cành hoa' },
  { href: '/chung-ket', label: 'Về đích', here: true },
  { href: '/vinh-danh', label: 'Vinh danh' },
  { href: '/roi-di', label: 'Thoát' },
];

export default async function VeDichPage() {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const player = await getPlayer(session.pid);
  if (!player) redirect('/roi-di');

  const [days, submissions, ribbons, { rewardTiers }, bloom] = await Promise.all([
    getAllDays(),
    getSubmissions(session.pid),
    getRibbons(session.pid),
    getSettings(),
    getBloom(player),
  ]);

  const unlocked = maxUnlockedDay();
  const parts = days.filter((d) => d.day_type === 'case_study');
  const submitted = new Map(submissions.map((s) => [s.day, s]));
  const doneCount = parts.filter((d) => submitted.has(d.day)).length;
  const firstPart = parts[0];
  const flowers = bloom.cells.filter((c) => c.state === 'done' || c.state === 'late').length;

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Về đích · 19–20/10</span>
          </p>
          <h1 className="display">Bó hoa của bạn</h1>
          <p className="body">
            Mỗi ngày bạn học là một bông trong bó này — học lúc đang có chuỗi dài thì bông to và đỏ hơn,
            ngày bỏ lỡ nằm lại dưới dạng hoa héo. Ruy băng buộc bó là những buổi Trạm hoa bạn đã dự.
            Tối 20/10 bó hoa khép lại.
          </p>

          <Bouquet cells={bloom.cells} ribbons={ribbons.length} />

          <div className="stat-row" style={{ marginTop: 18 }}>
            <div>
              <span className="stat-num mono">{flowers}</span>
              <span className="stat-label">bông đã nở</span>
            </div>
            <div>
              <span className="stat-num mono">
                {ribbons.length}/{RIBBON_WEEKS}
              </span>
              <span className="stat-label">dải ruy băng</span>
            </div>
            <div>
              <span className="stat-num mono">
                {doneCount}/{parts.length || 1}
              </span>
              <span className="stat-label">case study</span>
            </div>
          </div>

          {ribbons.length < RIBBON_WEEKS ? (
            <p className="notice info" style={{ marginTop: 18 }}>
              Bạn còn thiếu ruy băng của tuần{' '}
              {Array.from({ length: RIBBON_WEEKS }, (_, i) => i + 1)
                .filter((w) => !ribbons.some((r) => r.week === w))
                .join(', ')}
              . Vẫn nộp case study bình thường được — ruy băng và case study xét riêng.
            </p>
          ) : null}
        </div>
      </section>

      {firstPart && unlocked >= firstPart.day ? (
        <section className="fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Đề bài</span>
            </p>
            <h2 className="section-title">{firstPart.title}</h2>
            <RichText text={firstPart.body} />
          </div>
        </section>
      ) : null}

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Case study</span>
          </p>
          <ol className="ladder-list">
            {parts.map((p) => {
              const open = p.day <= unlocked;
              const sub = submitted.get(p.day);
              return (
                <li key={p.day} className={sub ? 'done' : open ? 'active' : ''}>
                  <span>
                    {open ? (
                      <Link href={`/ngay/${p.day}`} style={{ color: 'inherit' }}>
                        {p.title}
                      </Link>
                    ) : (
                      <>
                        {p.title} — mở ngày {fullDate(p.date)}
                      </>
                    )}
                  </span>
                  {sub ? (
                    sub.status === 'needs_work' ? (
                      <span className="ladder-current">cần sửa · có nhận xét</span>
                    ) : (
                      <span className="ladder-check">
                        ✓ {sub.status === 'approved' ? 'đã duyệt' : 'đã nộp'}
                        {sub.player_note ? ' · có nhận xét' : ''}
                      </span>
                    )
                  ) : open ? (
                    <span className="ladder-current">chưa nộp</span>
                  ) : (
                    <span className="ladder-current">khoá</span>
                  )}
                </li>
              );
            })}
          </ol>

          {firstPart && unlocked < firstPart.day ? (
            <p className="coach-note" style={{ marginTop: 22 }}>
              Đề case study được công bố ở buổi Trạm hoa cuối cùng, tối Chủ Nhật 18/10.
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
          <h2 className="section-title">Buổi hội 20/10</h2>
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
          <Link href="/chang-duong">Về cành hoa</Link>
        </div>
      </footer>
    </>
  );
}
