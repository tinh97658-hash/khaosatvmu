import type { CellValue } from 'read-excel-file/browser';
import type { GraduationImportRow } from '../types/graduationAnalytics';

const maximumFileSize = 5 * 1024 * 1024;
const maximumRows = 5_000;

export type GraduationImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'READ_FAILED'
  | 'SHEET_STRUCTURE_INVALID'
  | 'LEGACY_STRUCTURE_UNSUPPORTED'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'VALUE_TYPE_INVALID'
  | 'REVIEW_PERIOD_INVALID'
  | 'MULTIPLE_REVIEW_PERIODS';

export class GraduationImportFileError extends Error {
  public readonly code: GraduationImportFileErrorCode;
  public readonly rowNumber?: number;
  public readonly periods?: string[];

  constructor(
    code: GraduationImportFileErrorCode,
    options?: { rowNumber?: number; periods?: string[] },
  ) {
    super(code);
    this.code = code;
    this.rowNumber = options?.rowNumber;
    this.periods = options?.periods;
  }
}

export interface GraduationReviewPeriod {
  month: number;
  year: number;
  label: string;
}

export interface GraduationRepeatedKeyWarning {
  code: 'REPEATED_ANALYTICAL_KEY';
  groups: Array<{
    label: string;
    sourceRowNumbers: number[];
  }>;
}

export interface GraduationParsedFile {
  sheetName: string;
  reviewPeriod: GraduationReviewPeriod;
  rows: GraduationImportRow[];
  warnings: GraduationRepeatedKeyWarning[];
}

const combiningMarks = new RegExp('[\u0300-\u036f]', 'g');
const reviewPeriodPattern = /^(?:T(?:háng)?\s*)?(\d{1,2})\s*[-/]\s*(\d{4})$/i;
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
  if (!Number.isFinite(parsed)) {
    throw new GraduationImportFileError('VALUE_TYPE_INVALID', { rowNumber });
  }
  return parsed;
};

const integerCell = (value: CellValue | null | undefined, rowNumber: number) => {
  const parsed = numberCell(value, rowNumber);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new GraduationImportFileError('VALUE_TYPE_INVALID', { rowNumber });
  }
  return parsed;
};

type ImportField = keyof Omit<GraduationImportRow, 'sourceRowNumber'>;

const headerAliases: Record<ImportField, string[]> = {
  facultyName: ['ten khoa'],
  programCode: ['ma ctdt'],
  programName: ['ten ctdt'],
  cohort: ['khoa'],
  initialEnrollmentCount: ['so sv nhap hoc ban dau'],
  reviewPeriodText: ['thoi diem xet tot nghiep'],
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

const legacyHeaderAliases = [
  'so sv duoc xet tot nghiep',
  'so sv tot nghiep dung han',
  'ti le so sv tot nghiep dung han',
  'ty le so sv tot nghiep dung han',
];

const sourceColumnNumbers: Record<ImportField, number> = {
  facultyName: 1,
  programCode: 2,
  programName: 3,
  cohort: 4,
  initialEnrollmentCount: 5,
  reviewPeriodText: 6,
  excellentCount: 10,
  excellentRate: 11,
  veryGoodCount: 12,
  veryGoodRate: 13,
  goodCount: 14,
  goodRate: 15,
  averageCount: 16,
  averageRate: 17,
  workStudyTransferCount: 18,
  workStudyTransferRate: 19,
};

const parseReviewPeriod = (value: string, rowNumber: number): GraduationReviewPeriod => {
  const match = value.match(reviewPeriodPattern);
  const month = Number(match?.[1]);
  const year = Number(match?.[2]);
  if (!match || month < 1 || month > 12 || year < 1900 || year > 2200) {
    throw new GraduationImportFileError('REVIEW_PERIOD_INVALID', { rowNumber });
  }
  return { month, year, label: `T${month} - ${year}` };
};

export async function parseGraduationImportFile(file: File): Promise<GraduationParsedFile> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new GraduationImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) throw new GraduationImportFileError('FILE_SIZE');

  let sheet: readonly (readonly (CellValue | null)[])[];
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new GraduationImportFileError('READ_FAILED');
  }

  return parseGraduationSheet(sheet);
}

