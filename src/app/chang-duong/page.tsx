import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Countdown from '@/components/Countdown';
import FlowerStem from '@/components/FlowerStem';
import Bouquet from '@/components/Bouquet';
import Garden from '@/components/Garden';
import DayCard from '@/components/DayCard';
import PastDays, { type PastDay } from '@/components/PastDays';
import WebinarBanner from '@/components/WebinarBanner';
import ZaloCard from '@/components/ZaloCard';
import { hasClickedZalo, zaloQrSvg } from '@/lib/zalo';
import { getPlayerSession } from '@/lib/session';
import {
  FESTIVAL_AT,
  KICKOFF_AT,
  RIBBON_WEEKS,
  TOTAL_DAYS,
  currentDayNumber,
  dateForDay,
  eventStatus,
  fullDate,
  rawDayNumber,
  shortDate,
} from '@/lib/event';
import { getSettings } from '@/lib/settings';
import {
  getAllDays,
  getAnswers,
  getDay,
  getPlayer,
  getPublicQuestions,
  getReveal,
  getRewards,
  getRibbons,
  getSubmission,
  tendPlayer,
  unlockedExtras,
} from '@/lib/game';
import { MAKEUP_DAYS, daysToNextTier } from '@/lib/bloom';
import { COMEBACK_DAYS, DAY_TYPE_LABEL, TIERS, type DayType } from '@/lib/scoring';
import { markRewardsSeen } from './actions';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Cành hoa', here: true },
  { href: '/chung-ket', label: 'Về đích' },
  { href: '/vinh-danh', label: 'Vinh danh' },
  { href: '/roi-di', label: 'Thoát' },
];

function mult(m: number): string {
  return `×${String(m).replace('.', ',')}`;
}

/** Hạn chót học bù của một ngày: hết ngày thứ hai sau nó. */
function makeupUntil(day: number): string {
  return shortDate(dateForDay(day + MAKEUP_DAYS));
}

