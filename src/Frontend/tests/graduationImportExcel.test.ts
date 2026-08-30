import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GraduationImportFileError,
  parseGraduationSheet,
} from '../src/utils/graduationImportExcel.ts';
import {
  anonymousGraduationPeriodSheetFixture,
  anonymousGraduationSheetFixture,
  withInvalidReviewPeriod,
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

test('đọc header hai tầng, bỏ dòng thứ tự và formula-only row', () => {
  const parsed = parseGraduationSheet(anonymousGraduationSheetFixture);

  assert.equal(parsed.sheetName, 'Sheet1');
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows.map((row) => row.sourceRowNumber), [7, 8]);
  assert.equal(parsed.rows[0].facultyName, 'Khoa Ẩn danh A');
  assert.equal(parsed.rows[1].programCode, null);
});

test('giữ null khác zero và không làm sai cached decimal', () => {
  const { rows } = parseGraduationSheet(anonymousGraduationSheetFixture);

  assert.equal(rows[0].initialEnrollmentCount, 0);
  assert.equal(rows[0].onTimeGraduateCount, 0);
  assert.equal(rows[0].onTimeGraduateRate, 0);
  assert.equal(rows[0].averageCount, null);
  assert.equal(rows[0].averageRate, null);
  assert.equal(rows[1].excellentRate, 2.5);
});

test('từ chối thời điểm xét không thể tách tháng và năm', () => {
  assert.throws(
    () => parseGraduationSheet(withInvalidReviewPeriod()),
    (error) => error instanceof GraduationImportFileError
      && error.code === 'REVIEW_PERIOD_INVALID'
      && error.rowNumber === 7,
  );
});
