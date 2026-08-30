# Kế hoạch nâng cấp — Thống kê kết quả tốt nghiệp theo đợt

Trạng thái: **đã khảo sát code và hai workbook; chưa triển khai**

Tài liệu này thay thế phần nghiệp vụ của phiên bản 19 cột trong
`thong-ke-sinh-vien-tot-nghiep-dung-han.md`. Các nguyên tắc tách bounded context,
phân quyền, không nối mơ hồ với danh mục chính và không gửi dữ liệu ra dịch vụ
biểu đồ bên ngoài vẫn giữ nguyên.

Nguồn đã đối chiếu ngày 30/08/2026:

- mẫu cũ: `C:\Users\hieuu\Downloads\BMSVTN_final_old.xlsx`;
- mẫu mới: `C:\Users\hieuu\Downloads\BMSVTN_final_new.xlsx`;
- parser, API, service, database và UI `GraduationAnalytics` đang có trong repo.

Hai workbook chỉ là tài liệu phát triển, không được đóng gói hoặc tự động đọc trên
production.

## 1. Kết luận khảo sát hiện trạng

### 1.1. So sánh hai biểu mẫu

| Nội dung | Mẫu cũ | Mẫu mới |
|---|---:|---:|
| Sheet | `Sheet1` | `Sheet1` |
| Header | dòng 4–5 | dòng 4–5 |
| Dòng đánh số cột | dòng 6 | dòng 6 |
| Dữ liệu bắt đầu | dòng 7 | dòng 7 |
| Vùng dữ liệu logic | C–U | C–R |
| Số cột logic | 19 | 16 |
| Số thứ tự cột | 1–19 | 1–6, 10–19 |
| Số dòng dữ liệu trong mẫu | 240 | 15 |

Mẫu mới đã bỏ đúng ba cột:

1. cột 7 — Số SV được xét tốt nghiệp;
2. cột 8 — Số SV tốt nghiệp đúng hạn;
3. cột 9 — Tỉ lệ số SV tốt nghiệp đúng hạn.

Mười sáu cột còn lại:

| Số cột nguồn | Trường | Vai trò mới |
|---:|---|---|
| 1 | Tên Khoa | chiều phân tích |
| 2 | Mã CTĐT | định danh CTĐT nguồn |
| 3 | Tên CTĐT | chiều phân tích |
| 4 | Khóa | chiều phân tích chính |
| 5 | Số SV nhập học ban đầu | dữ liệu nguồn tham chiếu, không cộng lặp qua các đợt |
| 6 | Thời điểm xét Tốt nghiệp | định danh đợt của cả file |
| 10–11 | Số lượng/tỉ lệ Xuất sắc | nhóm kết quả |
| 12–13 | Số lượng/tỉ lệ Giỏi | nhóm kết quả |
| 14–15 | Số lượng/tỉ lệ Khá | nhóm kết quả |
| 16–17 | Số lượng/tỉ lệ Trung bình | nhóm kết quả |
| 18–19 | Số lượng/tỉ lệ chuyển VHVL | nhóm kết quả |

### 1.2. Mẫu mới đã đạt quy tắc một file — một đợt

Lần đối chiếu sau khi cập nhật cho kết quả:

- đủ 15 dòng dữ liệu;
- 15/15 dòng đều có thời điểm `T7 - 2026`;
- đúng 16 cột được đánh số `1–6, 10–19`;
- tổng năm nhóm kết quả là **416** sinh viên.

Các tổng dùng làm mốc kiểm thử parser/import:

| Nhóm | Tổng |
|---|---:|
| Xuất sắc | 20 |
| Giỏi | 98 |
| Khá | 203 |
| Trung bình | 89 |
| Chuyển VHVL | 6 |
| **Tổng năm nhóm** | **416** |

File vẫn có ba khóa phân tích xuất hiện nhiều hơn một dòng: `CK + CK-01 + K62`
ở dòng nguồn 8 và 10, `CNTT + CNTT-02 + K62` ở dòng 13 và 15, và
`ISE + ISE-03 + K62` ở dòng 18 và 20. Đây không được xem là lỗi cấu trúc vì
file nguồn có thể cung cấp nhiều dòng đóng góp cho cùng tổ hợp
`Khoa + CTĐT + Khóa` mà không có thêm chiều định danh.

