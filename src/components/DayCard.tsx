'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Modal from './Modal';
import RichText from './RichText';
import { doCheckIn, doSubmitWork } from '@/app/chang-duong/actions';
import type { CheckinResult, PublicQuestion } from '@/lib/types';

type Reveal = { questionId: string; correctIndex: number; explain: string | null };

export type DayCardProps = {
  day: number;
  dayType: 'kien_thuc' | 'thu_thach' | 'quiz_tuan' | 'webinar' | 'case_study' | 'dem_hoi';
  title: string;
  body: string;
  prompt: string | null;
  week: number;
  weekTheme: string;
  questions: PublicQuestion[];
  done: boolean;
  savedAnswers: Record<string, { chosen: number; correct: boolean }>;
  reveal: Reveal[] | null;
  /** `note` là nhận xét Trung gửi riêng cho bài này — không phải ghi chú nội bộ. */
  submission: {
    body: string;
    files: { name: string }[];
    status: string;
    note: string | null;
  } | null;
  webinarAt: string | null;
  webinarLink: string | null;
  /**
   * Luật thưởng của quiz tổng hợp tuần, lấy từ bảng điểm đang dùng. Truyền
   * xuống để dòng "đúng từ mấy câu" được tính ra từ số câu thật của ngày —
   * đừng bao giờ viết con số này thẳng vào bài đọc, thêm câu là nó sai ngay.
   */
  bonusThreshold?: number;
  bonusPoints?: number;
  /** Xem lại ngày cũ — không cho thao tác nữa. */
  readOnly?: boolean;
};

/**
 * Số câu đúng tối thiểu để chạm ngưỡng bonus. Trừ một lượng rất nhỏ trước khi
 * làm tròn lên vì 5 × 0.8 trong dấu phẩy động ra 4.000000000000001 — không trừ
 * thì 5 câu lại đòi đúng cả 5.
 */
function neededCorrect(total: number, threshold: number): number {
  return Math.min(total, Math.max(1, Math.ceil(total * threshold - 1e-9)));
}

function Submit({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? busyLabel : label}
    </button>
  );
}

const EMPTY: CheckinResult = { ok: false, message: '' };

const SUBMISSION_STATUS: Record<string, { className: string; text: string }> = {
  pending: { className: 'info', text: 'Đã nhận bài của bạn — mình sẽ đọc và nhận xét.' },
  approved: { className: 'ok', text: 'Bài của bạn đã được duyệt.' },
  needs_work: { className: 'err', text: 'Bài này cần chỉnh lại một chút — đọc nhận xét bên dưới nhé.' },
};

/**
 * Kết quả chấm bài: trạng thái và nhận xét Trung gửi riêng cho bài này. Chỉ
 * `player_note` xuống tới đây — `admin_note` là ghi chú nội bộ, không bao giờ
 * đi vào props của component này.
 */
function Review({ status, note }: { status: string; note: string | null }) {
  const s = SUBMISSION_STATUS[status] ?? SUBMISSION_STATUS.pending;
  return (
    <div className="review-box">
      <p className={`notice ${s.className}`} style={{ marginTop: 0 }}>
        {s.text}
      </p>
      {note ? (
        <>
          <p className="review-label">Nhận xét của mình</p>
          <RichText text={note} />
        </>
      ) : null}
    </div>
  );
}

/** Thông báo sau khi ghi nhận: điểm, mảnh trăng, quà, vé cứu. */
function Feedback({ state }: { state: CheckinResult }) {
  return (
    <>
      {state.message ? (
        <p className={`notice ${state.ok ? 'ok' : 'err'}`}>
          {state.message}
          {state.ok && state.pointsAwarded ? ` (+${state.pointsAwarded}đ)` : ''}
        </p>
      ) : null}

      {state.ok && state.fragmentAwarded ? (
        <p className="notice ok">Bạn vừa thu được mảnh trăng &quot;{state.fragmentAwarded}&quot;.</p>
      ) : null}

      {(state.gifts ?? []).map((g, i) => (
        <div className="gift-card" key={i} style={{ marginTop: 18 }}>
          <h4>{g.title}</h4>
          <p>{g.detail}</p>
          {g.points ? <p className="gift-points mono">+{g.points}đ</p> : null}
        </div>
      ))}

      {(state.freezesUsed ?? 0) > 0 ? (
        <p className="notice info">
          Bạn lỡ mất {state.freezesUsed} ngày — vé cứu đã tự bù vào để chuỗi của bạn không đứt.
        </p>
      ) : null}
    </>
  );
}

