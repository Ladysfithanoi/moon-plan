'use client';

import { useState } from 'react';

export type RowField = {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number';
  placeholder?: string;
  /** Chỉ dùng cho type 'number' */
  min?: number;
  max?: number;
};

/**
 * Danh sách dòng thêm/xoá được trong một form.
 *
 * Mỗi ô input dùng chung một `name` qua tất cả các dòng, nên phía server đọc bằng
 * formData.getAll(name) là ra đúng thứ tự. Xoá một dòng là xoá cả cụm ô của dòng
 * đó, nên các mảng luôn khớp chỉ số với nhau.
 */
export default function RepeatableRows({
  fields,
  initial,
  addLabel,
  itemLabel,
  max = 12,
}: {
  fields: RowField[];
  initial: Record<string, string>[];
  addLabel: string;
  itemLabel: string;
  max?: number;
}) {
  const blank = Object.fromEntries(fields.map((f) => [f.name, ''])) as Record<string, string>;
  const [rows, setRows] = useState<Record<string, string>[]>(
    initial.length ? initial : [{ ...blank }],
  );

  const update = (i: number, name: string, value: string) =>
    setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, [name]: value } : r)));

  const remove = (i: number) => setRows((prev) => prev.filter((_, ri) => ri !== i));

  return (
    <>
      {rows.map((row, i) => (
        <div className="repeat-row" key={i}>
          <div className="repeat-head">
            <span className="repeat-index mono">
              {itemLabel} {i + 1}
            </span>
            {rows.length > 1 ? (
              <button type="button" className="repeat-remove" onClick={() => remove(i)}>
                Xoá
              </button>
            ) : null}
          </div>

          {fields.map((f) => (
            <div className="field" key={f.name}>
              <label htmlFor={`${f.name}-${i}`}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  id={`${f.name}-${i}`}
                  name={f.name}
                  rows={3}
                  placeholder={f.placeholder}
                  value={row[f.name] ?? ''}
                  onChange={(e) => update(i, f.name, e.target.value)}
                />
              ) : (
                <input
                  id={`${f.name}-${i}`}
                  name={f.name}
                  type={f.type === 'number' ? 'number' : 'text'}
                  min={f.min}
                  max={f.max}
                  placeholder={f.placeholder}
                  value={row[f.name] ?? ''}
                  onChange={(e) => update(i, f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {rows.length < max ? (
        <button
          type="button"
          className="btn-ghost btn-small"
          style={{ marginBottom: 18 }}
          onClick={() => setRows((prev) => [...prev, { ...blank }])}
        >
          {addLabel}
        </button>
      ) : null}
    </>
  );
}