Quy tắc được chốt cho hệ thống:

- `SourceSheetName + SourceRowNumber` mới là định danh duy nhất của row nguồn;
- các row cùng khoa + CTĐT + khóa được cộng khi phân tích;
- preview hiển thị cảnh báo không chặn, nêu số nhóm bị lặp và giải thích rằng các
  dòng sẽ được tổng hợp;
- tab Bảng vẫn hiển thị từng dòng riêng để truy vết, không tự gộp dữ liệu nguồn.

### 1.3. Những phần code hiện tại chắc chắn phải đổi

- Parser đang bắt buộc đủ 19 header nên sẽ từ chối mẫu 16 cột.
- `DatasetName` đang là ô nhập tự do; đợt lại nằm lặp trên từng row.
- Dashboard chỉ truy vấn một dataset được chọn, chưa có phạm vi tích lũy tự động.
- KPI và toàn bộ `GraduationOverview` phụ thuộc `eligible`, `onTimeCount`,
  `onTimeRate`, nên không còn dữ liệu để hoạt động.
- Metadata vẫn cho phép `reviewYear`, `reviewPeriod`, `dataset` làm group/series.
- Bảng nguồn C–U đang nằm cố định bên dưới cả Tổng quan và Khám phá, chưa phải tab.
- Query engine tải toàn bộ row về bộ nhớ rồi mới gom nhóm; không phù hợp khi chế độ
  tích lũy đọc toàn bộ các đợt trong nhiều năm.

## 2. Mô hình nghiệp vụ mới

### 2.1. Một file là một đợt

- Mọi dòng dữ liệu trong file phải có cùng tháng và năm xét tốt nghiệp.
- Backend là nơi xác nhận cuối cùng quy tắc này; frontend chỉ preview sớm.
- Đợt được chuẩn hóa thành `ReviewMonth`, `ReviewYear` và nhãn hiển thị
  `T{tháng} - {năm}`.
- Không cho người dùng nhập tên bộ dữ liệu tùy ý.
- Tên hiển thị được sinh tự động, ví dụ `Đợt T7 - 2026`.
- Danh sách đợt sắp xếp theo năm/tháng xét giảm dần, không theo thời điểm upload.
- Một tháng/năm chỉ có một bản dữ liệu đang hoạt động để tránh cộng hai lần cùng
  một đợt.

Tên “bộ dữ liệu” được bỏ khỏi giao diện và contract mới; bảng vật lý
`GraduationAnalyticsDatasets` có thể giữ tên để migration ít rủi ro, nhưng entity
được hiểu là **lần import của một đợt**.

### 2.2. Hai phạm vi phân tích

`AnalysisScope` chỉ có hai giá trị:

- `cumulative`: tích lũy tất cả các đợt đang có;
- `period`: chỉ một đợt do người dùng chọn.

Frontend không còn tự gửi một mảng dataset tùy ý. Backend tự giải phạm vi thành
các `DatasetId`, nhờ vậy không có trường hợp chọn nhầm hai snapshot trùng nhau.

### 2.3. Quy tắc cộng dồn

Năm nhóm kết quả được coi là các bucket loại trừ nhau:

```text
Tổng kết quả = Xuất sắc + Giỏi + Khá + Trung bình + Chuyển VHVL
```

Quy tắc tổng hợp:

- số lượng tích lũy = tổng số lượng của các đợt trong phạm vi;
- tỉ lệ tích lũy của một nhóm = `tổng số lượng nhóm / tổng năm nhóm × 100`;
- không cộng hoặc lấy trung bình cộng các cột tỉ lệ Excel;
- tỉ lệ nguồn vẫn được lưu và hiển thị trong tab Bảng để truy vết;
- một row chỉ tham gia tỉ lệ tổng hợp khi đủ cả năm cột số lượng; row thiếu dữ
  liệu vẫn hiện trong bảng và được phản ánh qua `includedRows/totalRows`;
- `null` không được đổi thành `0`.

`InitialEnrollmentCount` bị lặp lại giữa các đợt của cùng CTĐT/khóa nên không
được cộng dồn. Trường này chỉ dùng làm dữ liệu nguồn tham chiếu trong tab Bảng;
không còn là metric mặc định của dashboard.

## 3. Thiết kế dữ liệu và migration

### 3.1. Dataset/đợt

