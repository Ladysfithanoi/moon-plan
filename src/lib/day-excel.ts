import 'server-only';
import ExcelJS from 'exceljs';
import { TOTAL_DAYS, dateForDay } from './event';
import { DAY_TYPE_LABEL, type DayType } from './scoring';
import { addRangeValidation, findColumns, readCell, styleSheet } from './excel-io';

/**
 * Đọc và ghi nội dung 47 ngày bằng file Excel.
 *
 * Khác bảng quiz ở một điểm quan trọng: số ngày là bộ khung cố định 1–47, ngày
 * dương lịch suy ra từ EVENT_START chứ không tự đặt. Cột "Ngày dương lịch" và
 * "Thứ" trong file chỉ để đọc cho dễ đối chiếu — nhập vào sẽ bị bỏ qua và tính
 * lại, tránh lệch với phần tính "hôm nay là ngày thứ mấy" của app.
 */

export const DAY_SHEET = 'Nội dung';

const COLUMNS = [
  { key: 'day', header: 'Ngày', width: 7 },
  { key: 'date', header: 'Ngày dương lịch', width: 15 },
  { key: 'weekday', header: 'Thứ', width: 10 },
  { key: 'week', header: 'Tuần', width: 7 },
  { key: 'dayType', header: 'Loại ngày', width: 14 },
  { key: 'phase', header: 'Giai đoạn', width: 16 },
  { key: 'weekTheme', header: 'Chủ đề tuần', width: 40 },
  { key: 'title', header: 'Tiêu đề', width: 46 },
  { key: 'body', header: 'Bài đọc', width: 90 },
  { key: 'prompt', header: 'Đề bài', width: 60 },
  { key: 'mechanic', header: 'Cơ chế', width: 40 },
  { key: 'webinarCode', header: 'Mã điểm danh', width: 15 },
  { key: 'webinarLink', header: 'Link webinar', width: 34 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  day: ['ngay', 'day', 'songay'],
  date: ['ngayduonglich', 'date', 'ngaythang'],
  weekday: ['thu', 'weekday'],
  week: ['tuan', 'week'],
  dayType: ['loaingay', 'daytype', 'loai'],
  phase: ['giaidoan', 'phase'],
  weekTheme: ['chudetuan', 'weektheme', 'chude'],
  title: ['tieude', 'title'],
  body: ['baidoc', 'body', 'noidung', 'noidungbaidoc'],
  prompt: ['debai', 'prompt'],
  mechanic: ['coche', 'mechanic'],
  webinarCode: ['madiemdanh', 'webinarcode', 'ma'],
  webinarLink: ['linkwebinar', 'webinarlink', 'link'],
};

const DAY_TYPES = Object.keys(DAY_TYPE_LABEL) as DayType[];

export type DayExcelRow = {
  excelRow: number;
  day: number;
  day_type: DayType;
  phase: string;
  week_theme: string;
  title: string;
  body: string;
  prompt: string | null;
  mechanic: string | null;
  webinar_code: string | null;
  webinar_link: string | null;
};

export type DayExportRow = {
  day: number;
  date: string;
  weekday: string;
  week: number;
  day_type: string;
  phase: string;
  week_theme: string;
  title: string;
  body: string;
  prompt: string | null;
  mechanic: string | null;
  webinar_code: string | null;
  webinar_link: string | null;
};

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Thứ trong tuần của ngày thứ n, suy từ ngày dương lịch. */
export function weekdayForDay(n: number): string {
  const [y, m, d] = dateForDay(n).split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Tuần thứ mấy: 7 ngày một tuần, tuần cuối chỉ có 5 ngày. */
export function weekForDay(n: number): number {
  return Math.min(Math.ceil(n / 7), 7);
}

export type DayParseResult =
  | { ok: true; rows: DayExcelRow[] }
  | { ok: false; errors: string[] };

/**
 * Đọc file nội dung. Kiểm hết mọi dòng rồi mới trả lỗi; sai một dòng là không
 * ghi gì cả, giống bảng quiz.
 */
export async function parseDayWorkbook(buffer: ArrayBuffer): Promise<DayParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { ok: false, errors: ['Không đọc được file. Cần đúng định dạng .xlsx.'] };
  }

  const sheet = wb.getWorksheet(DAY_SHEET) ?? wb.worksheets[0];
  if (!sheet) return { ok: false, errors: ['File không có sheet nào.'] };

  const colOf = findColumns(sheet, HEADER_ALIASES);
  const required: ColumnKey[] = ['day', 'title', 'body'];
  const missing = required.filter((k) => colOf[k] === undefined);
  if (missing.length) {
    const names = missing.map((k) => COLUMNS.find((c) => c.key === k)!.header);
    return {
      ok: false,
      errors: [`Thiếu cột: ${names.join(', ')}. Tải file mẫu rồi điền vào đó cho chắc.`],
    };
  }

  const rows: DayExcelRow[] = [];
  const errors: string[] = [];
  const at = (row: ExcelJS.Row, key: ColumnKey) => readCell(row, colOf[key]);
  const seenDays = new Map<number, number>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rawDay = at(row, 'day');
    const title = at(row, 'title');
    const body = at(row, 'body');

    if (!rawDay && !title && !body) continue; // dòng trống ở cuối file

    const bad = (msg: string) => errors.push(`Dòng ${r}: ${msg}`);

    const day = Number(rawDay);
    if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) {
      bad(`cột Ngày phải là số nguyên 1–${TOTAL_DAYS} (đang là "${rawDay}").`);
    } else {
      const first = seenDays.get(day);
      if (first !== undefined) bad(`ngày ${day} đã có ở dòng ${first}.`);
      else seenDays.set(day, r);
    }

    if (!title) bad('thiếu tiêu đề.');
    if (!body) bad('thiếu bài đọc.');

    // Loại ngày nhận cả mã máy lẫn nhãn tiếng Việt hiện trong bảng.
    const rawType = at(row, 'dayType');
    let dayType: DayType = 'kien_thuc';
    if (rawType) {
      const match =
        DAY_TYPES.find((t) => t === rawType) ??
        DAY_TYPES.find((t) => DAY_TYPE_LABEL[t].toLowerCase() === rawType.toLowerCase());
      if (!match) bad(`loại ngày "${rawType}" không hợp lệ (${DAY_TYPES.join(', ')}).`);
      else dayType = match;
    }

    const week = Number.isInteger(day) ? weekForDay(day) : 1;

    rows.push({
      excelRow: r,
      day,
      day_type: dayType,
      phase: at(row, 'phase') || 'Scaffolding',
      week_theme: at(row, 'weekTheme') || `Tuần ${week}`,
      title,
      body,
      prompt: at(row, 'prompt') || null,
      mechanic: at(row, 'mechanic') || null,
      webinar_code: at(row, 'webinarCode').toUpperCase() || null,
      webinar_link: at(row, 'webinarLink') || null,
    });
  }

  if (!rows.length && !errors.length) {
    return { ok: false, errors: ['File không có dòng dữ liệu nào.'] };
  }
  return errors.length ? { ok: false, errors } : { ok: true, rows };
}

