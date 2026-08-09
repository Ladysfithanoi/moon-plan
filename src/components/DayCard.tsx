'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
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
  submission: { body: string; files: { name: string }[]; status: string } | null;
  webinarAt: string | null;
  webinarLink: string | null;
  /** Xem lại ngày cũ — không cho thao tác nữa. */
  readOnly?: boolean;
};

function Submit({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? busyLabel : label}
    </button>
  );
}

const EMPTY: CheckinResult = { ok: false, message: '' };

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
    readOnly,
  } = props;

  const [checkinState, checkinAction] = useActionState<CheckinResult, FormData>(doCheckIn, EMPTY);
  const [submitState, submitAction] = useActionState<CheckinResult, FormData>(doSubmitWork, EMPTY);
  const [picked, setPicked] = useState<Record<string, number>>({});

  // Đáp án chỉ lộ ra sau khi người chơi đã nộp bài ngày đó.
  const reveal: Reveal[] | null = checkinState.ok && checkinState.reveal ? checkinState.reveal : props.reveal;
  const revealMap = new Map((reveal ?? []).map((r) => [r.questionId, r]));
  const locked = done || checkinState.ok || readOnly === true;

  const chosenOf = (qid: string): number | undefined =>
    savedAnswers[qid]?.chosen ?? picked[qid];

  const isSubmission = dayType === 'thu_thach' || dayType === 'case_study';

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
      {questions.length > 0 ? (
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
            <>
              <p className="coach-note">
                Sai cũng không sao — thỏ vẫn đi tiếp, chỉ là chưa nhận được phần điểm thưởng.
              </p>
              <Submit label="Đánh dấu hoàn thành hôm nay" busyLabel="Đang ghi…" />
            </>
          ) : null}
        </form>
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

          {readOnly ? (
            submission ? (
              <>
                <hr className="divider" />
                <p className="notice ok">Bạn đã nộp bài này.</p>
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
      {checkinState.message ? (
        <p className={`notice ${checkinState.ok ? 'ok' : 'err'}`}>
          {checkinState.message}
          {checkinState.ok && checkinState.pointsAwarded ? ` (+${checkinState.pointsAwarded}đ)` : ''}
        </p>
      ) : null}
      {submitState.message ? (
        <p className={`notice ${submitState.ok ? 'ok' : 'err'}`}>
          {submitState.message}
          {submitState.ok && submitState.pointsAwarded ? ` (+${submitState.pointsAwarded}đ)` : ''}
        </p>
      ) : null}

      {checkinState.ok && checkinState.fragmentAwarded ? (
        <p className="notice ok">
          Bạn vừa thu được mảnh trăng &quot;{checkinState.fragmentAwarded}&quot;.
        </p>
      ) : null}

      {[...(checkinState.gifts ?? []), ...(submitState.gifts ?? [])].map((g, i) => (
        <div className="gift-card" key={i} style={{ marginTop: 18 }}>
          <h4>{g.title}</h4>
          <p>{g.detail}</p>
          {g.points ? <p className="gift-points mono">+{g.points}đ</p> : null}
        </div>
      ))}

      {(checkinState.freezesUsed ?? 0) > 0 || (submitState.freezesUsed ?? 0) > 0 ? (
        <p className="notice info">
          Bạn lỡ mất {(checkinState.freezesUsed ?? 0) + (submitState.freezesUsed ?? 0)} ngày — vé cứu
          đã tự bù vào để chuỗi của bạn không đứt.
        </p>
      ) : null}

      {done && !checkinState.ok && !isSubmission ? (
        <p className="notice ok" style={{ marginTop: 18 }}>
          Bạn đã hoàn thành ngày này rồi. Mai gặp lại nhé.
        </p>
      ) : null}
    </div>
  );
}
