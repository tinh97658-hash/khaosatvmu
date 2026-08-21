import type { CellValue } from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';
import { maximumQuestionsPerTemplate } from '../types';
import type { AnswerScale } from '../types';

const maximumFileSize = 5 * 1024 * 1024;

const questionTextHeaders = new Set([
  'noi dung cau hoi',
  'cau hoi',
  'noi dung',
  'questiontext',
  'question text',
  'question',
]);

// Cột mã thang trả lời nằm ngay cạnh cột nội dung câu hỏi.
const answerScaleCodeHeaders = new Set([
  'ma thang tra loi',
  'ma thang',
  'thang tra loi',
  'ma thang tra loi cua he thong',
  'answerscaleid',
  'answer scale id',
  'scale',
]);

// Cột mức bắt buộc của câu bẫy độ tập trung, để trống là câu hỏi bình thường.
const attentionCheckHeaders = new Set([
  'muc bat buoc',
  'cau bay',
  'muc bay',
  'muc dap an bat buoc',
  'attentioncheckvalue',
  'attention check',
]);

export interface ImportSurveyQuestionRow {
  rowNumber: number;
  questionText: string;
  /** Mã thang trả lời người dùng điền, đã đối chiếu với danh mục của hệ thống. */
  answerScaleId: number;
  answerScaleName: string;
  /** Mức bắt buộc của câu bẫy; null là câu hỏi bình thường. */
  attentionCheckValue: number | null;
}

export type SurveyTemplateImportFileErrorCode =
  | 'FILE_TYPE'
  | 'FILE_SIZE'
  | 'FILE_EMPTY'
  | 'QUESTION_HEADER_MISSING'
  | 'SCALE_HEADER_MISSING'
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

/** Dòng có mã thang trả lời sai, hiển thị để người dùng sửa lại tệp. */
export interface InvalidScaleCodeRow {
  rowNumber: number;
  questionText: string;
  rawCode: string;
}

/** Dòng đặt câu bẫy nhưng mức bắt buộc không dùng được với thang của câu đó. */
export interface InvalidAttentionCheckRow {
  rowNumber: number;
  questionText: string;
  rawValue: string;
  reason: 'TEXT_SCALE' | 'VALUE_NOT_IN_SCALE';
}

export interface SurveyTemplateImportResult {
  rows: ImportSurveyQuestionRow[];
  invalidScaleRows: InvalidScaleCodeRow[];
  invalidAttentionCheckRows: InvalidAttentionCheckRow[];
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

/**
 * Tạo và tải tệp Excel mẫu cho một bộ câu hỏi khảo sát.
 *
 * Bố cục: cột A/B/C là ba cột dùng để import, chừa trống cột D và E, cột F/G là
 * bảng tra thang trả lời. Bảng tra lấy thẳng từ danh mục thang của hệ thống nên
 * người soạn luôn thấy đúng mã đang có, không phải mã cố định trong mã nguồn.
 */
export async function downloadSurveyTemplateImportTemplate(
  answerScales: AnswerScale[]
): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  // Câu mẫu gợi ý mã thang đầu tiên đang có để người dùng thấy cách điền.
  const defaultScale = answerScales.find((scale) => scale.scaleKind === 'Options');
  const defaultScaleId = defaultScale?.answerScaleId ?? answerScales[0]?.answerScaleId ?? 1;
  // Mức mẫu cho câu bẫy phải là một mức có thật của chính thang đó.
  const trapValue = defaultScale?.options?.[Math.floor((defaultScale.options.length - 1) / 2)]?.value;

  const sampleRows: { questionText: string; answerScaleId: number; trap: number | null }[] = [
    {
      questionText: 'Giảng viên trình bày nội dung bài giảng rõ ràng, dễ hiểu.',
      answerScaleId: defaultScaleId,
      trap: null,
    },
    {
      questionText: 'Học liệu và tài liệu tham khảo của học phần đầy đủ, cập nhật.',
      answerScaleId: defaultScaleId,
      trap: null,
    },
    {
      questionText: trapValue
        ? `Câu kiểm tra độ tập trung: hãy chọn đáp án ${trapValue}.`
        : 'Cách kiểm tra, đánh giá của học phần phản ánh đúng năng lực người học.',
      answerScaleId: defaultScaleId,
      trap: trapValue ?? null,
    },
  ];

  const bold = { fontWeight: 'bold' as const };
  const header: SheetData[number] = [
    { value: 'Nội dung câu hỏi', type: String, ...bold },
    { value: 'Mã thang trả lời', type: String, ...bold },
    { value: 'Mức bắt buộc', type: String, ...bold },
    null,
    null,
    { value: 'Thang trả lời của hệ thống', type: String, ...bold },
    { value: 'Mã', type: String, ...bold },
  ];