/** Dựng file Excel từ nội dung hiện có — vừa là bản xuất, vừa là file mẫu. */
export async function buildDayWorkbook(days: DayExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chạy dần đến Trung Thu';
  wb.created = new Date();

  const sheet = wb.addWorksheet(DAY_SHEET);
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  for (const d of days) {
    sheet.addRow({
      day: d.day,
      date: d.date,
      weekday: d.weekday,
      week: d.week,
      dayType: d.day_type,
      phase: d.phase,
      weekTheme: d.week_theme,
      title: d.title,
      body: d.body,
      prompt: d.prompt ?? '',
      mechanic: d.mechanic ?? '',
      webinarCode: d.webinar_code ?? '',
      webinarLink: d.webinar_link ?? '',
    });
  }

  styleSheet(sheet);

  const lastRow = Math.max(sheet.rowCount, 1) + 60;
  const colLetter = (key: ColumnKey) =>
    sheet.getColumn(COLUMNS.findIndex((c) => c.key === key) + 1).letter;

  addRangeValidation(sheet, `${colLetter('day')}2:${colLetter('day')}${lastRow}`, {
    type: 'whole',
    operator: 'between',
    formulae: [1, TOTAL_DAYS],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Ngày',
    error: `Chỉ nhận số nguyên từ 1 đến ${TOTAL_DAYS}.`,
  });

  // Danh sách xổ xuống cho loại ngày, khỏi phải nhớ mã.
  addRangeValidation(sheet, `${colLetter('dayType')}2:${colLetter('dayType')}${lastRow}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DAY_TYPES.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Loại ngày',
    error: `Chọn một trong: ${DAY_TYPES.join(', ')}.`,
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
