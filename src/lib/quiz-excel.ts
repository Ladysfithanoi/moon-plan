import 'server-only';
import ExcelJS from 'exceljs';
import { TOTAL_DAYS } from './event';

/**
 * Đọc và ghi bộ câu hỏi quiz bằng file Excel.
 *
 * Một câu hỏi luôn có đúng 4 lựa chọn và đúng 1 đáp án đúng — luật này được
 * kiểm ở cả hai đầu: form trong trang admin và file Excel nhập vào.
 *
 * Trong file, cột "Đáp án đúng" đánh số 1–4 cho người dùng dễ đọc; trong cơ sở
 * dữ liệu `correct_index` vẫn đếm từ 0. Chỗ đổi qua lại nằm gọn trong file này.
 */

export const QUIZ_SHEET = 'Quiz';
export const OPTION_COUNT = 4;

/** Thứ tự cột trong file mẫu. Nhập vào thì dò theo tên, không theo vị trí. */
const COLUMNS = [
  { key: 'day', header: 'Ngày', width: 7 },
  { key: 'ord', header: 'STT', width: 6 },
  { key: 'prompt', header: 'Câu hỏi', width: 58 },
  { key: 'opt1', header: 'Đáp án 1', width: 28 },
  { key: 'opt2', header: 'Đáp án 2', width: 28 },
  { key: 'opt3', header: 'Đáp án 3', width: 28 },
  { key: 'opt4', header: 'Đáp án 4', width: 28 },
  { key: 'correct', header: 'Đáp án đúng', width: 13 },
  { key: 'explain', header: 'Giải thích', width: 58 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

export type QuizExcelRow = {
  /** Dòng trong file, tính cả dòng tiêu đề — để báo lỗi cho đúng chỗ. */
  excelRow: number;
  day: number;
  ord: number | null;
  prompt: string;
  options: string[];
  correctIndex: number;
  explain: string | null;
};

export type QuizExportRow = {
  day: number;
  ord: number;
  prompt: string;
  options: string[];
  correct_index: number;
  explain: string | null;
};

/**
 * Bỏ dấu và ký tự lạ để dò tên cột. Chú ý "đ" không tách ra được bằng NFD nên
 * phải thay tay, nếu không "đáp án 1" sẽ thành "đapan1" và dò trượt.
 */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Tên cột được chấp nhận cho mỗi trường, đã chuẩn hoá. */
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  day: ['ngay', 'day'],
  ord: ['stt', 'ord', 'thutu'],
  prompt: ['cauhoi', 'prompt', 'noidungcauhoi'],
  opt1: ['dapan1', 'luachon1', 'a', 'optiona'],
  opt2: ['dapan2', 'luachon2', 'b', 'optionb'],
  opt3: ['dapan3', 'luachon3', 'c', 'optionc'],
  opt4: ['dapan4', 'luachon4', 'd', 'optiond'],
  correct: ['dapandung', 'dapandung14', 'correct', 'dung'],
  explain: ['giaithich', 'explain', 'giaithichdapan'],
};

/** Ô Excel có thể là số, chuỗi, rich text, công thức… — quy hết về chuỗi. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map((t) => t.text).join('').trim();
    }
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text).trim();
  }
  return '';
}

export type ParseResult =
  | { ok: true; rows: QuizExcelRow[] }
  | { ok: false; errors: string[] };

/**
 * Đọc file Excel thành danh sách câu hỏi đã kiểm tra kỹ.
 *
 * Kiểm hết mọi dòng rồi mới trả lỗi, để người dùng sửa một lượt thay vì nhập
 * lại từng lần một. Chỉ cần một dòng sai là không ghi gì cả — tránh nhập nửa
 * chừng rồi không biết đã vào tới đâu.
 */
export async function parseQuizWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { ok: false, errors: ['Không đọc được file. Cần đúng định dạng .xlsx.'] };
  }

  const sheet = wb.getWorksheet(QUIZ_SHEET) ?? wb.worksheets[0];
  if (!sheet) return { ok: false, errors: ['File không có sheet nào.'] };

  // ─── Dò cột theo tiêu đề ──────────────────────────────────────────────────
  const headerRow = sheet.getRow(1);
  const colOf = {} as Record<ColumnKey, number>;
  headerRow.eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cellText(cell.value));
    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
      if (colOf[key] === undefined && aliases.includes(norm)) colOf[key] = colNumber;
    }
  });

  const required: ColumnKey[] = ['day', 'prompt', 'opt1', 'opt2', 'opt3', 'opt4', 'correct'];
  const missing = required.filter((k) => colOf[k] === undefined);
  if (missing.length) {
    const names = missing.map((k) => COLUMNS.find((c) => c.key === k)!.header);
    return {
      ok: false,
      errors: [
        `Thiếu cột: ${names.join(', ')}. Tải file mẫu ở nút bên cạnh rồi điền vào đó cho chắc.`,
      ],
    };
  }

  // ─── Đọc từng dòng ────────────────────────────────────────────────────────
  const rows: QuizExcelRow[] = [];
  const errors: string[] = [];
  const at = (row: ExcelJS.Row, key: ColumnKey) =>
    colOf[key] === undefined ? '' : cellText(row.getCell(colOf[key]).value);

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawDay = at(row, 'day');
    const prompt = at(row, 'prompt');
    const options = [at(row, 'opt1'), at(row, 'opt2'), at(row, 'opt3'), at(row, 'opt4')];
    const rawCorrect = at(row, 'correct');
    const rawOrd = at(row, 'ord');
    const explain = at(row, 'explain');

    // Dòng trống hoàn toàn thì bỏ qua — Excel hay để lại dòng thừa ở cuối.
    if (!rawDay && !prompt && !options.some(Boolean) && !rawCorrect) continue;

    const bad = (msg: string) => errors.push(`Dòng ${r}: ${msg}`);

    const day = Number(rawDay);
    if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) {
      bad(`cột Ngày phải là số nguyên 1–${TOTAL_DAYS} (đang là "${rawDay}").`);
    }
    if (!prompt) bad('thiếu câu hỏi.');

    const blanks = options
      .map((o, i) => (o ? null : i + 1))
      .filter((i): i is number => i !== null);
    if (blanks.length) bad(`đáp án ${blanks.join(', ')} còn trống — cần đủ 4 lựa chọn.`);

    const seen = new Map<string, number>();
    for (const [i, o] of options.entries()) {
      if (!o) continue;
      const k = o.toLowerCase();
      if (seen.has(k)) bad(`đáp án ${seen.get(k)! + 1} và ${i + 1} trùng nội dung nhau.`);
      else seen.set(k, i);
    }

    const correct = Number(rawCorrect);
    if (!Number.isInteger(correct) || correct < 1 || correct > OPTION_COUNT) {
      bad(`cột Đáp án đúng phải là 1, 2, 3 hoặc 4 (đang là "${rawCorrect}").`);
    }

    let ord: number | null = null;
    if (rawOrd) {
      const n = Number(rawOrd);
      if (!Number.isInteger(n) || n < 1) bad(`cột STT phải là số nguyên ≥ 1 (đang là "${rawOrd}").`);
      else ord = n;
    }

    rows.push({
      excelRow: r,
      day,
      ord,
      prompt,
      options,
      correctIndex: correct - 1,
      explain: explain || null,
    });
  }

  if (!rows.length && !errors.length) {
    return { ok: false, errors: ['File không có dòng dữ liệu nào.'] };
  }

  // Trùng (ngày, STT) sẽ đụng ràng buộc unique dưới cơ sở dữ liệu — bắt sớm ở đây.
  const byKey = new Map<string, number>();
  for (const row of rows) {
    if (row.ord === null) continue;
    const key = `${row.day}#${row.ord}`;
    const first = byKey.get(key);
    if (first !== undefined) {
      errors.push(`Dòng ${row.excelRow}: trùng Ngày ${row.day} STT ${row.ord} với dòng ${first}.`);
    } else {
      byKey.set(key, row.excelRow);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

/** Dựng file Excel từ bộ câu hỏi hiện có — vừa là bản xuất, vừa là file mẫu. */
export async function buildQuizWorkbook(questions: QuizExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chạy dần đến Trung Thu';
  wb.created = new Date();

  const sheet = wb.addWorksheet(QUIZ_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  for (const q of questions) {
    const opts = [...q.options, '', '', '', ''].slice(0, OPTION_COUNT);
    sheet.addRow({
      day: q.day,
      ord: q.ord,
      prompt: q.prompt,
      opt1: opts[0],
      opt2: opts[1],
      opt3: opts[2],
      opt4: opts[3],
      correct: q.correct_index + 1,
      explain: q.explain ?? '',
    });
  }

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
  });

  // Chỉ cho nhập 1–4 ở cột đáp án đúng, chặn sai ngay trong Excel.
  //
  // Gán theo vùng chứ không lặp qua getCell: đụng vào một ô là exceljs tạo thật
  // dòng đó, nên cách kia sẽ nhét vào file hàng trăm dòng rỗng.
  const correctCol = COLUMNS.findIndex((c) => c.key === 'correct') + 1;
  const colLetter = sheet.getColumn(correctCol).letter;
  const lastRow = Math.max(sheet.rowCount, 1) + 200; // chừa chỗ cho câu thêm tay

  // exceljs có sẵn API gán theo vùng lúc chạy nhưng quên khai trong file .d.ts,
  // nên phải ép kiểu ở đúng một chỗ này.
  const ranged = sheet as unknown as {
    dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void };
  };
  ranged.dataValidations.add(`${colLetter}2:${colLetter}${lastRow}`, {
    type: 'whole',
    operator: 'between',
    formulae: [1, OPTION_COUNT],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Đáp án đúng',
    error: 'Chỉ nhận 1, 2, 3 hoặc 4.',
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