export default function DayCard(props: DayCardProps) {
  const {
    day,
    dayType,
    title,
    body,
    prompt,
    week,
    weekTheme,
    questions,
    done,
    savedAnswers,
    submission,
    webinarAt,
    webinarLink,
    bonusThreshold,
    bonusPoints,
    readOnly,
  } = props;

  const [checkinState, checkinAction] = useActionState<CheckinResult, FormData>(doCheckIn, EMPTY);
  const [submitState, submitAction] = useActionState<CheckinResult, FormData>(doSubmitWork, EMPTY);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [quizOpen, setQuizOpen] = useState(false);

  // Đáp án chỉ lộ ra sau khi người chơi đã nộp bài ngày đó.
  const reveal: Reveal[] | null = checkinState.ok && checkinState.reveal ? checkinState.reveal : props.reveal;
  const revealMap = new Map((reveal ?? []).map((r) => [r.questionId, r]));
  const locked = done || checkinState.ok || readOnly === true;

  const chosenOf = (qid: string): number | undefined =>
    savedAnswers[qid]?.chosen ?? picked[qid];

  const isSubmission = dayType === 'thu_thach' || dayType === 'case_study';
  const hasQuiz = questions.length > 0;
  const answered = questions.filter((q) => chosenOf(q.id) !== undefined).length;

  // Luật thưởng viết ra từ số câu thật của ngày, không phải từ bài đọc.
  const bonusRule =
    dayType === 'quiz_tuan' && hasQuiz && bonusThreshold && bonusPoints
      ? `Đúng từ ${neededCorrect(questions.length, bonusThreshold)}/${questions.length} câu trở lên bạn nhận thêm ${bonusPoints}đ tia sáng bonus.`
      : null;

  return (
    <div className="today-card">
      <p className="eyebrow">
        <span className="rule" />
        <span>
          Tuần {week} · {weekTheme}
        </span>
      </p>
      <h2 className="section-title">{title}</h2>

      <RichText text={body} />

      {/*
        Ô "Đề bài" của ngày không nộp bài — case study đọc trong buổi trạm dừng
        gốc đa, tình huống kèm theo bài đọc. Ngày nộp bài đặt phần này ngay trên
        khung nộp ở dưới, nên ở đây chỉ hiện cho những ngày còn lại.
      */}
      {prompt && !isSubmission ? (
        <>
          <hr className="divider" />
          <RichText text={prompt} />
        </>
      ) : null}

      {/* ─── Webinar ───────────────────────────────────────────────────── */}
      {dayType === 'webinar' ? (
        <div style={{ marginTop: 22 }}>
          {webinarAt ? (
            <p className="coach-note">
              Giờ bắt đầu:{' '}
              <span className="mono">
                {new Date(webinarAt).toLocaleString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
              {webinarLink ? (
                <>
                  {' · '}
                  <a href={webinarLink} target="_blank" rel="noreferrer">
                    vào phòng họp
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          {locked ? (
            <p className="notice ok">Bạn đã điểm danh buổi này.</p>
          ) : (
            <form action={checkinAction}>
              <input type="hidden" name="day" value={day} />
              <div className="field" style={{ maxWidth: 280 }}>
                <label htmlFor="webinarCode">Mã điểm danh</label>
                <input
                  id="webinarCode"
                  name="webinarCode"
                  type="text"
                  className="mono"
                  autoComplete="off"
                  placeholder="mã đọc trong buổi"
                  required
                />
              </div>
              <Submit label="Điểm danh nhận mảnh trăng" busyLabel="Đang gửi…" />
            </form>
          )}
        </div>
      ) : null}

      {/* ─── Quiz ──────────────────────────────────────────────────────── */}
      {/* Bài đọc trước, quiz sau — mở trong modal để không vừa đọc vừa làm. */}
      {hasQuiz ? (
        <div className="quiz-cta">
          <hr className="divider" />
          {done || checkinState.ok ? (
            <>
              <p className="notice ok">Bạn đã làm bài quiz của ngày này.</p>
              <button type="button" className="btn-ghost" onClick={() => setQuizOpen(true)}>
                Xem lại bài quiz
              </button>
            </>
          ) : readOnly ? (
            <>
              <p className="coach-note">Ngày này đã qua — xem lại đề được, nhưng không ghi điểm nữa.</p>
              <button type="button" className="btn-ghost" onClick={() => setQuizOpen(true)}>
                Xem bài quiz
              </button>
            </>
          ) : (
            <>
              <p className="coach-note">
                Đọc xong rồi thì thử sức nhé — {questions.length} câu, làm trong một lượt.
                {bonusRule ? ` ${bonusRule}` : ''}
              </p>
              <button type="button" className="btn-primary" onClick={() => setQuizOpen(true)}>
                Làm quiz
              </button>
            </>
          )}
        </div>
      ) : null}

      {hasQuiz ? (
        <Modal
          open={quizOpen}
          onClose={() => setQuizOpen(false)}
          title={`Quiz ngày ${day}`}
          subtitle={
            locked
              ? `${questions.length} câu · đã khoá`
              : `${questions.length} câu · đã chọn ${answered}/${questions.length}`
          }
        >
          <form action={checkinAction}>
            <input type="hidden" name="day" value={day} />

            {questions.map((q, qi) => {
              const rv = revealMap.get(q.id);
              const chosen = chosenOf(q.id);

              return (
                <div className="quiz" key={q.id}>
                  <p className="quiz-q">
                    {questions.length > 1 ? <span className="qn mono">{qi + 1}.</span> : null}
                    {q.prompt}
                  </p>
                  <div className="quiz-opts">
                    {q.options.map((opt, oi) => {
                      const isChosen = chosen === oi;
                      let cls = 'quiz-opt';
                      if (locked) {
                        cls += ' locked';
                        if (rv && oi === rv.correctIndex) cls += ' right';
                        else if (isChosen) cls += ' wrong';
                      } else if (isChosen) {
                        cls += ' selected';
                      }

                      return (
                        <button
                          type="button"
                          key={oi}
                          className={cls}
                          aria-pressed={isChosen}
                          disabled={locked}
                          onClick={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {chosen !== undefined ? (
                    <input type="hidden" name={`answer:${q.id}`} value={chosen} />
                  ) : null}
                  {locked && rv?.explain ? (
                    <p className={`quiz-fb ${chosen === rv.correctIndex ? 'correct' : 'incorrect'}`}>
                      {rv.explain}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {!locked ? (
              <div className="modal-foot">
                <p className="coach-note">
                  {bonusRule ? `${bonusRule} ` : ''}
                  Sai cũng không sao — thỏ vẫn đi tiếp, chỉ là chưa nhận được phần điểm thưởng.
                </p>
                <Submit label="Nộp bài quiz" busyLabel="Đang ghi…" />
              </div>
            ) : null}
          </form>

          {/* Kết quả hiện ngay trong modal, nơi người chơi đang nhìn. */}
          <Feedback state={checkinState} />

          {locked ? (
            <div className="modal-foot">
              <button type="button" className="btn-ghost" onClick={() => setQuizOpen(false)}>
                Đóng
              </button>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {/* Ngày không có quiz (kể cả đêm hội) vẫn cần một nút để khép lại */}
      {questions.length === 0 && !isSubmission && dayType !== 'webinar' ? (
        locked ? (
          <p className="notice ok" style={{ marginTop: 18 }}>
            {dayType === 'dem_hoi' ? 'Vòng của bạn đã khép lại.' : 'Bạn đã hoàn thành ngày này rồi.'}
          </p>
        ) : (
          <form action={checkinAction} style={{ marginTop: 22 }}>
            <input type="hidden" name="day" value={day} />
            <Submit
              label={dayType === 'dem_hoi' ? 'Khép vòng trăng' : 'Đánh dấu hoàn thành hôm nay'}
              busyLabel="Đang ghi…"
            />
          </form>
        )
      ) : null}

      {/* ─── Nộp bài ───────────────────────────────────────────────────── */}
      {isSubmission ? (
        <div style={{ marginTop: 8 }}>
          {prompt ? (
            <>
              <hr className="divider" />
              <RichText text={prompt} />
            </>
          ) : null}

          {submission ? <Review status={submission.status} note={submission.note} /> : null}

          {readOnly ? (
            submission ? (
              <>
                <hr className="divider" />
                <p className="coach-note">Bài bạn đã nộp</p>
                <RichText text={submission.body} />
              </>
            ) : (
              <p className="notice info" style={{ marginTop: 18 }}>
                Bạn chưa nộp bài của ngày này.
              </p>
            )
          ) : (
            <form action={submitAction} style={{ marginTop: 22 }}>
              <input type="hidden" name="day" value={day} />
              <div className="field">
                <label htmlFor={`body-${day}`}>Bài của bạn</label>
                <textarea
                  id={`body-${day}`}
                  name="body"
                  rows={10}
                  defaultValue={submission?.body ?? ''}
                  placeholder="Viết thẳng vào đây. Không cần trau chuốt, cần cụ thể."
                />
              </div>
              <div className="field">
                <label htmlFor={`files-${day}`}>Đính kèm (tuỳ chọn)</label>
                <input
                  id={`files-${day}`}
                  name="files"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                />
                <span className="hint">Tối đa 3 file ảnh hoặc PDF, mỗi file dưới 5MB.</span>
                {submission?.files?.length ? (
                  <span className="hint">
                    Đã đính kèm: {submission.files.map((f) => f.name).join(', ')}
                  </span>
                ) : null}
              </div>
              <Submit
                label={submission ? 'Cập nhật bài nộp' : 'Nộp bài'}
                busyLabel="Đang gửi…"
              />
            </form>
          )}
        </div>
      ) : null}

      {/* ─── Phản hồi ──────────────────────────────────────────────────── */}
      {/* Ngày có quiz thì phản hồi điểm danh đã nằm trong modal rồi. */}
      {hasQuiz ? null : <Feedback state={checkinState} />}
      <Feedback state={submitState} />

      {done && !checkinState.ok && !isSubmission && !hasQuiz ? (
        <p className="notice ok" style={{ marginTop: 18 }}>
          Bạn đã hoàn thành ngày này rồi. Mai gặp lại nhé.
        </p>
      ) : null}
    </div>
  );
}
