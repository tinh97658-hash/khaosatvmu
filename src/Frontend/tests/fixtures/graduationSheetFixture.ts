type FixtureCell = string | number | null;

const excelRow = (values: FixtureCell[]) => {
  const row: FixtureCell[] = Array(values.length + 2).fill(null);
  values.forEach((value, index) => { row[index + 2] = value; });
  return row;
};

const primaryHeaders = excelRow([
  'Tên Khoa', 'Mã CTĐT', 'Tên CTĐT', 'Khóa', 'Số SV nhập học ban đầu',
  'Thời điểm xét Tốt nghiệp', 'Thông số xác định trong thời điểm xét tốt nghiệp',
]);
const metricHeaders = excelRow([
  null, null, null, null, null, null,
  'Số SV được xét tốt nghiệp',
  'Số SV tốt nghiệp đúng hạn',
  'Tỉ lệ số SV tốt nghiệp đúng hạn',
  'Số SV tốt nghiệp XS',
  'Tỉ lệ SV tốt nghiệp XS',
  'Số SV tốt nghiệp Giỏi',
  'Tỉ lệ SV tốt nghiệp Giỏi',
  'Số SV tốt nghiệp Khá',
  'Tỉ lệ SV tốt nghiệp Khá',
  'Số SV tốt nghiệp T.Bình',
  'Tỉ lệ SV tốt nghiệp T.Bình',
  'Số SV chuyển VHVL',
  'Tỉ lệ SV chuyển VHVL',
]);

export const anonymousGraduationSheetFixture: FixtureCell[][] = [
  [], [], [],
  primaryHeaders,
  metricHeaders,
  excelRow(Array.from({ length: 19 }, (_, index) => index + 1)),
  excelRow([
    'Khoa Ẩn danh A', 'CT01', 'Ngành Ẩn danh 1', 'K20', 0, 'T7 - 2026',
    10, 0, 0, 2, 20, 3, 30, 4, 40, null, null, 1, 10,
  ]),
  excelRow([
    'Khoa Ẩn danh B', null, 'Ngành Ẩn danh 2', 'K21', 100, 'T11 - 2027',
    50, 25, 50, 1, 2.5, 5, 10, 15, 30, 4, 8, 0, 0,
  ]),
  // Mô phỏng dòng cuối chỉ còn cached formula tỷ lệ, không phải dòng dữ liệu.
  excelRow([null, null, null, null, null, null, null, null, 33.3]),
];

const periodPrimaryHeaders = excelRow([
  'Tên Khoa', 'Mã CTĐT', 'Tên CTĐT', 'Khóa', 'Số SV nhập học ban đầu',
  'Thời điểm xét Tốt nghiệp', 'Thông số xác định trong thời điểm xét tốt nghiệp',
]);
const periodMetricHeaders = excelRow([
  null, null, null, null, null, null,
  'Số SV tốt nghiệp XS',
  'Tỉ lệ SV tốt nghiệp XS',
  'Số SV tốt nghiệp Giỏi',
  'Tỉ lệ SV tốt nghiệp Giỏi',
  'Số SV tốt nghiệp Khá',
  'Tỉ lệ SV tốt nghiệp Khá',
  'Số SV tốt nghiệp T.Bình',
  'Tỉ lệ SV tốt nghiệp T.Bình',
  'Số SV chuyển VHVL',
  'Tỉ lệ SV chuyển VHVL',
]);

/**
 * Fixture ẩn danh bám theo workbook chuẩn 16 cột C-R ngày 30/08/2026.
 * Giữ nguyên cơ cấu dòng, khóa, số lượng và tỉ lệ để làm mốc hồi quy; chỉ ẩn danh
 * tên khoa/chương trình và mã CTĐT.
 */
export const anonymousGraduationPeriodSheetFixture: FixtureCell[][] = [
  [], [], [],
  periodPrimaryHeaders,
  periodMetricHeaders,
  excelRow([1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
  excelRow(['Khoa A', 'CT01', 'Chương trình 1', 'K61', 119, 'T7 - 2026', 2, 5.6, 9, 25, 18, 50, 7, 19.4, 0, 0]),
  excelRow(['Khoa A', 'CT01', 'Chương trình 1', 'K62', 123, 'T7 - 2026', 2, 4.4, 11, 24.4, 22, 48.9, 10, 22.2, 0, 0]),
  excelRow(['Khoa A', 'CT01', 'Chương trình 1', 'K60', 116, 'T7 - 2026', 0, 0, 0, 0, 0, 0, 0, 0, 2, 100]),
  excelRow(['Khoa A', 'CT01', 'Chương trình 1', 'K62', 123, 'T7 - 2026', 2, 4.3, 11, 23.9, 23, 50, 10, 21.7, 0, 0]),
  excelRow(['Khoa A', 'CT01', 'Chương trình 1', 'K63', 121, 'T7 - 2026', 1, 2.7, 9, 24.3, 18, 48.6, 9, 24.3, 0, 0]),
  excelRow(['Khoa B', 'CT02', 'Chương trình 2', 'K61', 106, 'T7 - 2026', 1, 5.3, 5, 26.3, 9, 47.4, 4, 21.1, 0, 0]),
  excelRow(['Khoa B', 'CT02', 'Chương trình 2', 'K62', 110, 'T7 - 2026', 2, 4.9, 10, 24.4, 21, 51.2, 8, 19.5, 0, 0]),
  excelRow(['Khoa B', 'CT02', 'Chương trình 2', 'K60', 103, 'T7 - 2026', 0, 0, 0, 0, 0, 0, 0, 0, 2, 100]),
  excelRow(['Khoa B', 'CT02', 'Chương trình 2', 'K62', 110, 'T7 - 2026', 2, 4.9, 10, 24.4, 20, 48.8, 9, 22, 0, 0]),
  excelRow(['Khoa B', 'CT02', 'Chương trình 2', 'K63', 108, 'T7 - 2026', 2, 6.1, 8, 24.2, 16, 48.5, 7, 21.2, 0, 0]),
  excelRow(['Khoa C', 'CT03', 'Chương trình 3', 'K61', 87, 'T7 - 2026', 1, 6.2, 4, 25, 8, 50, 3, 18.8, 0, 0]),
  excelRow(['Khoa C', 'CT03', 'Chương trình 3', 'K62', 91, 'T7 - 2026', 1, 2.9, 7, 20.6, 17, 50, 9, 26.5, 0, 0]),
  excelRow(['Khoa C', 'CT03', 'Chương trình 3', 'K60', 84, 'T7 - 2026', 0, 0, 0, 0, 0, 0, 0, 0, 2, 100]),
  excelRow(['Khoa C', 'CT03', 'Chương trình 3', 'K62', 91, 'T7 - 2026', 2, 5.9, 7, 20.6, 17, 50, 8, 23.5, 0, 0]),
  excelRow(['Khoa C', 'CT03', 'Chương trình 3', 'K63', 89, 'T7 - 2026', 2, 7.1, 7, 25, 14, 50, 5, 17.9, 0, 0]),
];

export const withInvalidReviewPeriod = () => {
  const sheet = anonymousGraduationSheetFixture.map((row) => [...row]);
  sheet[6][7] = 'Đợt không hợp lệ';
  return sheet;
};
