'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { doGiveFlower, type GiftState } from '@/app/chang-duong/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Đang gửi…' : 'Tặng hoa'}
    </button>
  );
}

export default function GiveFlower() {
  const [state, action] = useActionState<GiftState, FormData>(doGiveFlower, {});

  return (
    <form action={action} style={{ maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="toCode">Mã của người bạn muốn tặng</label>
        <input id="toCode" name="toCode" type="text" className="mono" placeholder="HOA-••••" required />
      </div>
      <div className="field">
        <label htmlFor="message">Nhắn một câu (tuỳ chọn)</label>
        <input id="message" name="message" type="text" maxLength={200} placeholder="Cố lên nhé" />
      </div>
      <Submit />
      {state.message ? (
        <p className={`notice ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
