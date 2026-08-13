import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopBar from '@/components/TopBar';
import WebinarBanner from '@/components/WebinarBanner';
import { getPlayerSession } from '@/lib/session';
import { currentDayNumber } from '@/lib/event';
import { getSettings } from '@/lib/settings';
import { getHonorRoll } from '@/lib/game';
import GiveCarrot from './GiveCarrot';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/chang-duong', label: 'Chặng đường' },
  { href: '/chung-ket', label: 'Chung kết' },
  { href: '/vinh-danh', label: 'Vinh danh', here: true },
  { href: '/roi-di', label: 'Thoát' },
];

export default async function VinhDanhPage() {
  const session = await getPlayerSession();
  if (!session) redirect('/vao');

  const today = currentDayNumber() ?? 47;
  const weeksSoFar = Math.min(7, Math.ceil(today / 7));

  const { weekThemes } = await getSettings();

  const rolls = await Promise.all(
    Array.from({ length: weeksSoFar }, (_, i) => i + 1).map(async (week) => ({
      week,
      names: await getHonorRoll(week),
    })),
  );

  const withNames = rolls.filter((r) => r.names.length).reverse();

  return (
    <>
      <TopBar nav={NAV} />
      <WebinarBanner />

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Bảng vinh danh mềm</span>
          </p>
          <h1 className="display">Mỗi tuần, vài người may mắn</h1>
          <p className="body">
            Ở đây không có bảng xếp hạng. Mình không so điểm của bạn với ai cả — mỗi tuần mình bốc
            ngẫu nhiên một phần mười những người đã có mặt đều đặn, chỉ để nói một câu cảm ơn.
            Không được gọi tên không có nghĩa là bạn đi chậm hơn ai.
          </p>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          {withNames.length ? (
            withNames.map(({ week, names }) => (
              <div key={week} style={{ marginBottom: 34 }}>
                <p className="eyebrow">
                  <span className="rule" />
                  <span>Tuần {week}</span>
                </p>
                <h2 className="card-title">{weekThemes[week - 1] ?? `Tuần ${week}`}</h2>
                <ul className="rewards">
                  {names.map((n, i) => (
                    <li key={i}>
                      <span className="rw-check mono">✓</span>
                      <span>
                        {n.name}
                        {n.note ? ` — ${n.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="notice info">
              Tuần đầu tiên còn đang chạy. Cuối mỗi tuần mình sẽ bốc và cập nhật ở đây.
            </p>
          )}
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Tặng cà rốt</span>
          </p>
          <h2 className="section-title">Gửi điểm cho một người bạn</h2>
          <p className="body">
            Nếu bạn rủ được ai đó cùng chạy, hoặc đơn giản là muốn tiếp sức cho một người đang đuối —
            nhập mã của họ vào đây. Mỗi người bạn chỉ tặng được một lần.
          </p>
          <GiveCarrot />
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
