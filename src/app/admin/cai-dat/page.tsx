import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import RepeatableRows from '@/components/RepeatableRows';
import { isAdmin } from '@/lib/session';
import { SETTING_KEYS, getSettings, maxPoints } from '@/lib/settings';
import {
  resetSetting,
  saveBoxPrizes,
  saveRewardTiers,
  saveScoring,
  saveWeekLabels,
} from '../actions';

export const dynamic = 'force-dynamic';

function ResetButton({ settingKey, label }: { settingKey: string; label: string }) {
  return (
    <ActionForm action={resetSetting} submitLabel={label} busyLabel="Đang khôi phục…" ghost>
      <input type="hidden" name="key" value={settingKey} />
    </ActionForm>
  );
}

export default async function CaiDatPage() {
  if (!(await isAdmin())) redirect('/admin/vao');

  const s = await getSettings();

  return (
    <>
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Đổi được mà không cần deploy lại</span>
          </p>
          <h1 className="display">Cài đặt</h1>
          <p className="lede">
            Mọi thứ ở trang này lưu thẳng vào cơ sở dữ liệu và có hiệu lực ngay khi bấm lưu. Nội dung
            bài học và câu hỏi thì nằm ở mục <strong>Nội dung</strong>.
          </p>
        </div>
      </section>

      {/* ─── Bậc thưởng cuối sự kiện ──────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Ưu tiên sửa trước</span>
          </p>
          <h2 className="section-title">Bậc thưởng cuối sự kiện</h2>
          <p className="lede">
            Đây là phần hiện ngay trên trang giới thiệu, mục &quot;Đêm hội trăng rằm, 25/09&quot; —
            thứ học viên đọc trước khi quyết định tham gia. Tiêu đề là điều kiện đạt được, phần mô tả
            là quyền lợi.
          </p>

          <ActionForm
            action={saveRewardTiers}
            submitLabel="Lưu bậc thưởng"
            style={{ maxWidth: 680, marginTop: 26 }}
          >
            <RepeatableRows
              itemLabel="Bậc"
              addLabel="+ Thêm một bậc thưởng"
              fields={[
                {
                  name: 'tier_title',
                  label: 'Điều kiện đạt được',
                  placeholder: 'vd: Đủ 6 mảnh trăng + case study',
                },
                {
                  name: 'tier_detail',
                  label: 'Quyền lợi',
                  type: 'textarea',
                  placeholder: 'vd: Giảm sâu khoá VPTA nâng cao, chứng chỉ…',
                },
              ]}
              initial={s.rewardTiers.map((t) => ({ tier_title: t.title, tier_detail: t.detail }))}
            />
          </ActionForm>

          <div style={{ marginTop: 14 }}>
            <ResetButton settingKey={SETTING_KEYS.rewardTiers} label="Khôi phục bậc thưởng mặc định" />
          </div>
        </div>
      </section>

      {/* ─── Chủ đề tuần & mảnh trăng ─────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Sáu chặng</span>
          </p>
          <h2 className="section-title">Chủ đề tuần và tên mảnh trăng</h2>
          <p className="lede">
            Tên này hiện ở trang giới thiệu, ở vòng trăng của người chơi và ở bảng vinh danh. Đổi tên
            mảnh trăng không làm mất mảnh ai đã thu — nhưng mảnh đã trao vẫn giữ tên cũ.
          </p>

          <ActionForm
            action={saveWeekLabels}
            submitLabel="Lưu sáu chặng"
            style={{ maxWidth: 680, marginTop: 26 }}
          >
            {s.weekThemes.slice(0, 6).map((theme, i) => (
              <div className="repeat-row" key={i}>
                <div className="repeat-head">
                  <span className="repeat-index mono">Tuần {i + 1}</span>
                </div>
                <div className="field">
                  <label htmlFor={`theme-${i}`}>Chủ đề</label>
                  <input id={`theme-${i}`} name="week_theme" type="text" defaultValue={theme} required />
                </div>
                <div className="field">
                  <label htmlFor={`frag-${i}`}>Tên mảnh trăng</label>
                  <input
                    id={`frag-${i}`}
                    name="moon_fragment"
                    type="text"
                    defaultValue={s.moonFragments[i] ?? ''}
                    required
                  />
                </div>
              </div>
            ))}
          </ActionForm>

          <div style={{ marginTop: 14 }} className="btn-row">
            <ResetButton settingKey={SETTING_KEYS.weekThemes} label="Khôi phục chủ đề mặc định" />
            <ResetButton settingKey={SETTING_KEYS.moonFragments} label="Khôi phục tên mảnh trăng" />
          </div>
        </div>
      </section>

      {/* ─── Hộp quà bí ẩn ────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Phần thưởng ngẫu nhiên</span>
          </p>
          <h2 className="section-title">Quà trong hộp quà bí ẩn</h2>
          <p className="lede">
            Sau mỗi lần nộp thử thách áp dụng, người chơi có cơ hội trúng một trong những phần quà
            này — tối đa một lần mỗi tuần. Phần quà được bốc ngẫu nhiên ở máy chủ, không ai đoán trước
            được.
          </p>

          <ActionForm
            action={saveBoxPrizes}
            submitLabel="Lưu danh sách quà"
            style={{ maxWidth: 680, marginTop: 26 }}
          >
            <RepeatableRows
              itemLabel="Quà"
              addLabel="+ Thêm một phần quà"
              fields={[
                { name: 'prize_title', label: 'Tên quà', placeholder: 'vd: Quyền hỏi ưu tiên' },
                {
                  name: 'prize_detail',
                  label: 'Mô tả cho người chơi đọc',
                  type: 'textarea',
                  placeholder: 'Viết như đang nói trực tiếp với họ.',
                },
                { name: 'prize_points', label: 'Điểm kèm theo', type: 'number', min: 0, max: 100 },
              ]}
              initial={s.boxPrizes.map((p) => ({
                prize_title: p.title,
                prize_detail: p.detail,
                prize_points: String(p.points),
              }))}
            />
          </ActionForm>

          <div style={{ marginTop: 14 }}>
            <ResetButton settingKey={SETTING_KEYS.boxPrizes} label="Khôi phục danh sách quà mặc định" />
          </div>
        </div>
      </section>

      {/* ─── Bảng điểm ────────────────────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>Tổng tối đa hiện tại: {maxPoints(s.scoring)}đ</span>
          </p>
          <h2 className="section-title">Bảng điểm</h2>
          <p className="lede">
            Đổi bảng điểm không tính lại điểm cũ — người chơi giữ nguyên số điểm đã có, luật mới áp
            dụng từ lần check-in tiếp theo. Nên cân nhắc kỹ nếu sự kiện đã chạy được vài tuần.
          </p>

          <ActionForm
            action={saveScoring}
            submitLabel="Lưu bảng điểm"
            style={{ maxWidth: 680, marginTop: 26 }}
          >
            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Ngày kiến thức</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="kt_base">Điểm có mặt</label>
                  <input id="kt_base" name="kt_base" type="number" min={0} max={100} defaultValue={s.scoring.kien_thuc.base} />
                </div>
                <div className="field">
                  <label htmlFor="kt_correct">Thưởng mỗi câu đúng</label>
                  <input id="kt_correct" name="kt_correct" type="number" min={0} max={100} defaultValue={s.scoring.kien_thuc.perCorrect} />
                  <span className="hint">Sai vẫn được điểm có mặt.</span>
                </div>
              </div>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Quiz tổng hợp tuần</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="qt_base">Điểm có mặt</label>
                  <input id="qt_base" name="qt_base" type="number" min={0} max={100} defaultValue={s.scoring.quiz_tuan.base} />
                </div>
                <div className="field">
                  <label htmlFor="qt_bonus">Điểm bonus</label>
                  <input id="qt_bonus" name="qt_bonus" type="number" min={0} max={100} defaultValue={s.scoring.quiz_tuan.bonus} />
                </div>
                <div className="field">
                  <label htmlFor="qt_threshold">Ngưỡng nhận bonus (%)</label>
                  <input id="qt_threshold" name="qt_threshold" type="number" min={0} max={100} defaultValue={Math.round(s.scoring.quiz_tuan.threshold * 100)} />
                </div>
              </div>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Các loại ngày khác</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="tt_base">Thử thách áp dụng</label>
                  <input id="tt_base" name="tt_base" type="number" min={0} max={100} defaultValue={s.scoring.thu_thach.base} />
                </div>
                <div className="field">
                  <label htmlFor="wb_base">Webinar</label>
                  <input id="wb_base" name="wb_base" type="number" min={0} max={100} defaultValue={s.scoring.webinar.base} />
                </div>
                <div className="field">
                  <label htmlFor="cs_base">Mỗi phần case study</label>
                  <input id="cs_base" name="cs_base" type="number" min={0} max={100} defaultValue={s.scoring.case_study.base} />
                </div>
              </div>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Phần thưởng ngẫu nhiên</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="box_chance">Tỉ lệ trúng hộp quà (%)</label>
                  <input id="box_chance" name="box_chance" type="number" min={0} max={100} defaultValue={Math.round(s.scoring.mysteryBoxChance * 100)} />
                </div>
                <div className="field">
                  <label htmlFor="rabbit_points">Điểm Ngày Thỏ Ngọc</label>
                  <input id="rabbit_points" name="rabbit_points" type="number" min={0} max={100} defaultValue={s.scoring.rabbitDayPoints} />
                  <span className="hint">Chỉ áp dụng cho ngày bí mật đặt sau này.</span>
                </div>
                <div className="field">
                  <label htmlFor="carrot_points">Điểm mỗi củ cà rốt</label>
                  <input id="carrot_points" name="carrot_points" type="number" min={0} max={100} defaultValue={s.scoring.carrotPoints} />
                </div>
              </div>
            </div>
          </ActionForm>

          <div style={{ marginTop: 14 }}>
            <ResetButton settingKey={SETTING_KEYS.scoring} label="Khôi phục bảng điểm mặc định" />
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap-wide">
          Số ngày của sự kiện cố định ở 47 — đó là khoảng cách từ 10/08 tới đêm rằm 25/09, và vòng
          cung khép kín dựa vào đúng con số đó.
        </div>
      </footer>
    </>
  );
}
