import 'server-only';
import ExcelJS from 'exceljs';

/**
 * Phần dùng chung cho mọi bảng Excel trong trang admin: đọc ô, dò tên cột,
 * gán ràng buộc theo vùng. Bộ câu hỏi quiz và nội dung 47 ngày đều xài lại.
 */

/** Ô Excel có thể là số, chuỗi, rich text, công thức… — quy hết về chuỗi. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
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

/**
 * Bỏ dấu và ký tự lạ để dò tên cột, nhờ vậy "Ngày", "ngay", "NGÀY" đều khớp.
 *
 * Chú ý "đ" không tách ra được bằng NFD nên phải thay tay, nếu không
 * "đáp án 1" sẽ thành "đapan1" và dò trượt.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Dò vị trí từng cột trong dòng tiêu đề theo bảng tên chấp nhận được. */
export function findColumns<K extends string>(
  sheet: ExcelJS.Worksheet,
  aliases: Record<K, string[]>,
): Partial<Record<K, number>> {
  const found: Partial<Record<K, number>> = {};
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cellText(cell.value));
    for (const [key, names] of Object.entries(aliases) as [K, string[]][]) {
      if (found[key] === undefined && names.includes(norm)) found[key] = colNumber;
    }
  });
  return found;
}

/** Đọc một ô theo cột đã dò; cột không có thì trả chuỗi rỗng. */
export function readCell(
  row: ExcelJS.Row,
  col: number | undefined,
): string {
  return col === undefined ? '' : cellText(row.getCell(col).value);
}

/**
 * Gán ràng buộc nhập liệu cho cả một vùng.
 *
 * exceljs có sẵn API này lúc chạy nhưng quên khai trong file .d.ts, nên ép kiểu
 * gọn ở đây thay vì rải khắp nơi. Không dùng vòng lặp getCell được: đụng vào
 * một ô là exceljs tạo thật dòng đó, sẽ nhét vào file hàng trăm dòng rỗng.
 */
export function addRangeValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  validation: ExcelJS.DataValidation,
): void {
  const ranged = sheet as unknown as {
    dataValidations: { add(range: string, v: ExcelJS.DataValidation): void };
  };
  ranged.dataValidations.add(range, validation);
}

/** Định dạng dòng tiêu đề và cho phép xuống dòng ở các ô dữ liệu. */
export function styleSheet(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
  });
}