Bổ sung vào `GraduationAnalyticsDatasets`:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `ReviewPeriodText` | `varchar(100)` | nhãn chuẩn hóa của đợt |
| `ReviewMonth` | `int` | 1–12 |
| `ReviewYear` | `int` | 1900–2200 |

Điều chỉnh:

- `DatasetName` do server sinh từ đợt, không nhận từ request;
- thêm index `(ReviewYear DESC, ReviewMonth DESC)`;
- thêm unique `(ReviewYear, ReviewMonth)` sau khi xử lý dữ liệu cũ;
- giữ `OriginalFileName`, hash, người import, thời gian import và row count;
- `MinimumReviewDate`/`MaximumReviewDate` trở thành dư thừa; giữ tạm một migration
  để tương thích rồi loại bỏ ở migration cleanup sau khi rollout ổn định.

### 3.2. Row

Contract và code mới bỏ ba trường:

- `EligibleGraduateCount`;
- `OnTimeGraduateCount`;
- `OnTimeGraduateRate`.

Ba cột database cũ được giữ nullable trong migration đầu để không làm mất dữ liệu
legacy và giúp rollback. Code import/query/UI mới không đọc hoặc ghi chúng. Chỉ
drop vật lý ở migration cleanup riêng sau khi production đã được xác nhận.

`ReviewPeriodText/Month/Year` trên row cũng được coi là dữ liệu legacy/audit;
nguồn chuẩn để lọc và sắp xếp là dataset/đợt. Import mới vẫn có thể giữ
`ReviewPeriodText` nguyên bản để đối chiếu dòng nguồn, nhưng không dùng nó làm
dimension chart.

### 3.3. Chuyển dữ liệu 19 cột đang có

Migration phải chạy theo hai pha, không được chỉ thêm unique index:

1. thêm các trường đợt nullable trên dataset;
2. audit mỗi dataset cũ có bao nhiêu cặp tháng/năm;
3. dataset chỉ có một đợt: cập nhật metadata tại chỗ;
4. dataset chứa nhiều đợt: tách thành một dataset mới cho mỗi cặp tháng/năm và
   chuyển các row tương ứng;
5. tính lại `RowCount`, nhãn đợt và content hash theo payload 16 cột;
6. nếu nhiều dataset cũ tạo ra cùng một đợt, dừng preflight và yêu cầu chọn bản
   đúng; không tự gộp vì có nguy cơ double count;
7. sau khi không còn trùng mới đặt `NOT NULL` và unique period;
8. migration chỉ chạm hai bảng của module GraduationAnalytics.

Trước deploy phải có script read-only báo cáo:

- dataset nhiều đợt;
- đợt trùng giữa các dataset;
- row lặp `Khoa + CTĐT + Khóa` trong cùng đợt để đối chiếu (không phải lỗi chặn);
- row thiếu một trong năm cột số lượng.

### 3.4. Import lại cùng đợt

MVP không được âm thầm chèn thêm một dataset cùng tháng/năm. API trả
`GRADUATION_PERIOD_EXISTS` và UI thông báo rõ đợt nào đã tồn tại.

Nếu cần sửa file của một đợt, triển khai thao tác **Thay thế đợt** riêng:

- bắt buộc preview và xác nhận;
- thay dataset + rows trong một transaction;
- lưu audit người thay, file cũ/file mới và thời gian;
- không biến POST import thông thường thành upsert ngầm.

## 4. Import và preview 16 cột

### 4.1. Parser

- Nhận đúng bộ header số 1–6 và 10–19, không dựa vào vị trí cứng.
- Từ chối mẫu 19 cột bằng lỗi rõ `LEGACY_STRUCTURE_UNSUPPORTED` thay vì map lệch.
- Trích tháng/năm từ toàn bộ row và yêu cầu đúng một cặp duy nhất.
- Chuẩn hóa các cách viết hợp lệ như `T7 - 2026`, `T7/2026`, nhưng hiển thị một
  định dạng thống nhất.
- Phát hiện các khóa `Faculty + ProgramCode/ProgramName + Cohort` lặp trong file
  và trả warning metadata; không chặn import và không gộp row nguồn.
- Giữ nguyên null, zero và decimal của các ô nguồn.
- Hash nội dung dùng 16 giá trị nguồn đã chuẩn hóa và đợt, không dùng tên file.

Lỗi mới cần có:

