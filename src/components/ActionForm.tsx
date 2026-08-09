'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/admin/actions';

function Submit({ label, busyLabel, ghost }: { label: string; busyLabel: string; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${ghost ? 'btn-ghost' : 'btn-primary'} btn-small`}
      disabled={pending}
    >
      {pending ? busyLabel : label}
    </button>
  );
}

/**
 * Form dùng chung cho trang admin: gọi một server action, hiện thông báo kết quả.
 */
export default function ActionForm({
  action,
  children,
  submitLabel,
  busyLabel = 'Đang lưu…',
  ghost,
  style,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  busyLabel?: string;
  ghost?: boolean;
  style?: React.CSSProperties;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} style={style}>
      {children}
      <Submit label={submitLabel} busyLabel={busyLabel} ghost={ghost} />
      {state.message ? (
        <p className={`notice ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
