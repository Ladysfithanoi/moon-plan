import ActionForm from './ActionForm';
import type { ActionState } from '@/app/admin/actions';

export const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export type QuestionDraft = {
  id: string;
  ord: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explain: string | null;
};

/**
 * Form soạn một câu hỏi: 4 lựa chọn, chọn đúng một đáp án bằng nút tròn.
 *
 * Dùng chung cho cả thêm mới và sửa — khác nhau ở chỗ có `question` hay không.
 * Ô ẩn `day`/`id` cho server action biết đang làm gì.
 */
export default function QuestionForm({
  action,
  submitLabel,
  day,
  question,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  day?: number;
  question?: QuestionDraft;
}) {
  const options = question?.options ?? [];
  const correct = question?.correct_index ?? 0;
  const tag = question ? `q${question.id}` : `new${day}`;

  return (
    <ActionForm action={action} submitLabel={submitLabel} style={{ maxWidth: 760 }}>
      {day !== undefined ? <input type="hidden" name="day" value={day} /> : null}
      {question ? <input type="hidden" name="id" value={question.id} /> : null}

      <div className="field">
        <label htmlFor={`prompt-${tag}`}>Câu hỏi</label>
        <textarea
          id={`prompt-${tag}`}
          name="prompt"
          rows={2}
          defaultValue={question?.prompt ?? ''}
          required
        />
      </div>

      <fieldset className="opt-set">
        <legend>Bốn lựa chọn — chấm vào ô tròn của đáp án đúng</legend>
        {OPTION_LABELS.map((letter, i) => (
          <div className="opt-line" key={letter}>
            <input
              type="radio"
              name="correct"
              id={`correct-${tag}-${i}`}
              value={i + 1}
              defaultChecked={correct === i}
              aria-label={`Đáp án ${letter} là đáp án đúng`}
            />
            <label className="opt-letter" htmlFor={`correct-${tag}-${i}`}>
              {letter}
            </label>
            <input
              type="text"
              name={`option_${i + 1}`}
              defaultValue={options[i] ?? ''}
              placeholder={`Lựa chọn ${letter}`}
              aria-label={`Nội dung lựa chọn ${letter}`}
              required
            />
          </div>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor={`explain-${tag}`}>Giải thích (hiện sau khi người chơi trả lời)</label>
        <textarea
          id={`explain-${tag}`}
          name="explain"
          rows={2}
          defaultValue={question?.explain ?? ''}
        />
      </div>
    </ActionForm>
  );
}
