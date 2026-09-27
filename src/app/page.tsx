import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Countdown from '@/components/Countdown';
import { TierFlower } from '@/components/Flower';
import { FESTIVAL_AT, KICKOFF_AT, RIBBON_WEEKS, eventStatus } from '@/lib/event';
import { getSettings } from '@/lib/settings';
import { COMEBACK_DAYS, TIERS, type TierIndex } from '@/lib/scoring';

// Trang này đổi mặt theo ngày (đếm ngược tới khởi động hay tới 20/10), nên
// không được đóng băng lúc build.
export const dynamic = 'force-dynamic';

export default async function GioiThieuPage() {
  const status = eventStatus();
  const beforeStart = status === 'truoc';
  const { rewardTiers, weekThemes, ribbons, scoring, registrationOpen } = await getSettings();
  const canRegister = registrationOpen && status !== 'da-xong';
  const mult = (m: number) => `×${String(m).replace('.', ',')}`;

  return (
    <>
      <TopBar />

      <section className="hero fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Sự kiện 20 ngày · dành cho học viên PT</span>
          </p>
          <h1 className="display">
            Chạy dần đến
            <br />
            20/10
          </h1>
          <p className="pull-quote">
            <span className="qmark">«</span>Từ 01/10 đến 20/10, mỗi ngày hiểu thêm một điều về cơ thể
            khách hàng nữ — chu kỳ, hormone, sức mạnh, thèm ăn, chấn thương. Mỗi ngày một bông hoa, học
            càng đều hoa càng nở to, và đến 20/10{' '}
            <span className="hl">bạn có một bó hoa của riêng mình</span>.<span className="qmark">»</span>
          </p>

          <Countdown
            target={beforeStart ? KICKOFF_AT : FESTIVAL_AT}
            note={beforeStart ? 'tới ngày khởi động · 01/10/2026' : 'tới buổi hội 20/10/2026'}
          />

          <div className="btn-row">
            {canRegister ? (
              <Link href="/dang-ky" className="btn-primary">
                Đăng ký tham gia
              </Link>
            ) : null}
            <Link href="/vao" className={canRegister ? 'btn-ghost' : 'btn-primary'}>
              Đăng nhập
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
            <span>Vì sao là một bó hoa</span>
          </p>
          <h2 className="section-title">Món quà 20/10 thiết thực nhất cho khách nữ</h2>
          <p className="lede">
            Phần lớn khách của PT là phụ nữ, nhưng rất ít PT hiểu chu kỳ kinh nguyệt ảnh hưởng tới việc
            tập ra sao — và càng ít người biết phần nào là thật, phần nào là lời đồn. 20 ngày tới mình đi
            qua điều nghiên cứu thực sự nói: từ PMS, thuốc tránh thai, tập theo pha, tới thèm ăn và chấn
            thương ACL. Mỗi ngày bạn học là một bông hoa mọc trên cành; đến 20/10 các bông gom lại thành
            bó. Hiểu khách hàng nữ hơn — đó mới là bó hoa thật.
          </p>
        </div>
      </section>

      <section className="fade-in" id="cach-choi">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Học đều thì khác hẳn</span>
          </p>
          <h2 className="section-title">Chuỗi ngày càng dài, hoa càng nở to</h2>
          <p className="lede">
            Cùng một bài học, người đang có chuỗi dài nhận nhiều điểm hơn và mở được nhiều nội dung hơn.
          </p>
          <ol className="tier-cards">
            {TIERS.map((t, i) => (
              <li key={t.key}>
                <svg viewBox="-12 -12 24 24" className="tier-icon" aria-hidden="true">
                  <TierFlower tier={i as TierIndex} />
                </svg>
                <div>
                  <h3>
                    {t.name} <span className="mono soft-text">{mult(scoring.multipliers[i])} điểm</span>
                  </h3>
                  <p>
                    {t.min === 0 ? 'Chuỗi 1–2 ngày' : `Từ ${t.min} ngày liền`}
                    {t.unlock ? ` · mở ${t.unlock.toLowerCase()}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mech-grid">
            <div className="mech-card">
              <h4>Bỏ 1 ngày</h4>
              <p>
                Còn giọt sương thì app tự tưới, chuỗi giữ nguyên. Hết giọt sương thì cây khát nước, tụt
                một tầng. Mỗi người có 2 giọt.
              </p>
            </div>
            <div className="mech-card">
              <h4>Bỏ 2 ngày liền</h4>
              <p>
                Hoa héo, chuỗi về 0. Nhưng còn 48 giờ để học bù — bù đủ thì hoa hồi lại như chưa từng
                héo.
              </p>
            </div>
            <div className="mech-card">
              <h4>Nghỉ từ 3 ngày</h4>
              <p>
                Cây ngủ. Quay lại học {COMEBACK_DAYS} ngày liền là hồi xuân — lấy lại một nửa chuỗi cũ và
                thêm điểm thưởng quay lại.
              </p>
            </div>
            <div className="mech-card">
              <h4>Vườn chung</h4>
              <p>
                Ngày nào từ {Math.round(scoring.garden.threshold * 100)}% cả lớp học đúng hạn thì cả vườn
                nắng — cứ {scoring.garden.sunnyPerDew} ngày nắng, mọi người thêm một giọt sương.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Cách chơi</span>
          </p>
          <h2 className="section-title">5 bước, 20 ngày</h2>
          <ol className="steps">
            <li>
              <div>
                <h3>Đăng ký</h3>
                <p>Bấm “Đăng ký tham gia”, điền tên, số điện thoại và tự đặt một mã PIN 4 số.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Mỗi ngày một bông</h3>
                <p>Đọc một bài ngắn, trả lời nhanh — cành hoa của bạn mọc thêm một đốt.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Trạm hoa Chủ Nhật</h3>
                <p>
                  Một buổi trò chuyện tối Chủ Nhật mỗi tuần. Dự buổi để nhận một dải ruy băng buộc bó hoa.
                  Vắng cũng không làm héo hoa.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Case study 19/10</h3>
                <p>Ghép kiến thức 3 tuần vào kế hoạch cho một khách hàng nữ cụ thể.</p>
              </div>
            </li>
            <li>
              <div>
                <h3>Tối 20/10</h3>
                <p>Buộc bó hoa, nhận quà — to nhỏ tuỳ bạn đã chăm cây đều thế nào.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>{RIBBON_WEEKS} tuần học</span>
          </p>
          <h2 className="section-title">Mỗi tuần một dải ruy băng</h2>
          <ol className="weeks">
            {ribbons.slice(0, RIBBON_WEEKS).map((name, i) => (
              <li key={i}>
                <span className="wk-num mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className="wk-theme">{weekThemes[i]}</span>
                  <span className="wk-badge">{name}</span>
                </div>
              </li>
            ))}
            <li>
              <span className="wk-num mono">20/10</span>
              <div>
                <span className="wk-theme">{weekThemes[RIBBON_WEEKS]}</span>
                <span className="wk-badge">Buộc bó hoa</span>
              </div>
            </li>
          </ol>
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

      <section className="fade-in">
        <div className="wrap">
          <p className="eyebrow">
            <span className="rule" />
            <span>Vài điều nhỏ đáng biết</span>
          </p>
          <div className="mech-grid">
            <div className="mech-card">
              <h4>Hộp quà bí ẩn</h4>
              <p>Nộp thử thách áp dụng là có cơ hội mở quà ngẫu nhiên, không báo trước.</p>
            </div>
            <div className="mech-card">
              <h4>Bông hoa bí mật</h4>
              <p>Đâu đó trong 20 ngày có ngày giấu sẵn phần thưởng cho ai có mặt đúng hôm đó.</p>
            </div>
            <div className="mech-card">
              <h4>Trả lời sai vẫn được tính</h4>
              <p>Không ai bị loại vì một câu sai — cây vẫn lớn, chỉ mất phần điểm thưởng.</p>
            </div>
            <div className="mech-card">
              <h4>Tặng hoa</h4>
              <p>Gửi một bông kèm điểm cho người bạn cùng lớp đang cần tiếp sức.</p>
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
          <h2 className="section-title">Bắt đầu từ 01/10/2026</h2>
          <div className="register-box">
            <p>
              <span className="amber-tag">Bước 1</span> —{' '}
              {canRegister ? <Link href="/dang-ky">đăng ký tại đây</Link> : 'nhắn mình qua Messenger'}{' '}
              bằng tên và số điện thoại của bạn, tự đặt một mã PIN 4 số.
            </p>
            <p>
              <span className="amber-tag">Bước 2</span> — từ 01/10, mỗi ngày vào{' '}
              <Link href="/vao">trang cành hoa</Link> bằng số điện thoại và PIN.
            </p>
            <p>
              <span className="amber-tag">Bước 3</span> — học đều mỗi ngày để hoa nở to. Vậy thôi.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          Precision Coach · TrungPrecisionCoach — <Link href="/vao">trang cành hoa</Link>
        </div>
      </footer>
    </>
  );
}
