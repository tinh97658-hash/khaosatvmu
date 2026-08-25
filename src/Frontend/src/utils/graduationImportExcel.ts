import type { CellValue } from 'read-excel-file/browser';
import type { GraduationImportRow } from '../types/graduationAnalytics';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 5_000;

export type GraduationImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'READ_FAILED'
  | 'SHEET_STRUCTURE_INVALID'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'VALUE_TYPE_INVALID'
  | 'REVIEW_PERIOD_INVALID';

export class GraduationImportFileError extends Error {
  public readonly code: GraduationImportFileErrorCode;
  public readonly rowNumber?: number;

  constructor(
    code: GraduationImportFileErrorCode,
    rowNumber?: number,
  ) {
    super(code);
    this.code = code;
    this.rowNumber = rowNumber;
  }
}

export interface GraduationParsedFile {
  sheetName: string;
  rows: GraduationImportRow[];
}

const combiningMarks = new RegExp('[\u0300-\u036f]', 'g');
const normalize = (value: string) => value
  .normalize('NFD')
  .replace(combiningMarks, '')
  .replace(/đ/gi, 'd')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const cellText = (value: CellValue | null | undefined) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const numberCell = (
  value: CellValue | null | undefined,
  rowNumber: number,
): number | null => {
  if (value === null || value === undefined || cellText(value) === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = cellText(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new GraduationImportFileError('VALUE_TYPE_INVALID', rowNumber);
  return parsed;
};

const integerCell = (value: CellValue | null | undefined, rowNumber: number) => {
  const parsed = numberCell(value, rowNumber);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new GraduationImportFileError('VALUE_TYPE_INVALID', rowNumber);
  }
  return parsed;
};

const headerAliases: Record<keyof Omit<GraduationImportRow, 'sourceRowNumber'>, string[]> = {
  facultyName: ['ten khoa'],
  programCode: ['ma ctdt'],
  programName: ['ten ctdt'],
  cohort: ['khoa'],
  initialEnrollmentCount: ['so sv nhap hoc ban dau'],
  reviewPeriodText: ['thoi diem xet tot nghiep'],
  eligibleGraduateCount: ['so sv duoc xet tot nghiep'],
  onTimeGraduateCount: ['so sv tot nghiep dung han'],
  onTimeGraduateRate: ['ti le so sv tot nghiep dung han', 'ty le so sv tot nghiep dung han'],
  excellentCount: ['so sv tot nghiep xs', 'so sv tot nghiep xuat sac'],
  excellentRate: ['ti le sv tot nghiep xs', 'ty le sv tot nghiep xuat sac'],
  veryGoodCount: ['so sv tot nghiep gioi'],
  veryGoodRate: ['ti le sv tot nghiep gioi', 'ty le sv tot nghiep gioi'],
  goodCount: ['so sv tot nghiep kha'],
  goodRate: ['ti le sv tot nghiep kha', 'ty le sv tot nghiep kha'],
  averageCount: ['so sv tot nghiep t.binh', 'so sv tot nghiep trung binh'],
  averageRate: ['ti le sv tot nghiep t.binh', 'ty le sv tot nghiep trung binh'],
  workStudyTransferCount: ['so sv chuyen vhvl'],
  workStudyTransferRate: ['ti le sv chuyen vhvl', 'ty le sv chuyen vhvl'],
};

export async function parseGraduationImportFile(file: File): Promise<GraduationParsedFile> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new GraduationImportFileError('FILE_TYPE');
  if (file.size > maximumFileSize) throw new GraduationImportFileError('FILE_SIZE');

  let sheet: readonly (readonly (CellValue | null)[])[];
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new GraduationImportFileError('READ_FAILED');
  }

  const headerStart = sheet.findIndex((row) =>
    row.some((cell) => normalize(cellText(cell)) === 'ten khoa'));
  if (headerStart < 0) throw new GraduationImportFileError('SHEET_STRUCTURE_INVALID');

  const headerRows = sheet.slice(headerStart, Math.min(headerStart + 2, sheet.length));
  const maxColumns = Math.max(...headerRows.map((row) => row.length));
  const normalizedHeaders = Array.from({ length: maxColumns }, (_, index) =>
    headerRows.map((row) => normalize(cellText(row[index]))).filter(Boolean));
  const indexOf = (aliases: string[]) => normalizedHeaders.findIndex((values) =>
    values.some((value) => aliases.includes(value)));

  const indexes = Object.fromEntries(
    Object.entries(headerAliases).map(([key, aliases]) => [key, indexOf(aliases)]),
  ) as Record<keyof typeof headerAliases, number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new GraduationImportFileError('SHEET_STRUCTURE_INVALID');
  }

  const dataStart = headerStart + 2;
  const value = (row: readonly (CellValue | null)[], key: keyof typeof indexes) => row[indexes[key]];
  const rows: GraduationImportRow[] = [];
  for (let index = dataStart; index < sheet.length; index += 1) {
    const source = sheet[index];
    const sourceRowNumber = index + 1;
    const primaryValues = [
      value(source, 'facultyName'), value(source, 'programCode'), value(source, 'programName'),
      value(source, 'cohort'), value(source, 'initialEnrollmentCount'), value(source, 'reviewPeriodText'),
      value(source, 'eligibleGraduateCount'), value(source, 'onTimeGraduateCount'),
      value(source, 'excellentCount'), value(source, 'veryGoodCount'), value(source, 'goodCount'),
      value(source, 'averageCount'), value(source, 'workStudyTransferCount'),
    ];
    if (primaryValues.every((cell) => cellText(cell) === '')) continue;
    // Dòng ngay dưới header chỉ đánh số thứ tự 1..19.
    if (cellText(value(source, 'facultyName')) === '1'
      && cellText(value(source, 'programCode')) === '2') continue;

    const reviewPeriodText = cellText(value(source, 'reviewPeriodText'));
    if (!/(?:T(?:háng)?\s*)?\d{1,2}\s*[-/]\s*\d{4}/i.test(reviewPeriodText)) {
      throw new GraduationImportFileError('REVIEW_PERIOD_INVALID', sourceRowNumber);
    }
    rows.push({
      sourceRowNumber,
      facultyName: cellText(value(source, 'facultyName')),
      programCode: cellText(value(source, 'programCode')) || null,
      programName: cellText(value(source, 'programName')),
      cohort: cellText(value(source, 'cohort')),
      initialEnrollmentCount: integerCell(value(source, 'initialEnrollmentCount'), sourceRowNumber),
      reviewPeriodText,
      eligibleGraduateCount: integerCell(value(source, 'eligibleGraduateCount'), sourceRowNumber),
      onTimeGraduateCount: integerCell(value(source, 'onTimeGraduateCount'), sourceRowNumber),
      onTimeGraduateRate: numberCell(value(source, 'onTimeGraduateRate'), sourceRowNumber),
      excellentCount: integerCell(value(source, 'excellentCount'), sourceRowNumber),
      excellentRate: numberCell(value(source, 'excellentRate'), sourceRowNumber),
      veryGoodCount: integerCell(value(source, 'veryGoodCount'), sourceRowNumber),
      veryGoodRate: numberCell(value(source, 'veryGoodRate'), sourceRowNumber),
      goodCount: integerCell(value(source, 'goodCount'), sourceRowNumber),
      goodRate: numberCell(value(source, 'goodRate'), sourceRowNumber),
      averageCount: integerCell(value(source, 'averageCount'), sourceRowNumber),
      averageRate: numberCell(value(source, 'averageRate'), sourceRowNumber),
      workStudyTransferCount: integerCell(value(source, 'workStudyTransferCount'), sourceRowNumber),
      workStudyTransferRate: numberCell(value(source, 'workStudyTransferRate'), sourceRowNumber),
    });
  }

  if (rows.length === 0) throw new GraduationImportFileError('NO_DATA_ROWS');
  if (rows.length > maximumRows) throw new GraduationImportFileError('TOO_MANY_ROWS');
  return { sheetName: 'Sheet1', rows };
}
