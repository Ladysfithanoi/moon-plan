'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginWithCode, loginWithPhone, type LoginState } from './actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Đang mở cổng…' : label}
    </button>
  );
}

function PhoneLogin() {
  const [state, action] = useActionState<LoginState, FormData>(loginWithPhone, {});
  return (
    <form action={action} style={{ maxWidth: 360 }}>
      <div className="field">
        <label htmlFor="phone">Số điện thoại</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0912 345 678" required />
      </div>
      <div className="field">
        <label htmlFor="pin">Mã PIN 4 số</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="current-password"
          className="mono"
          placeholder="••••"
          required
        />
      </div>
      <SubmitButton label="Vào cành hoa" />
      {state.error ? <p className="notice err">{state.error}</p> : null}
    </form>
  );
}

function CodeLogin() {
  const [state, action] = useActionState<LoginState, FormData>(loginWithCode, {});
  return (
    <form action={action} style={{ maxWidth: 360 }}>
      <div className="field">
        <label htmlFor="code">Mã cá nhân</label>
        <input
          id="code"
          name="code"
          type="text"
          className="code-input mono"
          placeholder="HOA-••••"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          required
        />
      </div>
      <SubmitButton label="Vào bằng mã" />
      {state.error ? <p className="notice err">{state.error}</p> : null}
    </form>
  );
}

export default function LoginForm() {
  return (
    <>
      <PhoneLogin />
      <details className="alt-login">
        <summary>Mình được gửi mã qua Messenger</summary>
        <CodeLogin />
      </details>
    </>
  );
}
