'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { registerPlayer, type LoginState } from '@/app/vao/actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Đang gieo hạt…' : 'Bắt đầu'}
    </button>
  );
}

export default function RegisterForm() {
  const [state, action] = useActionState<LoginState, FormData>(registerPlayer, {});

  return (
    <form action={action} style={{ maxWidth: 380 }}>
      <div className="field">
        <label htmlFor="display_name">Tên hiển thị</label>
        <input id="display_name" name="display_name" type="text" maxLength={40} autoComplete="name" required />
        <span className="hint">Tên này hiện ở bảng vinh danh và khi bạn tặng hoa.</span>
      </div>
      <div className="field">
        <label htmlFor="phone">Số điện thoại</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0912 345 678" required />
        <span className="hint">Dùng để đăng nhập lại. Chỉ người điều hành thấy số này.</span>
      </div>
      <div className="settings-grid">
        <div className="field">
          <label htmlFor="pin">Tự đặt mã PIN 4 số</label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="new-password"
            className="mono"
            placeholder="••••"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pin_confirm">Nhập lại PIN</label>
          <input
            id="pin_confirm"
            name="pin_confirm"
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="new-password"
            className="mono"
            placeholder="••••"
            required
          />
        </div>
      </div>
      <Submit />
      {state.error ? <p className="notice err">{state.error}</p> : null}
    </form>
  );
}
