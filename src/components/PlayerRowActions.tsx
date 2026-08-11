'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Modal from './Modal';
import { deletePlayer, updatePlayer, type ActionState } from '@/app/admin/actions';
import type { PlayerRow } from '@/lib/types';

const EMPTY: ActionState = {};

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M11.2 1.9a1.4 1.4 0 0 1 2 2L5.4 11.7l-2.7.7.7-2.7 7.8-7.8Z" strokeLinejoin="round" />
      <path d="M2.5 14.1h11" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.6 4.2h10.8" strokeLinecap="round" />
      <path d="M6.2 4.2V2.9h3.6v1.3" strokeLinejoin="round" />
      <path d="M3.9 4.2 4.5 13a.9.9 0 0 0 .9.8h5.2a.9.9 0 0 0 .9-.8l.6-8.8" strokeLinejoin="round" />
      <path d="M6.6 6.7v4.6M9.4 6.7v4.6" strokeLinecap="round" />
    </svg>
  );
}

function Submit({
  label,
  busyLabel,
  danger,
}: {
  label: string;
  busyLabel: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`btn-primary btn-small${danger ? ' btn-danger' : ''}`}
      disabled={pending}
    >
      {pending ? busyLabel : label}
    </button>
  );
}

function EditForm({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updatePlayer, EMPTY);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={player.id} />
      <input type="hidden" name="is_active_present" value="1" />

      <div className="field">
        <label htmlFor={`name-${player.id}`}>Tên hiển thị</label>
        <input
          id={`name-${player.id}`}
          name="display_name"
          type="text"
          defaultValue={player.display_name}
        />
      </div>
      <div className="field">
        <label htmlFor={`contact-${player.id}`}>Liên hệ</label>
        <input
          id={`contact-${player.id}`}
          name="contact"
          type="text"
          defaultValue={player.contact ?? ''}
          placeholder="Messenger / Zalo / SĐT"
        />
      </div>
      <div className="field" style={{ maxWidth: 180 }}>
        <label htmlFor={`freezes-${player.id}`}>Vé cứu</label>
        <input
          id={`freezes-${player.id}`}
          name="freezes_left"
          type="number"
          min={0}
          max={10}
          defaultValue={player.freezes_left}
        />
        <span className="hint">số vé cứu còn lại</span>
      </div>
      <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={player.is_active}
          style={{ width: 'auto', marginRight: 6 }}
        />
        đang hoạt động
      </label>

      {state.message ? (
        <p className={`notice ${state.ok ? 'ok' : 'err'}`}>{state.message}</p>
      ) : null}

      <div className="modal-foot btn-row">
        <Submit label="Lưu thay đổi" busyLabel="Đang lưu…" />
        <button type="button" className="btn-ghost btn-small" onClick={onClose}>
          {state.ok ? 'Đóng' : 'Huỷ'}
        </button>
      </div>
    </form>
  );
}

function DeleteForm({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deletePlayer, EMPTY);

  // Xoá xong thì người chơi không còn nữa — chỉ giữ lại lời báo và nút đóng.
  if (state.ok) {
    return (
      <>
        <p className="notice ok">{state.message}</p>
        <div className="modal-foot">
          <button type="button" className="btn-ghost btn-small" onClick={onClose}>
            Đóng
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="confirm-decor">
        <span className="confirm-mark" aria-hidden="true">
          !
        </span>
        <div>
          <p className="confirm-lead">
            Xoá <strong>{player.display_name}</strong> khỏi hành trình?
          </p>
          <p className="confirm-sub">
            Mã <span className="mono">{player.code}</span> · {player.points}đ · chuỗi {player.streak}{' '}
            ngày
          </p>
        </div>
      </div>

      <ul className="confirm-list">
        <li>Mất sạch check-in, câu trả lời, mảnh trăng và bài đã nộp.</li>
        <li>File đính kèm trong kho cũng bị xoá theo.</li>
        <li>Không khôi phục lại được.</li>
      </ul>

      <p className="coach-note">
        Chỉ muốn tạm dừng thì bỏ tick “đang hoạt động” ở nút sửa, đừng xoá.
      </p>

      <form action={formAction}>
        <input type="hidden" name="id" value={player.id} />
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor={`confirm-${player.id}`}>Gõ mã để xác nhận</label>
          <input
            id={`confirm-${player.id}`}
            name="confirm_code"
            type="text"
            className="mono"
            placeholder={player.code}
            autoComplete="off"
          />
        </div>

        {state.message ? <p className="notice err">{state.message}</p> : null}

        <div className="modal-foot btn-row">
          <Submit label="Xoá vĩnh viễn" busyLabel="Đang xoá…" danger />
          <button type="button" className="btn-ghost btn-small" onClick={onClose}>
            Giữ lại
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * Hai nút nhỏ nằm ngay dòng của người chơi. Form sửa và lời xác nhận xoá chỉ
 * dựng lên khi modal mở, nhờ vậy mỗi lần mở là một form sạch, không còn thông
 * báo của lần trước.
 */
export default function PlayerRowActions({ player }: { player: PlayerRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setEditOpen(true)}
        title={`Sửa ${player.display_name}`}
        aria-label={`Sửa ${player.display_name} (${player.code})`}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="icon-btn danger"
        onClick={() => setDeleteOpen(true)}
        title={`Xoá ${player.display_name}`}
        aria-label={`Xoá ${player.display_name} (${player.code})`}
      >
        <TrashIcon />
      </button>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Sửa ${player.display_name}`}
        subtitle={`Mã ${player.code}`}
      >
        <EditForm player={player} onClose={() => setEditOpen(false)} />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Chắc chưa?"
        subtitle="Việc này không hoàn lại được"
        tone="danger"
      >
        <DeleteForm player={player} onClose={() => setDeleteOpen(false)} />
      </Modal>
    </div>
  );
}