export function parseGraduationSheet(
  sheet: readonly (readonly (CellValue | null)[])[],
): GraduationParsedFile {
  const headerStart = sheet.findIndex((row) =>
    row.some((cell) => normalize(cellText(cell)) === 'ten khoa'));
  if (headerStart < 0 || headerStart + 2 >= sheet.length) {
    throw new GraduationImportFileError('SHEET_STRUCTURE_INVALID');
  }

  const headerRows = sheet.slice(headerStart, headerStart + 2);
  const maxColumns = Math.max(...headerRows.map((row) => row.length));
  const normalizedHeaders = Array.from({ length: maxColumns }, (_, index) =>
    headerRows.map((row) => normalize(cellText(row[index]))).filter(Boolean));
  if (normalizedHeaders.some((values) =>
    values.some((value) => legacyHeaderAliases.includes(value)))) {
    throw new GraduationImportFileError('LEGACY_STRUCTURE_UNSUPPORTED');
  }

  const indexOf = (aliases: string[]) => normalizedHeaders.findIndex((values) =>
    values.some((value) => aliases.includes(value)));
  const indexes = Object.fromEntries(
    Object.entries(headerAliases).map(([key, aliases]) => [key, indexOf(aliases)]),
  ) as Record<ImportField, number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new GraduationImportFileError('SHEET_STRUCTURE_INVALID');
  }

  const numberRow = sheet[headerStart + 2];
  const hasExpectedColumnNumbers = Object.entries(indexes).every(([key, index]) =>
    Number(cellText(numberRow[index])) === sourceColumnNumbers[key as ImportField]);
  if (!hasExpectedColumnNumbers) {
    throw new GraduationImportFileError('SHEET_STRUCTURE_INVALID');
  }

  const value = (row: readonly (CellValue | null)[], key: ImportField) => row[indexes[key]];
  const rows: GraduationImportRow[] = [];
  const periods = new Map<string, GraduationReviewPeriod>();
  for (let index = headerStart + 3; index < sheet.length; index += 1) {
    const source = sheet[index];
    const sourceRowNumber = index + 1;
    const primaryValues = [
      value(source, 'facultyName'), value(source, 'programCode'), value(source, 'programName'),
      value(source, 'cohort'), value(source, 'initialEnrollmentCount'), value(source, 'reviewPeriodText'),
      value(source, 'excellentCount'), value(source, 'veryGoodCount'), value(source, 'goodCount'),
      value(source, 'averageCount'), value(source, 'workStudyTransferCount'),
    ];
    if (primaryValues.every((cell) => cellText(cell) === '')) continue;

    const reviewPeriodText = cellText(value(source, 'reviewPeriodText'));
    const reviewPeriod = parseReviewPeriod(reviewPeriodText, sourceRowNumber);
    periods.set(`${reviewPeriod.year}-${reviewPeriod.month}`, reviewPeriod);
    rows.push({
      sourceRowNumber,
      facultyName: cellText(value(source, 'facultyName')),
      programCode: cellText(value(source, 'programCode')) || null,
      programName: cellText(value(source, 'programName')),
      cohort: cellText(value(source, 'cohort')),
      initialEnrollmentCount: integerCell(value(source, 'initialEnrollmentCount'), sourceRowNumber),
      reviewPeriodText,
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
  if (periods.size !== 1) {
    throw new GraduationImportFileError('MULTIPLE_REVIEW_PERIODS', {
      periods: [...periods.values()]
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((period) => period.label),
    });
  }

  const repeatedKeys = new Map<string, { label: string; sourceRowNumbers: number[] }>();
  rows.forEach((row) => {
    const program = row.programCode || row.programName;
    const key = JSON.stringify([normalize(row.facultyName), normalize(program), normalize(row.cohort)]);
    const existing = repeatedKeys.get(key) ?? {
      label: `${row.facultyName} · ${program} · ${row.cohort}`,
      sourceRowNumbers: [],
    };
    existing.sourceRowNumbers.push(row.sourceRowNumber);
    repeatedKeys.set(key, existing);
  });
  const repeatedGroups = [...repeatedKeys.values()].filter((group) => group.sourceRowNumbers.length > 1);
  const warnings: GraduationRepeatedKeyWarning[] = repeatedGroups.length > 0
    ? [{ code: 'REPEATED_ANALYTICAL_KEY', groups: repeatedGroups }]
    : [];

  return {
    sheetName: 'Sheet1',
    reviewPeriod: [...periods.values()][0],
    rows,
    warnings,
  };
}
