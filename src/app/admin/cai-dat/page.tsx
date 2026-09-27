import { redirect } from 'next/navigation';
import ActionForm from '@/components/ActionForm';
import RepeatableRows from '@/components/RepeatableRows';
import { isAdmin } from '@/lib/session';
import { SETTING_KEYS, getSettings, maxPoints } from '@/lib/settings';
import { RIBBON_WEEKS, TOTAL_DAYS, WEEKS } from '@/lib/event';
import { TIERS } from '@/lib/scoring';
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
            Đây là phần hiện ngay trên trang giới thiệu, mục &quot;Buổi hội 20/10&quot; —
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
                  placeholder: 'vd: Bó hoa đủ 3 dải ruy băng + case study',
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

      {/* ─── Chủ đề tuần & ruy băng ───────────────────────────────────── */}
      <section className="fade-in">
        <div className="wrap-wide">
          <p className="eyebrow">
            <span className="rule" />
            <span>{WEEKS.length} chặng</span>
          </p>
          <h2 className="section-title">Chủ đề tuần và tên ruy băng</h2>
          <p className="lede">
            Tên này hiện ở trang giới thiệu, ở trang cành hoa của người chơi và ở bảng vinh danh. Đổi
            tên ruy băng không làm mất dải ai đã nhận — nhưng dải đã trao vẫn giữ tên cũ.
          </p>

          <ActionForm
            action={saveWeekLabels}
            submitLabel="Lưu các chặng"
            style={{ maxWidth: 680, marginTop: 26 }}
          >
            {WEEKS.map((w, i) => (
              <div className="repeat-row" key={w.week}>
                <div className="repeat-head">
                  <span className="repeat-index mono">
                    {i < RIBBON_WEEKS ? `Tuần ${w.week}` : 'Về đích'} · ngày {w.first}–{w.last}
                  </span>
                </div>
                <div className="field">
                  <label htmlFor={`theme-${i}`}>Chủ đề</label>
                  <input
                    id={`theme-${i}`}
                    name="week_theme"
                    type="text"
                    defaultValue={s.weekThemes[i] ?? ''}
                    required
                  />
                </div>
                {i < RIBBON_WEEKS ? (
                  <div className="field">
                    <label htmlFor={`ribbon-${i}`}>Tên ruy băng (trao ở Trạm hoa tuần này)</label>
                    <input
                      id={`ribbon-${i}`}
                      name="ribbon"
                      type="text"
                      defaultValue={s.ribbons[i] ?? ''}
                      required
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </ActionForm>

          <div style={{ marginTop: 14 }} className="btn-row">
            <ResetButton settingKey={SETTING_KEYS.weekThemes} label="Khôi phục chủ đề mặc định" />
            <ResetButton settingKey={SETTING_KEYS.ribbons} label="Khôi phục tên ruy băng" />
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
                  <label htmlFor="wb_base">Trạm hoa</label>
                  <input id="wb_base" name="wb_base" type="number" min={0} max={100} defaultValue={s.scoring.webinar.base} />
                </div>
                <div className="field">
                  <label htmlFor="cs_base">Case study về đích</label>
                  <input id="cs_base" name="cs_base" type="number" min={0} max={100} defaultValue={s.scoring.case_study.base} />
                </div>
              </div>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Hệ số nhân theo tầng hoa</span>
              </div>
              <div className="settings-grid">
                {TIERS.map((t, i) => (
                  <div className="field" key={t.key}>
                    <label htmlFor={`mult_${i}`}>
                      {t.name} ({t.min === 0 ? '1–2 ngày' : `từ ${t.min} ngày`})
                    </label>
                    <input
                      id={`mult_${i}`}
                      name={`mult_${i}`}
                      type="number"
                      step="0.1"
                      min={0}
                      max={10}
                      defaultValue={s.scoring.multipliers[i]}
                    />
                  </div>
                ))}
              </div>
              <span className="hint">
                Điểm gốc của ngày học đúng hạn nhân với hệ số này rồi làm tròn. Học bù luôn nhận điểm gốc.
              </span>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Vườn chung</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="garden_threshold">Ngưỡng nắng (% cả lớp)</label>
                  <input id="garden_threshold" name="garden_threshold" type="number" min={0} max={100} defaultValue={Math.round(s.scoring.garden.threshold * 100)} />
                </div>
                <div className="field">
                  <label htmlFor="garden_points">Điểm cho ai góp mặt ngày nắng</label>
                  <input id="garden_points" name="garden_points" type="number" min={0} max={100} defaultValue={s.scoring.garden.points} />
                </div>
                <div className="field">
                  <label htmlFor="garden_per_dew">Số ngày nắng đổi 1 giọt sương</label>
                  <input id="garden_per_dew" name="garden_per_dew" type="number" min={1} max={20} defaultValue={s.scoring.garden.sunnyPerDew} />
                  <span className="hint">Giọt này cộng cho tất cả mọi người.</span>
                </div>
              </div>
            </div>

            <div className="repeat-row">
              <div className="repeat-head">
                <span className="repeat-index mono">Phần thưởng khác</span>
              </div>
              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="box_chance">Tỉ lệ trúng hộp quà (%)</label>
                  <input id="box_chance" name="box_chance" type="number" min={0} max={100} defaultValue={Math.round(s.scoring.mysteryBoxChance * 100)} />
                </div>
                <div className="field">
                  <label htmlFor="secret_points">Điểm Bông hoa bí mật</label>
                  <input id="secret_points" name="secret_points" type="number" min={0} max={100} defaultValue={s.scoring.secretDayPoints} />
                  <span className="hint">Chỉ áp dụng cho ngày bí mật đặt sau này.</span>
                </div>
                <div className="field">
                  <label htmlFor="gift_points">Điểm mỗi lần tặng hoa</label>
                  <input id="gift_points" name="gift_points" type="number" min={0} max={100} defaultValue={s.scoring.giftPoints} />
                </div>
                <div className="field">
                  <label htmlFor="comeback_points">Thưởng hồi xuân</label>
                  <input id="comeback_points" name="comeback_points" type="number" min={0} max={100} defaultValue={s.scoring.comebackPoints} />
                  <span className="hint">Khi cây đang ngủ và người chơi quay lại học 3 ngày liền.</span>
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
          Số ngày của sự kiện cố định ở {TOTAL_DAYS} — từ 01/10 tới 20/10. Cành hoa, khung tuần và
          ngày Trạm hoa đều dựa vào đúng lịch đó.
        </div>
      </footer>
    </>
  );
}
