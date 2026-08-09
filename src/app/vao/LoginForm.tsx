'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginWithCode, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Đang mở cổng…' : 'Vào chặng đường'}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginWithCode, {});

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="code">Mã cá nhân của bạn</label>
        <input
          id="code"
          name="code"
          type="text"
          className="code-input mono"
          placeholder="THO-••••"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          required
        />
        <span className="hint">Mã mình gửi cho bạn qua Messenger sau khi bạn comment tham gia.</span>
      </div>

      <SubmitButton />
      {state.error ? <p className="notice err">{state.error}</p> : null}
    </form>
  );
}