| Mã | Điều kiện |
|---|---|
| `MULTIPLE_REVIEW_PERIODS` | file có hơn một tháng/năm xét |
| `LEGACY_STRUCTURE_UNSUPPORTED` | file còn bộ cột 7–9 cũ |
| `GRADUATION_PERIOD_EXISTS` | database đã có đợt đó |

Warning không chặn:

| Mã | Điều kiện |
|---|---|
| `REPEATED_ANALYTICAL_KEY` | nhiều row cùng khoa + CTĐT + khóa; chart sẽ cộng các row |

### 4.2. Modal import

- Đổi nhãn thành `Import đợt tốt nghiệp`.
- Bỏ input `Tên bộ dữ liệu`.
- Sau khi đọc file, hiển thị nổi bật đợt phát hiện được, số row và sheet.
- Preview đúng 16 cột C–R; nhóm chỉ tiêu còn 10 cột.
- Nút chính là `Import đợt T7 - 2026`.
- Thành công mở tab Bảng tại đúng đợt vừa import.

## 5. Cấu trúc giao diện ba tab

Switch mới:

```text
Tổng quan | Khám phá chi tiết | Bảng
```

URL state:

- `gaView=overview|explore|table`;
- `gaScope=cumulative|period`;
- `gaPeriod={id}` chỉ có ý nghĩa khi scope là `period` hoặc đang ở tab Bảng;
- giữ filter khoa, CTĐT, khóa và cấu hình chart hợp lệ.

Không còn dataset picker chung phía trên toàn trang. Bộ lọc và period picker nằm
đúng tab có nhu cầu, tránh làm người dùng hiểu Tổng quan chỉ đang xem một file.

## 6. Làm lại tab Tổng quan

Tổng quan luôn dùng dữ liệu tích lũy của tất cả các đợt; không có lựa chọn đợt và
không có metric “đúng hạn”. Bộ lọc còn lại: Khoa, CTĐT, Khóa và khoảng năm nếu
cần thu hẹp báo cáo.

### 6.1. KPI

- Tổng số kết quả tốt nghiệp đã ghi nhận (tổng năm nhóm).
- Số đợt đã import.
- Số khóa có dữ liệu.
- Số CTĐT/khoa trong phạm vi hiện tại.
- Năm nhóm Xuất sắc, Giỏi, Khá, Trung bình, VHVL hiển thị cả số lượng và tỉ trọng
  tính từ số lượng.

### 6.2. Biểu đồ mặc định

1. **Cơ cấu tích lũy toàn trường** — donut hoặc thanh 100% cho năm nhóm.
2. **Kết quả theo khóa** — cột chồng số lượng, trục X là khóa, stack là năm nhóm.
3. **Tỉ trọng theo khóa** — cột chồng 100%, giúp so sánh cơ cấu giữa các khóa có
   quy mô khác nhau.
4. **Quy mô các khóa qua các năm** — trục X là năm xét, series là khóa, giá trị là
   tổng năm nhóm; mặc định chỉ hiện các khóa có dữ liệu và cho bật/tắt legend.
5. **Bảng ma trận khóa × năm** — tổng số kết quả và cơ cấu rút gọn, là fallback
   dễ đọc khi số series quá nhiều trên mobile.

Các chart theo khoa/CTĐT không bị loại bỏ hoàn toàn: filter khoa/CTĐT thay đổi
phạm vi của toàn bộ Tổng quan. Mục tiêu chính của layout là nhìn được kết quả theo
khóa xuyên nhiều năm, không quay lại so sánh theo từng đợt.

Backend nên có endpoint overview chuyên dụng trả toàn bộ KPI/chart model trong
một response nhất quán, thay vì frontend gọi nhiều request metric rời như hiện tại.

## 7. Sửa tab Khám phá chi tiết

Thêm box đầu tiên `Dữ liệu phân tích`:

- `Tích lũy tất cả các đợt`;
- `Theo một đợt` và period picker đi kèm.

Các box `So sánh theo` và `Phân chuỗi` chỉ còn:

- Khoa;
- Chương trình đào tạo;
- Khóa.

Loại bỏ khỏi hai box:

- năm xét;
- thời điểm xét;
- dataset/bộ dữ liệu.

Catalog metric mới:

