type FixtureCell = string | number | null;

const excelRow = (values: FixtureCell[]) => {
  const row: FixtureCell[] = Array(21).fill(null);
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

export const withInvalidReviewPeriod = () => {
  const sheet = anonymousGraduationSheetFixture.map((row) => [...row]);
  sheet[6][7] = 'Đợt không hợp lệ';
  return sheet;
};
