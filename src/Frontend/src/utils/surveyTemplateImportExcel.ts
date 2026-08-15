import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';
import { maximumQuestionsPerTemplate } from '../types';

const maximumFileSize = 5 * 1024 * 1024;

// Chỉ đọc cột nội dung câu hỏi vì bảng "SurveyQuestions" chỉ có "QuestionText".
const questionTextHeaders = new Set([
  'noi dung cau hoi',
  'cau hoi',
  'noi dung',
  'questiontext',
  'question text',
  'question',
]);

export interface ImportSurveyQuestionRow {
  rowNumber: number;
  questionText: string;
}

export type SurveyTemplateImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'QUESTION_HEADER_MISSING'
  | 'NO_DATA_ROWS'
  | 'TOO_MANY_ROWS'
  | 'READ_FAILED';

export class SurveyTemplateImportFileError extends Error {
  public readonly code: SurveyTemplateImportFileErrorCode;

  constructor(code: SurveyTemplateImportFileErrorCode) {
    super(code);
    this.code = code;
  }
}

// Dấu thanh tiếng Việt sau khi normalize('NFD') nằm trong dải U+0300..U+036F.
const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellText(value: CellValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export const surveyTemplateTemplateFileName = 'mau-import-bo-cau-hoi.xlsx';

/** Tạo và tải tệp Excel mẫu cho một bộ câu hỏi khảo sát. */
export async function downloadSurveyTemplateImportTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const rows = [
    ['Giảng viên trình bày nội dung bài giảng rõ ràng, dễ hiểu.'],
    ['Học liệu và tài liệu tham khảo của học phần đầy đủ, cập nhật.'],
    ['Cách kiểm tra, đánh giá của học phần phản ánh đúng năng lực người học.'],
  ];

  const data: SheetData = [
    [{ value: 'Nội dung câu hỏi', type: String, fontWeight: 'bold' as const }],
    ...rows.map((row) => row.map((value) => ({ value, type: String }))),
  ];

  await writeXlsxFile(data, {
    sheet: 'Bo cau hoi',
    columns: [{ width: 70 }],
  }).toFile(surveyTemplateTemplateFileName);
}

/** Đọc tệp .xlsx chứa danh sách câu hỏi của một bộ câu hỏi khảo sát. */
export async function parseSurveyTemplateImportFile(
  file: File
): Promise<ImportSurveyQuestionRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new SurveyTemplateImportFileError('FILE_TYPE');
  }
  if (file.size > maximumFileSize) {
    throw new SurveyTemplateImportFileError('FILE_SIZE');
  }

  let sheet;
  try {
    const { readSheet } = await import('read-excel-file/browser');
    sheet = await readSheet(file);
  } catch {
    throw new SurveyTemplateImportFileError('READ_FAILED');
  }

  if (sheet.length === 0) {
    throw new SurveyTemplateImportFileError('FILE_EMPTY');
  }

  const headers = sheet[0].map((value) => normalizeHeader(cellText(value)));
  const questionIndex = headers.findIndex((header) => questionTextHeaders.has(header));
  if (questionIndex < 0) {
    throw new SurveyTemplateImportFileError('QUESTION_HEADER_MISSING');
  }

  const rows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      questionText: cellText(row[questionIndex]),
    }))
    .filter((row) => row.questionText.length > 0);

  if (rows.length === 0) {
    throw new SurveyTemplateImportFileError('NO_DATA_ROWS');
  }
  if (rows.length > maximumQuestionsPerTemplate) {
    throw new SurveyTemplateImportFileError('TOO_MANY_ROWS');
  }

  return rows;
}