- Tổng số kết quả;
- số lượng và tỉ lệ Xuất sắc;
- số lượng và tỉ lệ Giỏi;
- số lượng và tỉ lệ Khá;
- số lượng và tỉ lệ Trung bình;
- số lượng và tỉ lệ chuyển VHVL.

Tỉ lệ trên chart luôn là ratio-of-sums từ năm cột số lượng. Tooltip/footer phải
ghi `Tính từ số lượng trong phạm vi`, không gọi đây là giá trị tỉ lệ nguyên bản
của Excel. Các tỉ lệ nguồn chỉ xem tại tab Bảng.

Quy tắc chart hiện có về cùng dimension, pie tối đa 12 nhóm, stacked cần series,
sort/top N, nhãn và bảng dữ liệu tương ứng vẫn được giữ.

## 8. Tab Bảng

Tab Bảng thay thế bảng nguồn đang gắn dưới mọi màn hình.

- Period picker bắt buộc, mặc định đợt mới nhất.
- Header hiển thị đợt, file nguồn, người import, thời gian import và số row.
- Bảng phân trang/search/filter theo khoa, CTĐT, khóa.
- Hiển thị đúng 16 cột nguồn; ba cột 7–9 không còn xuất hiện.
- Thời điểm xét có thể giữ trong bảng để đối chiếu, dù giá trị giống nhau trên mọi
  row; trên mobile ưu tiên hiển thị nó trong phần metadata thay vì lặp cột.
- Null hiển thị `—`, zero hiển thị `0`, tỉ lệ nguồn có `%`.
- Sau import điều hướng thẳng tới `gaView=table&gaPeriod={id}`.

## 9. API và contract đề xuất

```text
GET  /api/v1/graduation-analytics/periods
POST /api/v1/graduation-analytics/periods
GET  /api/v1/graduation-analytics/periods/{periodId}/rows
GET  /api/v1/graduation-analytics/facets?scope=cumulative|period&periodId=...
POST /api/v1/graduation-analytics/overview
POST /api/v1/graduation-analytics/query
```

`POST /periods` không nhận `datasetName`; request gồm file, sheet và 16 giá trị
nguồn mỗi row. Response trả `periodId`, nhãn/tháng/năm, metadata import và row
count.

`POST /query`:

```text
scope: cumulative | period
periodId?: long
metricId
groupBy: faculty | program | cohort
seriesBy?: faculty | program | cohort
faculty?: string
program?: string
cohort?: string
```

Backend không nhận tên cột hoặc biểu thức động. Route `/datasets` cũ có thể giữ
tạm một release để trả deprecation response hoặc được đổi đồng bộ frontend/backend
trong cùng lần deploy vì đây là module nội bộ.

## 10. Tối ưu truy vấn

- Không `ToListAsync()` toàn bộ row rồi mới group khi scope tích lũy.
- Count aggregation và grouping thực hiện bằng LINQ dịch xuống PostgreSQL.
- Tỉ lệ ratio-of-sums được tính từ các tổng count trong cùng query/snapshot.
- Overview trả một DTO tổng hợp để giảm số round-trip.
- Facet cumulative đọc distinct trên tất cả period; facet period giới hạn theo ID.
- Giữ index dataset + faculty/program; bổ sung dataset + cohort và index period ở
  bảng cha.
- Có giới hạn số group/series trả về và thông báo khi biểu đồ quá dày.

## 11. Trình tự triển khai

### Giai đoạn 0 — Chốt dữ liệu mẫu

- [x] Workbook mới chỉ còn một đợt `T7 - 2026`.
- [x] Chốt row lặp khoa + CTĐT + khóa là dữ liệu nguồn hợp lệ, được cảnh báo và
  cộng khi phân tích.
- [x] Chốt tổng đối chiếu: `20/98/203/89/6`, tổng 416.
- [x] Tạo fixture ẩn danh 16 cột từ workbook đã sửa tại
  `src/Frontend/tests/fixtures/graduationSheetFixture.ts`.

### Giai đoạn 1 — Migration và domain

- [ ] Viết preflight audit dữ liệu legacy.
- [ ] Thêm metadata đợt ở dataset và migration tách dataset nhiều đợt.
- [ ] Thêm unique period sau khi dữ liệu sạch.
- [ ] Đổi DTO/command từ dataset tùy ý sang period.
- [ ] Bỏ ba metric 7–9 khỏi contract và metadata.