  // Số câu mẫu và số thang thường lệch nhau nên bảng bên phải trải dài độc lập.
  const bodyRowCount = Math.max(sampleRows.length, answerScales.length);
  const body: SheetData = [];

  for (let index = 0; index < bodyRowCount; index += 1) {
    const question = sampleRows[index];
    const scale = answerScales[index];

    body.push([
      question ? { value: question.questionText, type: String } : null,
      question ? { value: question.answerScaleId, type: Number } : null,
      question?.trap ? { value: question.trap, type: Number } : null,
      null,
      null,
      scale ? { value: scale.answerScaleName, type: String } : null,
      scale ? { value: scale.answerScaleId, type: Number } : null,
    ]);
  }

  await writeXlsxFile([header, ...body], {
    sheet: 'Bo cau hoi',
    columns: [
      { width: 70 },
      { width: 18 },
      { width: 14 },
      { width: 4 },
      { width: 4 },
      { width: 30 },
      { width: 8 },
    ],
  }).toFile(surveyTemplateTemplateFileName);
}

/**
 * Đọc tệp .xlsx chứa danh sách câu hỏi kèm mã thang trả lời của từng câu.
 * Mã thang được đối chiếu với danh mục hệ thống truyền vào; dòng sai mã được
 * tách riêng để hiển thị cho người dùng thay vì làm hỏng cả lần import.
 */
export async function parseSurveyTemplateImportFile(
  file: File,
  answerScales: AnswerScale[]
): Promise<SurveyTemplateImportResult> {
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

  // Tránh bắt trúng cột "Thang trả lời của hệ thống" của bảng tra bên phải.
  const scaleIndex = headers.findIndex(
    (header, index) => index !== questionIndex && answerScaleCodeHeaders.has(header)
  );
  if (scaleIndex < 0) {
    throw new SurveyTemplateImportFileError('SCALE_HEADER_MISSING');
  }

  // Cột câu bẫy là tùy chọn: tệp cũ không có cột này vẫn đọc được như thường.
  const attentionIndex = headers.findIndex(
    (header, index) =>
      index !== questionIndex && index !== scaleIndex && attentionCheckHeaders.has(header)
  );

  const scaleById = new Map(answerScales.map((scale) => [scale.answerScaleId, scale]));

  const dataRows = sheet
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      questionText: cellText(row[questionIndex]),
      rawCode: cellText(row[scaleIndex]),
      rawAttention: attentionIndex < 0 ? '' : cellText(row[attentionIndex]),
    }))
    .filter((row) => row.questionText.length > 0);

  if (dataRows.length === 0) {
    throw new SurveyTemplateImportFileError('NO_DATA_ROWS');
  }
  if (dataRows.length > maximumQuestionsPerTemplate) {
    throw new SurveyTemplateImportFileError('TOO_MANY_ROWS');
  }

  const rows: ImportSurveyQuestionRow[] = [];
  const invalidScaleRows: InvalidScaleCodeRow[] = [];
  const invalidAttentionCheckRows: InvalidAttentionCheckRow[] = [];

  for (const row of dataRows) {
    const code = Number(row.rawCode);
    const scale = Number.isInteger(code) ? scaleById.get(code) : undefined;

    if (!scale) {
      invalidScaleRows.push({
        rowNumber: row.rowNumber,
        questionText: row.questionText,
        rawCode: row.rawCode,
      });
      continue;
    }

    // Kiểm cùng luật với backend để người dùng biết lỗi ngay tại chỗ xem trước,
    // khỏi gửi lên rồi mới bị trả về.
    let attentionCheckValue: number | null = null;
    if (row.rawAttention.length > 0) {
      if (scale.scaleKind !== 'Options') {
        invalidAttentionCheckRows.push({
          rowNumber: row.rowNumber,
          questionText: row.questionText,
          rawValue: row.rawAttention,
          reason: 'TEXT_SCALE',
        });
        continue;
      }

      const required = Number(row.rawAttention);
      if (!Number.isInteger(required) || !scale.options.some((o) => o.value === required)) {
        invalidAttentionCheckRows.push({
          rowNumber: row.rowNumber,
          questionText: row.questionText,
          rawValue: row.rawAttention,
          reason: 'VALUE_NOT_IN_SCALE',
        });
        continue;
      }
      attentionCheckValue = required;
    }

    rows.push({
      rowNumber: row.rowNumber,
      questionText: row.questionText,
      answerScaleId: scale.answerScaleId,
      answerScaleName: scale.answerScaleName,
      attentionCheckValue,
    });
  }

  return { rows, invalidScaleRows, invalidAttentionCheckRows };
}