export default async function ChangDuongPage() {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const found = await getPlayer(session.pid);
  if (!found) redirect('/roi-di');

  const status = eventStatus();

  // Nhóm Zalo: chỉ dựng QR khi admin đã dán link và người này chưa bấm.
  const { zaloLink } = await getSettings();
  const zaloClicked = zaloLink ? await hasClickedZalo(found.id) : true;
  const zalo = zaloLink ? (
    <ZaloCard clicked={zaloClicked} qrSvg={zaloClicked ? '' : await zaloQrSvg(zaloLink)} />
  ) : null;

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
              <span>Chào {found.display_name}</span>
            </p>
            <h1 className="display">Hạt giống đã gieo</h1>
            <p className="body">
              Mã của bạn đã sẵn sàng. Ngày 01/10 cành hoa của bạn mọc đốt đầu tiên, và từ đó mỗi ngày
              bạn quay lại đây một lần — càng đều, hoa càng nở to.
            </p>
            <Countdown target={KICKOFF_AT} note="tới ngày khởi động · 01/10/2026" />
            <p className="coach-note">
              {found.phone
                ? 'Lần sau bạn đăng nhập bằng số điện thoại và mã PIN vừa đặt.'
                : <>Mã của bạn: <span className="mono">{found.code}</span> — lưu lại giúp mình nhé.</>}
            </p>
          </div>
        </section>
        {zalo ? (
          <section className="tight fade-in">
            <div className="wrap">{zalo}</div>
          </section>
        ) : null}
        <footer>
          <div className="wrap">Precision Coach · Chạy dần đến 20/10</div>
        </footer>
      </>
    );
  }

  const { player, bloom, garden, checkins } = await tendPlayer(found);
  const [ribbons, rewards, settings, allDays] = await Promise.all([
    getRibbons(player.id),
    getRewards(player.id),
    getSettings(),
    getAllDays(),
  ]);
  const multipliers = settings.scoring.multipliers;

  const finished = status === 'da-xong';
  const todayNum = rawDayNumber();
  const todayDay = currentDayNumber() ?? TOTAL_DAYS;
  const dayRow = finished ? null : await getDay(todayDay);

  const [questions, savedAnswers, submission] = dayRow
    ? await Promise.all([
        getPublicQuestions(todayDay),
        getAnswers(player.id, todayDay),
        getSubmission(player.id, todayDay),
      ])
    : [[], {}, null];

  const done = checkins.some((c) => c.day === todayDay && !c.by_freeze);
  const reveal = done && dayRow ? await getReveal(todayDay) : null;
  const extras = dayRow ? unlockedExtras(dayRow, bloom) : undefined;

  const dayBy = new Map(allDays.map((d) => [d.day, d]));
  const pointsBy = new Map(checkins.map((c) => [c.day, c.points_awarded]));
  const ribbonWeeks = new Set(ribbons.map((r) => r.week));
  const unseen = rewards.filter((r) => !r.seen);

  // Chỉ những ngày đã mở, mới nhất lên trước. Cắt gọn còn đúng phần hiện ra —
  // bài đọc và link Trạm hoa của ngày chưa tới không được xuống trình duyệt.
  const pastDays: PastDay[] = bloom.cells
    .filter((c) => c.day <= Math.min(todayNum, TOTAL_DAYS) && dayBy.has(c.day))
    .reverse()
    .map((c) => {
      const d = dayBy.get(c.day)!;
      return {
        day: d.day,
        date: d.date,
        dateLabel: fullDate(d.date),
        title: d.title,
        dayType: d.day_type,
        typeLabel: DAY_TYPE_LABEL[d.day_type as DayType] ?? d.day_type,
        week: d.week,
        status: c.state,
        open: c.open,
        points: pointsBy.get(c.day) ?? 0,
      };
    });

  const next = daysToNextTier(bloom.streak);
  const tier = TIERS[bloom.tier];
  const nextTier =
    bloom.nextTier !== null
      ? { name: TIERS[bloom.nextTier].name, multiplier: multipliers[bloom.nextTier] }
      : null;

  // ─── Trạng thái cây hôm nay ─────────────────────────────────────────────
  const lastMissed = bloom.cells
    .filter((c) => c.day < todayNum && (c.state === 'dew' || c.state === 'thirsty' || c.state === 'wilted'))
    .at(-1);
  const alert = !done
    ? bloom.dormant && bloom.dormant.progress === 0
      ? 'ngu'
      : bloom.dormant
        ? 'hoi_xuan'
        : bloom.trailingMiss === 1 && lastMissed?.state === 'dew'
          ? 'suong'
          : bloom.trailingMiss === 1
            ? 'khat'
            : bloom.trailingMiss === 2
              ? 'heo'
              : null
    : bloom.dormant
      ? 'hoi_xuan'
      : null;

  const openList = bloom.openDays
    .map((d) => dayBy.get(d))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      {/* ─── Cành hoa ───────────────────────────────────────────────────── */}
      <section className="bloom fade-in">
        <div className="wrap bloom-grid">
          {finished ? (
            <Bouquet cells={bloom.cells} ribbons={ribbons.length} />
          ) : (
            <FlowerStem cells={bloom.cells} tier={bloom.tier} sleeping={Boolean(bloom.dormant)} />
          )}

          <div className="stats-col">
            <div>
              <p className="eyebrow">
                <span className="rule" />
                <span>{finished ? 'Bó hoa của bạn' : `Ngày ${todayDay}/${TOTAL_DAYS}`}</span>
              </p>
              <p className="tier-now">
                {bloom.dormant ? 'Cây đang ngủ' : tier.name}
                <span className="tier-mult mono">{mult(multipliers[bloom.tier])}</span>
              </p>
              <p className="tier-next">
                {bloom.dormant
                  ? `Học ${COMEBACK_DAYS - bloom.dormant.progress} ngày liền nữa để hồi xuân.`
                  : next
                    ? `Còn ${next.days} ngày liền nữa lên ${TIERS[next.tier].name} (${mult(multipliers[next.tier])}).`
                    : 'Tầng cao nhất rồi — giữ nhịp này tới 20/10.'}
              </p>
            </div>

            <div className="stat-row">
              <div>
                <span className="stat-num mono">{bloom.streak}</span>
                <span className="stat-label">ngày liên tiếp</span>
              </div>
              <div>
                <span className="stat-num mono">{player.points}</span>
                <span className="stat-label">điểm</span>
              </div>
              <div>
                <span className="stat-num mono">{bloom.dewsLeft}</span>
                <span className="stat-label">giọt sương</span>
              </div>
            </div>

            <div>
              <div className="fragments">
                {settings.ribbons.slice(0, RIBBON_WEEKS).map((name, i) => (
                  <div
                    key={i}
                    className={`frag${ribbonWeeks.has(i + 1) ? ' done' : ''}`}
                    title={name}
                  >
                    {ribbonWeeks.has(i + 1) ? '✓' : i + 1}
                  </div>
                ))}
              </div>
              <p className="frag-caption">
                dải ruy băng — {ribbons.length}/{RIBBON_WEEKS} · chuỗi dài nhất {bloom.best} ngày
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tình trạng của cây ─────────────────────────────────────────── */}
      {alert ? (
        <section className="tight fade-in">
          <div className="wrap">
            {alert === 'ngu' ? (
              <div className="state-box sleep">
                <h3 className="card-title">Cây của bạn đang ngủ</h3>
                <p>
                  Bạn đã vắng vài ngày liền, hoa đã héo và chuỗi về 0. Không sao cả — quay lại học{' '}
                  <strong>{COMEBACK_DAYS} ngày liền</strong> là cây <strong>hồi xuân</strong>: lấy lại
                  một nửa chuỗi cũ ({Math.floor((bloom.dormant?.before ?? 0) / 2)} ngày) và thêm{' '}
                  {settings.scoring.comebackPoints}đ thưởng quay lại.
                </p>
                <p className="soft-text">Bắt đầu từ bài hôm nay ngay bên dưới — chỉ mất vài phút.</p>
              </div>
            ) : alert === 'hoi_xuan' && bloom.dormant ? (
              <div className="state-box">
                <h3 className="card-title">Đang hồi xuân</h3>
                <div className="comeback-dots" aria-label={`${bloom.dormant.progress}/${COMEBACK_DAYS} ngày`}>
                  {Array.from({ length: COMEBACK_DAYS }, (_, i) => (
                    <span key={i} className={i < bloom.dormant!.progress ? 'on' : ''} />
                  ))}
                </div>
                <p>
                  {bloom.dormant.progress}/{COMEBACK_DAYS} ngày liền. Thêm{' '}
                  {COMEBACK_DAYS - bloom.dormant.progress} ngày nữa là cây tỉnh dậy với một nửa chuỗi cũ.
                </p>
              </div>
            ) : alert === 'suong' && lastMissed ? (
              <div className="state-box dew">
                <h3 className="card-title">Một giọt sương đang che cho bạn</h3>
                <p>
                  Ngày {lastMissed.day} bạn chưa học, nên app đã tưới bằng một giọt sương để chuỗi không
                  tụt. Học bù ngày đó trước hết {makeupUntil(lastMissed.day)} thì giọt sương được trả lại
                  vào kho.
                </p>
              </div>
            ) : alert === 'khat' && lastMissed ? (
              <div className="state-box thirsty">
                <h3 className="card-title">Cây đang khát nước</h3>
                <p>
                  Ngày {lastMissed.day} bị bỏ lỡ và bạn đã hết giọt sương, nên hoa tụt một tầng. Học bù
                  ngày {lastMissed.day} trước hết {makeupUntil(lastMissed.day)} là lấy lại tầng cũ.
                </p>
              </div>
            ) : alert === 'heo' ? (
              <div className="state-box wilted">
                <h3 className="card-title">Hoa đang héo</h3>
                <p>
                  Hai ngày liền bỏ lỡ nên chuỗi đã về 0. Nhưng vẫn còn cứu được: học bù{' '}
                  <strong>cả hai ngày</strong> trong khung 48 giờ là hoa hồi lại và chuỗi được nối liền
                  như chưa từng đứt.
                </p>
              </div>
            ) : null}

            {openList.length ? (
              <ul className="makeup-list">
                {openList.map((d) => (
                  <li key={d.day}>
                    <Link href={`/ngay/${d.day}`}>
                      Học bù ngày {d.day} — {d.title}
                    </Link>
                    <span className="soft-text"> · đến hết {makeupUntil(d.day)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ─── Nhóm Zalo — nổi lên cho tới khi người chơi đã bấm vào ──────── */}
      {zalo && !zaloClicked ? (
        <section className="tight fade-in">
          <div className="wrap">{zalo}</div>
        </section>
      ) : null}

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
            <form action={markRewardsSeen}>
              <button type="submit" className="btn-ghost btn-small">
                Đã xem
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {/* ─── Ngày hôm nay ──────────────────────────────────────────────── */}
      {!finished ? (
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
                mode="today"
                extras={extras}
                nextTier={nextTier}
              />
            ) : (
              <p className="notice info">Nội dung ngày hôm nay chưa được đăng. Bạn quay lại sau nhé.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="fade-in">
          <div className="wrap">
            <h2 className="section-title">Mùa này đã khép lại</h2>
            <p className="body">
              {bloom.cells.filter((c) => c.state === 'done' || c.state === 'late').length} bông hoa,{' '}
              {ribbons.length} dải ruy băng, chuỗi dài nhất {bloom.best} ngày. Cảm ơn bạn đã đi cùng mình
              tới 20/10. Mọi bài đọc vẫn mở để bạn xem lại bên dưới.
            </p>
          </div>
        </section>
      )}

      {/* ─── Vườn chung ────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vườn chung của cả lớp</span>
          </p>
          <h2 className="section-title">Đủ đông thì cả vườn nắng</h2>
          <p className="body">
            Ngày nào có từ {Math.round(settings.scoring.garden.threshold * 100)}% cả lớp học đúng hạn,
            ngày đó nắng: ai góp mặt được thêm {settings.scoring.garden.points}đ, và cứ{' '}
            {settings.scoring.garden.sunnyPerDew} ngày nắng thì <strong>tất cả mọi người</strong> có thêm
            một giọt sương. Nhắn một câu cho bạn cùng lớp chưa học hôm nay là giúp cả vườn.
          </p>
          <Garden garden={garden} totalDays={TOTAL_DAYS} />
        </div>
      </section>

      {/* ─── Luật của cây ──────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Luật của cây</span>
          </p>
          <h2 className="section-title">Học đều thì hoa nở to</h2>
          <ol className="ladder-list">
            {TIERS.map((t, i) => (
              <li key={t.key} className={i === bloom.tier ? 'active' : i < bloom.tier ? 'done' : ''}>
                <span>
                  {t.name} — {t.min === 0 ? '1–2 ngày' : `từ ${t.min} ngày liền`}
                  <span className="day-type-tag">
                    điểm {mult(multipliers[i])}
                    {t.unlock ? ` · mở ${t.unlock.toLowerCase()}` : ''}
                  </span>
                </span>
                {i === bloom.tier ? <span className="ladder-current">bạn ở đây</span> : null}
                {i < bloom.tier ? <span className="ladder-check">✓</span> : null}
              </li>
            ))}
          </ol>
          <ul className="rule-list">
            <li>
              <strong>Bỏ 1 ngày</strong> — còn giọt sương thì app tự tưới, chuỗi giữ nguyên. Hết giọt
              sương thì cây khát nước, tụt một tầng.
            </li>
            <li>
              <strong>Bỏ 2 ngày liền</strong> — hoa héo, chuỗi về 0. Học bù cả hai ngày trong 48 giờ là
              hồi lại.
            </li>
            <li>
              <strong>Nghỉ từ 3 ngày</strong> — cây ngủ. Quay lại học {COMEBACK_DAYS} ngày liền là hồi
              xuân: lấy lại một nửa chuỗi cũ và thêm {settings.scoring.comebackPoints}đ.
            </li>
            <li>
              <strong>Học bù</strong> — ngày bỏ lỡ làm lại được tới hết ngày thứ hai sau đó; nhận điểm
              gốc, không nhân tầng.
            </li>
            <li>
              <strong>Trạm hoa Chủ Nhật</strong> — đến thì cây lớn thêm và nhận ruy băng; vắng thì cây giữ
              nguyên, không héo.
            </li>
          </ul>
        </div>
      </section>

      {/* ─── Chặng đường ───────────────────────────────────────────────── */}
      <section className="ladder fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Chặng đường</span>
          </p>
          <ol className="ladder-list">
            {settings.ribbons.slice(0, RIBBON_WEEKS).map((name, i) => {
              const wk = i + 1;
              const has = ribbonWeeks.has(wk);
              const active = !has && dayRow?.week === wk;
              return (
                <li key={i} className={has ? 'done' : active ? 'active' : ''}>
                  <span>
                    Tuần {wk} — {settings.weekThemes[i]}
                    <span className="day-type-tag">{name}</span>
                  </span>
                  {has ? (
                    <span className="ladder-check">✓ đã nhận</span>
                  ) : active ? (
                    <span className="ladder-current">đang học</span>
                  ) : null}
                </li>
              );
            })}
            <li className={dayRow?.week === 4 ? 'active' : ''}>
              <span>Về đích — case study và buộc bó hoa 20/10</span>
              {dayRow?.week === 4 ? <span className="ladder-current">đang học</span> : null}
            </li>
          </ol>
        </div>
      </section>

      {/* ─── Những ngày đã qua ─────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Những ngày đã qua</span>
          </p>
          <PastDays days={pastDays} />
        </div>
      </section>

      {/* ─── Đếm ngược tới 20/10 ───────────────────────────────────────── */}
      {!finished ? (
        <section className="tight fade-in">
          <div className="wrap">
            <p className="eyebrow">
              <span className="rule" />
              <span>Buổi hội 20/10</span>
            </p>
            <Countdown target={FESTIVAL_AT} note="tới tối 20/10/2026" />
          </div>
        </section>
      ) : null}

      <footer>
        <div className="wrap">
          {player.display_name} · <span className="mono">{player.code}</span> —{' '}
          <Link href="/roi-di">thoát</Link>
          {zalo && zaloClicked ? <div style={{ marginTop: 8 }}>{zalo}</div> : null}
        </div>
      </footer>
    </>
  );
}
