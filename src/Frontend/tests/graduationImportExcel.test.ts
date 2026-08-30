import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GraduationImportFileError,
  parseGraduationSheet,
} from '../src/utils/graduationImportExcel.ts';
import {
  anonymousGraduationPeriodSheetFixture,
  anonymousLegacyGraduationSheetFixture,
  withInvalidReviewPeriod,
  withMultipleReviewPeriods,
} from './fixtures/graduationSheetFixture.ts';

test('fixture 16 cột khớp mốc workbook một đợt đã chốt', () => {
  const rows = anonymousGraduationPeriodSheetFixture.slice(6);
  const sourceColumnIndexes = [8, 10, 12, 14, 16];

  assert.equal(rows.length, 15);
  assert.deepEqual(new Set(rows.map((row) => row[7])), new Set(['T7 - 2026']));
  assert.deepEqual(
    sourceColumnIndexes.map((columnIndex) =>
      rows.reduce((total, row) => total + Number(row[columnIndex] ?? 0), 0)),
    [20, 98, 203, 89, 6],
  );
});

test('đọc đúng 16 cột, dòng nguồn và metadata một đợt', () => {
  const parsed = parseGraduationSheet(anonymousGraduationPeriodSheetFixture);

  assert.equal(parsed.sheetName, 'Sheet1');
  assert.deepEqual(parsed.reviewPeriod, { month: 7, year: 2026, label: 'T7 - 2026' });
  assert.equal(parsed.rows.length, 15);
  assert.deepEqual(parsed.rows.map((row) => row.sourceRowNumber),
    Array.from({ length: 15 }, (_, index) => index + 7));
  assert.equal(parsed.rows[0].facultyName, 'Khoa A');
  assert.equal(parsed.rows[14].workStudyTransferCount, 0);
});

test('cảnh báo ba khóa phân tích lặp nhưng vẫn giữ riêng từng dòng', () => {
  const parsed = parseGraduationSheet(anonymousGraduationPeriodSheetFixture);

  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.warnings[0].code, 'REPEATED_ANALYTICAL_KEY');
  assert.deepEqual(
    parsed.warnings[0].groups.map((group) => group.sourceRowNumbers),
    [[8, 10], [13, 15], [18, 20]],
  );
  assert.equal(parsed.rows.length, 15);
});

test('bỏ dòng chỉ có cached formula tỷ lệ', () => {
  const sheet = anonymousGraduationPeriodSheetFixture.map((row) => [...row]);
  const formulaOnlyRow = Array(18).fill(null);
  formulaOnlyRow[9] = 33.3;
  sheet.push(formulaOnlyRow);

  assert.equal(parseGraduationSheet(sheet).rows.length, 15);
});

test('giữ null khác zero và không làm sai decimal', () => {
  const sheet = anonymousGraduationPeriodSheetFixture.map((row) => [...row]);
  sheet[6][8] = 0;
  sheet[6][14] = null;
  sheet[6][15] = null;

  const { rows } = parseGraduationSheet(sheet);

  assert.equal(rows[0].excellentCount, 0);
  assert.equal(rows[0].excellentRate, 5.6);
  assert.equal(rows[0].averageCount, null);
  assert.equal(rows[0].averageRate, null);
});

test('chuẩn hóa cách viết T7/2026 vào cùng đợt', () => {
  const sheet = anonymousGraduationPeriodSheetFixture.map((row) => [...row]);
  sheet[6][7] = 'T7/2026';

  assert.equal(parseGraduationSheet(sheet).reviewPeriod.label, 'T7 - 2026');
});

test('từ chối rõ mẫu legacy 19 cột', () => {
  assert.throws(
    () => parseGraduationSheet(anonymousLegacyGraduationSheetFixture),
    (error) => error instanceof GraduationImportFileError
      && error.code === 'LEGACY_STRUCTURE_UNSUPPORTED',
  );
});

test('từ chối file có nhiều đợt và trả các đợt tìm thấy', () => {
  assert.throws(
    () => parseGraduationSheet(withMultipleReviewPeriods()),
    (error) => error instanceof GraduationImportFileError
      && error.code === 'MULTIPLE_REVIEW_PERIODS'
      && error.periods?.join('|') === 'T7 - 2026|T11 - 2026',
  );
});

test('từ chối thời điểm xét không thể tách tháng và năm', () => {
  assert.throws(
    () => parseGraduationSheet(withInvalidReviewPeriod()),
    (error) => error instanceof GraduationImportFileError
      && error.code === 'REVIEW_PERIOD_INVALID'
      && error.rowNumber === 7,
  );
});

test('từ chối khi dòng đánh số không đúng bộ 1–6, 10–19', () => {
  const sheet = anonymousGraduationPeriodSheetFixture.map((row) => [...row]);
  sheet[5][8] = 7;

  assert.throws(
    () => parseGraduationSheet(sheet),
    (error) => error instanceof GraduationImportFileError
      && error.code === 'SHEET_STRUCTURE_INVALID',
  );
});