### Giai đoạn 2 — Parser/import

- [ ] Parser header 16 cột và single-period validation.
- [ ] Warning cho analytical key lặp, không làm mất hoặc gộp row nguồn.
- [ ] Backend validate lại toàn bộ rule, hash mới và transaction.
- [ ] Làm lại modal preview/import theo đợt.

### Giai đoạn 3 — Query engine

- [ ] Thêm `cumulative|period` scope.
- [ ] Giới hạn dimension còn faculty/program/cohort.
- [ ] Thêm total outcome và ratio-of-sums cho 5 nhóm.
- [ ] Chuyển aggregation chính xuống database.
- [ ] Thêm endpoint overview và facets theo scope.

### Giai đoạn 4 — Ba tab UI

- [ ] Bỏ dataset picker chung, thêm switch ba tab.
- [ ] Làm lại toàn bộ Tổng quan theo khóa/năm và 5 nhóm kết quả.
- [ ] Thêm box dữ liệu phân tích vào Khám phá chi tiết.
- [ ] Chuyển bảng nguồn thành tab Bảng với period picker.
- [ ] Đồng bộ URL, loading/empty/error/no-result và responsive.

### Giai đoạn 5 — Kiểm thử và rollout

- [ ] Unit test parser 16 cột, file cũ, nhiều đợt, duplicate key, null/zero.
- [ ] Service test cumulative/per-period, ratio-of-sums và coverage.
- [ ] Integration test migration dữ liệu 19 cột nhiều đợt.
- [ ] Endpoint authorization và validation tests.
- [ ] Build/lint/test backend + frontend.
- [ ] Visual QA desktop/mobile cho cả ba tab.
- [ ] Chạy preflight trên bản sao production trước khi deploy migration.

## 12. Tiêu chí nghiệm thu

1. File mẫu 16 cột với 15 dòng của đợt `T7 - 2026` được preview và import đúng.
2. File có nhiều đợt bị chặn và chỉ rõ các đợt tìm thấy.
3. File 19 cột cũ không bị đọc lệch; hệ thống báo đúng định dạng legacy.
4. Tên đợt được sinh tự động, không còn ô tên bộ dữ liệu tự do.
5. Không thể tồn tại hai bản đang hoạt động cho cùng tháng/năm xét.
6. Tổng quan mặc định cộng tất cả đợt và không còn số liệu đúng hạn/được xét.
7. Năm nhóm kết quả hiển thị đủ số lượng, tỉ trọng và coverage.
8. Tổng/tỉ lệ tích lũy dùng ratio-of-sums; không cộng hoặc average tỉ lệ nguồn.
9. `InitialEnrollmentCount` không bị cộng lặp qua các đợt.
10. Tổng quan có góc nhìn theo khóa qua năm và hoạt động với filter khoa/CTĐT.
11. Khám phá chỉ cho group/series theo khoa, CTĐT, khóa và chọn được scope.
12. Tab Bảng hiển thị đúng dữ liệu nguồn của đợt được chọn, đủ truy vết file/dòng.
13. Dữ liệu legacy được audit/migrate mà không âm thầm gộp các đợt trùng; row
    nguồn cùng khóa phân tích vẫn được giữ riêng.
14. Query tích lũy được aggregate tại database và không bị giới hạn 12 dataset cũ.
15. Quyền `GRADUATION_ANALYTICS_ACCESS`, audit, CSRF và transaction vẫn hoạt động.

## 13. Những quyết định không nên để implementation tự suy đoán

- Workbook chuẩn đã được xác minh chỉ có một đợt `T7 - 2026`.
- Một khoa + CTĐT + khóa có thể có nhiều row nguồn trong một đợt; bảng giữ riêng
  từng row và query cộng chúng khi tạo kết quả phân tích.
- Năm nhóm count là nguồn để tính mọi tỉ lệ tổng hợp.
- Tỉ lệ Excel là dữ liệu truy vết theo row, không là phép gộp cumulative.
- Một đợt không được import hai lần; thay thế là thao tác riêng có xác nhận.
- Giao diện đổi tên theo nội dung thực tế thành **Thống kê kết quả tốt nghiệp**;
  route và permission kỹ thuật có thể giữ tên `graduation-analytics` để không làm
  hỏng bookmark/phân quyền hiện có.
