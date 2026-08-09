import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Countdown from '@/components/Countdown';
import { FESTIVAL_AT, KICKOFF_AT, eventStatus } from '@/lib/event';
import { getSettings } from '@/lib/settings';

// Trang này đổi mặt theo ngày (đếm ngược tới khởi động hay tới đêm hội), nên
// không được đóng băng lúc build.
export const dynamic = 'force-dynamic';

export default async function GioiThieuPage() {
  const status = eventStatus();
  const beforeStart = status === 'truoc';
  const { rewardTiers, weekThemes, moonFragments } = await getSettings();

  return (
    <>
      <TopBar />

      <section className="hero fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Sự kiện 47 ngày · dành cho học viên PT</span>
          </p>
          <h1 className="display">
            Chạy dần đến
            <br />
            Trung thu
          </h1>
          <p className="pull-quote">
            <span className="qmark">«</span>Từ 10/08 đến đêm rằm 25/09, mỗi ngày một bước chạy, mỗi
            tuần một mảnh trăng — ai đi trọn 6 chặng sẽ bước vào đêm hội,{' '}
            <span className="hl">cùng phần thưởng lớn nhất mùa này</span>.<span className="qmark">»</span>
          </p>

          <Countdown
            target={beforeStart ? KICKOFF_AT : FESTIVAL_AT}
            note={
              beforeStart ? 'tới ngày khởi động · 10/08/2026' : 'tới đêm hội trăng rằm · 25/09/2026'
            }
          />

          <div className="btn-row">
            <Link href="/vao" className="btn-primary">
              {beforeStart ? 'Đăng ký tham gia' : 'Vào bằng mã cá nhân'}
            </Link>
            <a href="#cach-choi" className="btn-ghost">
              Xem luật chơi
            </a>
          </div>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vì sao là thỏ chạy trăng</span>
          </p>
          <h2 className="section-title">Một vòng, không phải một đường thẳng</h2>
          <p className="lede">
            Đêm rằm tháng Tám, trăng tròn nhất năm — dân gian mình vẫn kể chuyện chú Cuội ngồi dưới
            gốc đa, thỏ ngọc chạy quanh cung trăng. 47 ngày tới đây cũng vậy: mỗi bạn là một chú thỏ,
            mỗi ngày chạy thêm một bước trên một vòng cung. Không có đường tắt, không có về đích sớm —
            vòng chỉ khép lại đúng đêm trăng tròn, khi ai đó đã đi đủ cả quãng đường.
          </p>
        </div>
      </section>

      <section className="fade-in" id="cach-choi">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Cách chơi</span>
          </p>
          <h2 className="section-title">5 bước, lặp lại suốt 47 ngày</h2>
          <ol className="steps">
            <li>
              <div>
                <h3>Đăng ký</h3>
                <p>
                  Comment &quot;THAM GIA&quot; dưới bài khởi động ngày 10/08, nhận mã cá nhân qua
                  Messenger.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Chạy mỗi ngày</h3>
                <p>
                  Đọc 1 kiến thức nhỏ, trả lời nhanh — thỏ của bạn tiến thêm 1 bước trên vòng trăng.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Dừng chân mỗi tuần</h3>
                <p>
                  Một buổi &quot;trạm dừng gốc đa&quot; mỗi tuần. Hoàn thành đủ 6 ngày và dự buổi này
                  để nhận 1 mảnh trăng.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Tuần chung kết</h3>
                <p>Ghép toàn bộ kiến thức 6 tuần vào 1 case study khách hàng thật.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Đêm 25/09</h3>
                <p>
                  Đủ 6 mảnh trăng và case study — vòng khép lại, bạn bước vào đêm hội và nhận quà lớn.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>6 chặng đường</span>
          </p>
          <h2 className="section-title">Mỗi tuần một trụ cột nghề coach</h2>
          <ol className="weeks">
            {moonFragments.slice(0, 6).map((frag, i) => (
              <li key={i}>
                <span className="wk-num mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className="wk-theme">{weekThemes[i]}</span>
                  <span className="wk-badge">Mảnh trăng &quot;{frag}&quot;</span>
                </div>
              </li>
            ))}
          </ol>
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

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vài điều nhỏ đáng biết</span>
          </p>
          <div className="mech-grid">
            <div className="mech-card">
              <h4>Vé cứu</h4>
              <p>Lỡ quên 1 ngày cũng không sao — mỗi người có 2 vé cứu dùng cho cả quãng đường.</p>
            </div>
            <div className="mech-card">
              <h4>Hộp quà bí ẩn</h4>
              <p>Có tuần sẽ có phần thưởng ngẫu nhiên, không báo trước lúc nào.</p>
            </div>
            <div className="mech-card">
              <h4>Ngày thỏ ngọc</h4>
              <p>Đâu đó trong 47 ngày, một ngày bí mật sẽ mang phần thưởng bất ngờ.</p>
            </div>
            <div className="mech-card">
              <h4>Trả lời sai vẫn được đi</h4>
              <p>Không ai bị loại vì 1 câu trả lời sai — chỉ mất phần điểm thưởng.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fade-in" id="dang-ky">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Đăng ký</span>
          </p>
          <h2 className="section-title">Bắt đầu từ 10/08/2026</h2>
          <div className="register-box">
            <p>
              <span className="amber-tag">Bước 1</span> — comment &quot;THAM GIA&quot; dưới bài khởi
              động trên trang TrungPrecisionCoach ngày 10/08.
            </p>
            <p>
              <span className="amber-tag">Bước 2</span> — nhận mã cá nhân qua Messenger, dùng mã đó để
              vào trang theo dõi mỗi ngày.
            </p>
            <p>
              <span className="amber-tag">Bước 3</span> — sau khi có mã, vào{' '}
              <Link href="/vao">trang theo dõi chặng đường</Link> để bắt đầu chạy.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          Precision Coach · TrungPrecisionCoach — <Link href="/vao">trang theo dõi chặng đường</Link>
        </div>
      </footer>
    </>
  );
}
