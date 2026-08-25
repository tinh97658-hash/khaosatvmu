# Kế hoạch — Thống kê sinh viên tốt nghiệp đúng hạn

Trạng thái: **đã hoàn thành phạm vi MVP import → preview → lưu → dashboard → xác minh**

Nguồn dữ liệu đã khảo sát: `C:\Users\hieuu\Downloads\Biểu mẫu SV tốt nghiệp.xlsx`

File trên **chỉ là tài liệu tham chiếu khi phát triển**: không đóng gói vào ứng dụng, không seed vào database và không được backend/frontend tự đọc. Khi chưa có dataset, người dùng bắt buộc tự chọn file và hoàn thành bước preview → xác nhận import.

Phạm vi: một module thống kê độc lập, import Excel → preview → lưu nguyên dữ liệu đã tính → trực quan hóa và so sánh đa chiều.

> **Yêu cầu bắt buộc:** phải bám sát vào rulesforai, giao diện phải thật mượt mà, thân thiện, không quá cầu kì, nhưng mà phải đẹp.

## 1. Những điểm đã chốt sau review

1. Đây là **một chức năng khác**, không phải phần mở rộng của khảo sát học phần. Dữ liệu nghiệp vụ phải nằm trong các bảng mới hoàn toàn; không thêm cột, khóa ngoại hay quy tắc vào các bảng khảo sát/danh mục đang có.
2. File Excel là **nguồn dữ liệu đã được tính toán chính xác**. Hệ thống không tính lại, sửa lại hoặc thay thế các giá trị I–U của từng dòng; nhiệm vụ chính là lưu, lọc, so sánh và biểu đồ hóa chúng.
3. Sáu cột C–H là các **chiều phân tích**; mười ba cột I–U là các **chỉ tiêu** có thể chọn để sinh dashboard.
4. Dashboard phải hỗ trợ so sánh giữa khoa, giữa ngành/CTĐT trong một khoa, giữa các khóa hoặc nhiều năm của cùng một khoa/ngành, và tổng quan toàn trường.
5. Có thể cài thêm chart dependency nếu tạo ra trải nghiệm phù hợp hơn. Không bị khóa vào `recharts` chỉ vì dự án đang dùng thư viện đó.
6. Ảnh tham chiếu Datawrapper được dùng cho ý tưởng **chọn loại biểu đồ theo dữ liệu**; không sao chép nguyên giao diện và không biến module thành một công cụ BI tổng quát.

## 2. Mục tiêu sản phẩm

Luồng chính:

```text
Chọn file Excel
    → đọc và preview toàn bộ 19 cột
    → kiểm tra cấu trúc/kiểu dữ liệu
    → người dùng xác nhận
    → lưu một bộ dữ liệu độc lập
    → sinh dashboard mặc định
    → tùy chọn chỉ tiêu, chiều so sánh và loại biểu đồ
```

Kết quả cần đạt:

- Nhìn nhanh tình hình tốt nghiệp đúng hạn từ dữ liệu Excel đã duyệt.
- Không làm thay đổi dữ liệu nghiệp vụ của project khảo sát hiện tại.
- Một chỉ tiêu có thể được xem theo nhiều góc: khoa, CTĐT, khóa, thời điểm xét, năm và toàn trường.
- Người dùng không cần hiểu cấu hình chart phức tạp; hệ thống chỉ đề xuất những loại biểu đồ phù hợp với lựa chọn hiện tại.
- Mỗi số liệu trên chart có thể truy ngược về file, phiên import và dòng nguồn.

## 3. Ranh giới với project chính

### 3.1. Tách biệt dữ liệu

Module dùng bounded context riêng, dự kiến là `GraduationAnalytics`:

- Entity, contract, service, endpoint, frontend service và CSS riêng.
- Chỉ tạo bảng mới bằng EF migration.
- Không thêm cột/chỉ mục/relationship vào `Faculties`, `Majors`, `Semesters`, `Survey*`, `Course*` hoặc các bảng nghiệp vụ khác.
- Không bắt buộc FK từ dữ liệu tốt nghiệp sang khoa/ngành hiện có; giữ nguyên tên/mã tại thời điểm import.
- Không dùng `EfReportService`, vì service đó thuộc báo cáo khảo sát học phần.

Các điểm tích hợp tối thiểu được phép:

- đọc danh tính/quyền từ auth context;
- đăng ký DI và endpoint;
- thêm một permission/module menu;
- thêm lazy route trong frontend.

Các điểm tích hợp này không làm thay đổi dữ liệu khảo sát. Nếu cần mức tách biệt vật lý cao hơn về sau, hai bảng mới có thể chuyển sang schema PostgreSQL riêng `graduation_analytics` mà không đổi contract của module.

### 3.2. Không nối danh mục bằng tên

Không tự map `CNTT` trong file vào một `FacultyId`, cũng không đoán `Tên CTĐT` là `MajorId`. So khớp tên mơ hồ có thể làm sai báo cáo. Trong module này:

- khoa là chuỗi nguồn;
- mã/tên CTĐT là chuỗi nguồn;
- khóa và thời điểm xét là chiều nguồn;
- việc chuẩn hóa danh mục dùng bảng mapping riêng chỉ khi có yêu cầu sau này.

## 4. Cấu trúc file Excel đã xác nhận

Workbook mẫu có một sheet `Sheet1`, vùng hiện tại `C4:U46`:

- dòng 4–5: tiêu đề hai tầng, `I4:U4` là ô gộp “Thông số xác định trong thời điểm (đợt) xét tốt nghiệp”;
- dòng 6: số thứ tự 1–19, không phải dữ liệu;
- dòng dữ liệu bắt đầu từ dòng 7;
- các dòng trống cuối file vẫn có formula, nên chỉ formula không làm dòng trở thành dữ liệu.

### 4.1. Nhóm chiều phân tích — C đến H

| Cột | Tiêu đề | Trường | Vai trò dashboard |
| :---: | :--- | :--- | :--- |
| C | Tên Khoa | `FacultyName` | so sánh khoa, lọc toàn trường |
| D | Mã CTĐT | `ProgramCode?` | định danh CTĐT nếu có |
| E | Tên CTĐT | `ProgramName` | so sánh ngành/CTĐT |
| F | Khóa | `Cohort` | so sánh các khóa |
| G | Số SV nhập học ban đầu | `InitialEnrollmentCount` | số nền/context, đồng thời dùng làm trọng số khi gom tỷ lệ K |
| H | Thời điểm xét Tốt nghiệp | `ReviewPeriodText` + tháng/năm parse | trục thời gian, so sánh nhiều năm |

G là cột số nhưng vẫn thuộc phần thông tin chính của biểu mẫu. Nó được lưu nguyên và có thể chọn làm metric phụ khi cần.

### 4.2. Nhóm chỉ tiêu dashboard — I đến U

| Cột | Chỉ tiêu | Trường lưu | Kiểu |
| :---: | :--- | :--- | :--- |
| I | Số SV được xét tốt nghiệp | `EligibleGraduateCount` | `int?` |
| J | Số SV tốt nghiệp đúng hạn | `OnTimeGraduateCount` | `int?` |
| K | Tỉ lệ số SV tốt nghiệp đúng hạn | `OnTimeGraduateRate` | `decimal?` |
| L | Số SV tốt nghiệp XS | `ExcellentCount` | `int?` |
| M | Tỉ lệ SV tốt nghiệp XS | `ExcellentRate` | `decimal?` |
| N | Số SV tốt nghiệp Giỏi | `VeryGoodCount` | `int?` |
| O | Tỉ lệ SV tốt nghiệp Giỏi | `VeryGoodRate` | `decimal?` |
| P | Số SV tốt nghiệp Khá | `GoodCount` | `int?` |
| Q | Tỉ lệ SV tốt nghiệp Khá | `GoodRate` | `decimal?` |
| R | Số SV tốt nghiệp T.Bình | `AverageCount` | `int?` |
| S | Tỉ lệ SV tốt nghiệp T.Bình | `AverageRate` | `decimal?` |
| T | Số SV chuyển VHVL | `WorkStudyTransferCount` | `int?` |
| U | Tỉ lệ SV chuyển VHVL | `WorkStudyTransferRate` | `decimal?` |

Quy tắc nguồn:

- Lưu **đủ cả số lượng lẫn tỷ lệ** đúng giá trị Excel cung cấp.
- Không bỏ K/M/O/Q/S/U và không tính lại các ô đó trước khi lưu.
- Formula cell được đọc bằng cached result của workbook; chuỗi formula không phải dữ liệu dashboard.
- Giá trị trống lưu `null`; số 0 lưu `0`. Không tự đổi qua lại.
- Tỷ lệ trong file dùng đơn vị điểm phần trăm, ví dụ `47,1` nghĩa là `47,1%`, không phải `0,471`.
- Dùng `decimal`, không dùng `double`, để tránh hiển thị kiểu `33.299999999`.

### 4.3. Số liệu đối chiếu parser

File mẫu là tài liệu đang được cập nhật. Tại lần đối chiếu gần nhất file có **40 dòng dữ liệu**. Ba tổng số đếm dùng để kiểm tra parser đọc đủ dòng/cột:

- G — số nhập học ban đầu: **5.019**;
- I — số được xét: **1.241**;
- J — số tốt nghiệp đúng hạn: **1.016**.

Các tổng trên chỉ là test đọc file, **không thay thế hoặc xác nhận lại các cột tỷ lệ Excel**.

## 5. Lưu dữ liệu theo dataset/import

### 5.1. Mỗi import là một bộ dữ liệu bất biến

- Một lần xác nhận tạo một dataset và các dòng dữ liệu con.
- Dashboard mặc định mở dataset mới nhất.
- Import file sửa đổi tạo dataset mới; không ghi đè dataset cũ.
- Có lịch sử để xem lại, đối chiếu và biết ai đã import.
- Backend sinh hash từ 19 giá trị đã chuẩn hóa để cảnh báo/khóa import trùng nội dung.
- Không lưu file nhị phân trong database ở MVP.

Dataset là phạm vi dữ liệu, không đồng nghĩa một năm. Một file có thể chứa nhiều khoa, CTĐT, khóa và năm; dashboard đọc các chiều ngay trong từng dòng.

### 5.2. So sánh nhiều dataset

Để so sánh qua các đợt/file khác nhau:

- người dùng có thể chọn một hoặc nhiều dataset;
- tên dataset là một dimension riêng trong query/chart;
- hệ thống không cộng hai snapshot giống nhau như hai nguồn độc lập;
- khi chọn nhiều dataset, mặc định chart phân series theo dataset để tránh double count;
- chỉ cho phép “gộp dataset” khi người dùng chủ động chọn và UI cảnh báo phạm vi.

## 6. Thiết kế bảng mới

### 6.1. `GraduationAnalyticsDatasets`

| Trường | Kiểu đề xuất | Ghi chú |
| :--- | :--- | :--- |
| `DatasetId` | `long` | PK |
| `DatasetName` | `varchar(200)` | tên hiển thị, mặc định từ tên file + ngày import |
| `OriginalFileName` | `varchar(255)` | không lưu path máy người dùng |
| `ContentHash` | `char(64)` | SHA-256, unique |
| `ImportedByUserId` | `Guid` | snapshot id, không tạo FK sang `Users` |
| `ImportedByName` | `varchar(200)` | snapshot tên người import |
| `ImportedAtUtc` | `DateTime` | UTC |
| `RowCount` | `int` | số dòng |
| `MinimumReviewDate` | `DateOnly?` | phục vụ filter/lịch sử |
| `MaximumReviewDate` | `DateOnly?` | phục vụ filter/lịch sử |

Không tạo navigation/FK sang bảng chính. `ImportedByUserId` là dấu vết nguồn từ auth context, không dùng để join nghiệp vụ.

### 6.2. `GraduationAnalyticsRows`

| Nhóm | Trường |
| :--- | :--- |
| Nguồn | `RowId`, `DatasetId`, `SourceSheetName`, `SourceRowNumber` |
| Chiều | `FacultyName`, `ProgramCode?`, `ProgramName`, `Cohort`, `ReviewPeriodText`, `ReviewMonth?`, `ReviewYear?` |
| Cột G | `InitialEnrollmentCount?` |
| Chỉ tiêu I–K | `EligibleGraduateCount?`, `OnTimeGraduateCount?`, `OnTimeGraduateRate?` |
| Chỉ tiêu L–O | `ExcellentCount?`, `ExcellentRate?`, `VeryGoodCount?`, `VeryGoodRate?` |
| Chỉ tiêu P–S | `GoodCount?`, `GoodRate?`, `AverageCount?`, `AverageRate?` |
| Chỉ tiêu T–U | `WorkStudyTransferCount?`, `WorkStudyTransferRate?` |

Cấu hình EF:

- tất cả count là `int?`, giữ đúng null/0 của file;
- tỷ lệ là `decimal(9,4)?`, đủ giữ cached value mà không dính sai số floating-point;
- FK duy nhất nằm **giữa hai bảng mới**: rows → datasets, cascade;
- index `(DatasetId, FacultyName)`;
- index `(DatasetId, ProgramCode, ProgramName)`;
- index `(DatasetId, ReviewYear, ReviewMonth)`;
- unique `(DatasetId, SourceSheetName, SourceRowNumber)`.

Migration của module chỉ được tạo hai bảng và index/FK giữa chúng. Không được phát sinh `ALTER TABLE` trên các bảng nghiệp vụ hiện có.

### 6.3. Chưa cần bảng cấu hình chart

MVP giữ cấu hình chart trong URL/query state để chia sẻ hoặc reload mà không mất ngữ cảnh. Chỉ thêm `GraduationAnalyticsChartPresets` khi có yêu cầu thật về lưu dashboard cá nhân/dùng chung; tránh thêm bảng sớm theo YAGNI.

## 7. Import và preview

### 7.1. Bước 1 — Chọn file

- Kéo thả hoặc chọn một `.xlsx`, tối đa 5 MB.
- Hiện tên file, dung lượng, sheet tìm thấy và trạng thái đang đọc.
- Parser tìm header bằng nhãn chuẩn hóa thay vì viết cứng dòng 4.
- Chấp nhận header hai tầng/merged cells của file mẫu và bỏ dòng thứ tự 1–19.
- Một dòng chỉ là dữ liệu nếu có giá trị nguồn ngoài các formula tỷ lệ trống.
- Giới hạn đề xuất 5.000 dòng mỗi file.

### 7.2. Bước 2 — Preview đúng dữ liệu nguồn

Preview hiển thị:

- tổng dòng đọc được và số dòng lỗi cấu trúc;
- bảng đủ C–U, chia header thành `Thông tin chính` và `Chỉ tiêu tốt nghiệp`;
- toggle hiển thị `Tất cả cột` / `Chỉ tiêu` để tránh bảng quá rộng;
- số dòng Excel cố định bên trái, header sticky, cuộn ngang có chủ đích;
- ô formula hiển thị cached value, không hiển thị chuỗi công thức;
- null hiển thị `—`, zero hiển thị `0`;
- tỷ lệ hiển thị `%` nhưng payload/database vẫn giữ numeric value.

Không hiển thị “tỷ lệ hệ thống tính lại” và không cảnh báo chênh lệch công thức.

### 7.3. Validation chỉ bảo vệ khả năng đọc/lưu

Lỗi chặn:

| Mã | Điều kiện |
| :--- | :--- |
| `FILE_TYPE` | không phải `.xlsx` |
| `FILE_SIZE` | trên giới hạn |
| `READ_FAILED` | file hỏng, đặt mật khẩu hoặc không đọc được |
| `SHEET_STRUCTURE_INVALID` | thiếu bộ header C–U |
| `NO_DATA_ROWS` | không có dữ liệu |
| `TOO_MANY_ROWS` | vượt giới hạn dòng |
| `VALUE_TYPE_INVALID` | count/rate không đọc được thành số |
| `REVIEW_PERIOD_INVALID` | không tách được tháng/năm để so sánh thời gian |

Không tự đặt các luật như `J <= I`, `I <= G`, tổng xếp loại bằng I hoặc tỷ lệ phải khớp công thức. File là nguồn đã tính chính xác; nếu cần kiểm tra nghiệp vụ, đó phải là yêu cầu riêng và chỉ nên hiển thị như công cụ audit tùy chọn.

### 7.4. Bước 3 — Xác nhận xử lý

- Nút chính `Import và tạo dashboard`.
- Frontend gửi đủ 19 giá trị nguồn, không gửi formula text.
- Backend kiểm tra lại cấu trúc/type/limit, nhưng không tái tính nghiệp vụ.
- Datasets + rows lưu trong một transaction; lỗi thì rollback toàn bộ.
- Lỗi mạng giữ nguyên preview để retry.
- Thành công chuyển thẳng đến dashboard của dataset vừa tạo.

## 8. Mô hình dashboard đa chiều

### 8.1. Metadata của chiều và chỉ tiêu

Frontend/backend dùng một catalog typed cố định, không cho người dùng nhập tên field hoặc option chart tùy ý.

Mỗi dimension khai báo:

- `id`, nhãn tiếng Việt, kiểu `category | time | dataset`;
- khả năng dùng làm filter, trục X, series;
- thứ tự sort mặc định.

Mỗi metric khai báo:

- `id`, nhãn, nguồn cột Excel;
- kiểu `count | rate`;
- format `integer | percent`;
- phép gộp được phép;
- denominator/trọng số tương ứng nếu cần xem nhóm tổng hợp;
- danh sách chart type tương thích.

Đây là metadata code cố định, không phải schema động và không nhận expression từ client.

### 8.2. Hai chế độ sử dụng

#### Dashboard mặc định

Mở ra là có ngay các góc nhìn hữu ích:

1. Dải KPI từ G, I, J, K theo phạm vi lọc.
2. Cột nhóm tỷ lệ đúng hạn theo khoa qua các năm, kèm đường trung bình của phạm vi.
3. Biểu đồ nhiều đường cho toàn bộ khoa qua các năm; không giới hạn số đường và cho phép bật/tắt bằng legend.
4. Thanh ngang chồng Đúng hạn/Chưa đúng hạn theo khoa; phần Chưa đúng hạn là giá trị trình bày `I - J`, không ghi vào dữ liệu nguồn.
5. Cơ cấu Xuất sắc/Giỏi/Khá/Trung bình/Chuyển VHVL.
6. Bảng nguồn chi tiết C–U.

Dashboard mặc định không cần người dùng cấu hình chart trước.

Hai chế độ được chuyển bằng segmented switch `Tổng quan | Khám phá chi tiết`, dùng chung bộ lọc và giữ lựa chọn trong URL qua `gaView`. Sau import mặc định mở Tổng quan; cấu hình chart khám phá được giữ nguyên khi chuyển chế độ.

#### Khám phá/Tùy chỉnh biểu đồ

Theo tinh thần ảnh Datawrapper, nhưng rút gọn thành bốn bước trong một panel:

```text
1. Chọn phạm vi dữ liệu
2. Chọn chỉ tiêu I–U (hoặc G)
3. Chọn chiều so sánh
4. Chọn loại biểu đồ tương thích
```

Tùy chọn nâng cao gọn:

- `Series theo`: khoa, CTĐT, khóa, năm hoặc dataset;
- sort tăng/giảm/theo thời gian;
- hiện giá trị, chú giải, ghi chú nguồn;
- top N khi danh mục quá dài;
- chuyển bảng dữ liệu tương ứng.

Không cho chọn cấu hình vô nghĩa. Pie/donut chỉ dùng khi có một series và tối đa 12 nhóm; biểu đồ chồng chỉ bật sau khi chọn phân chuỗi. Line/area vẫn dùng được với trục category để không giới hạn việc so sánh ngành/khoa, đồng thời ưu tiên chúng khi trục là thời gian.

### 8.3. Các phạm vi so sánh phải hỗ trợ

| Nhu cầu | Filter | Dimension/trục | Series |
| :--- | :--- | :--- | :--- |
| So sánh các khoa | Toàn trường | Khoa | chỉ tiêu đã chọn |
| So sánh ngành trong một khoa | Một khoa | CTĐT | chỉ tiêu đã chọn |
| Cùng khoa qua nhiều năm | Một khoa | Năm/thời điểm xét | CTĐT hoặc toàn khoa |
| Cùng ngành qua các khóa | Một CTĐT | Khóa | chỉ tiêu đã chọn |
| Cùng khóa giữa nhiều ngành | Một khoa/không giới hạn | CTĐT | Khóa |
| Toàn trường qua thời gian | Toàn trường | Năm/thời điểm xét | Khoa hoặc tổng trường |
| So sánh các lần import | Nhiều dataset | Dataset | khoa/CTĐT nếu cần |

### 8.4. Phép gộp chỉ phục vụ chart

“Không tính lại Excel” áp dụng cho **giá trị từng dòng được import**. Khi một chart gom nhiều dòng thành một khoa/năm/toàn trường, vẫn cần phép tổng hợp hiển thị:

- metric số lượng: `SUM` các giá trị nguồn không null;
- metric tỷ lệ: weighted average từ **tỷ lệ nguồn**, không ghi đè dữ liệu gốc;
- K dùng G làm trọng số;
- M/O/Q/S/U dùng I làm trọng số;
- nếu thiếu trọng số, loại dòng đó khỏi điểm tổng hợp và trả thêm `includedRows/totalRows`;
- không có dữ liệu hợp lệ thì trả `null`, không trả `0`;
- tooltip/footnote luôn ghi `Giá trị tổng hợp từ N dòng nguồn`.

Công thức tổng hợp rate:

```text
Σ(rate nguồn × trọng số nguồn) / Σ(trọng số nguồn)
```

Đây là phép gom phục vụ biểu đồ, không phải kiểm tra hoặc sửa công thức Excel. API phải trả cả `aggregation: source | sum | weighted-average` để UI nói rõ cách hình thành điểm dữ liệu.

## 9. Loại biểu đồ và quy tắc tương thích

Không đưa toàn bộ gallery vào mọi tình huống. Chart picker chỉ hiện loại phù hợp:

| Dữ liệu đang chọn | Loại chart ưu tiên | Loại phụ |
| :--- | :--- | :--- |
| Một metric + nhiều category | Bar ngang, Column | Dot plot |
| Nhiều metric cùng đơn vị + category | Grouped bar/column | Multiple columns |
| Các phần của một tổng | 100% stacked bar/column | Donut nếu chỉ một nhóm và ≤ 6 phần |
| Một metric + thời gian | Line | Area, column theo thời gian |
| Nhiều series + thời gian | Multiple lines | Small multiples nếu nhãn quá dày |
| Hai metric số | Scatter | Bubble nếu có metric thứ ba |
| Min/max qua nhóm/năm | Range plot | Dot plot |
| Dữ liệu chi tiết | Table | — |

Quy tắc trình bày:

- metric rate dùng trục 0–100% trừ khi người dùng bật rõ chế độ zoom trục;
- không dùng 3D;
- donut/pie không dùng cho nhiều category hoặc chuỗi thời gian;
- tối đa 5–7 series màu cùng lúc; nhiều hơn dùng small multiples/table/top N;
- màu không phải tín hiệu duy nhất; tooltip và nhãn luôn đủ nghĩa;
- mọi chart có tiêu đề, phạm vi lọc, đơn vị và nguồn dataset.

## 10. Lựa chọn thư viện biểu đồ

### Quyết định triển khai: Apache ECharts cho module tốt nghiệp

Module tốt nghiệp dùng `echarts` 6.1 qua wrapper nội bộ `GraduationEChart`; `recharts` vẫn giữ nguyên cho các trang khảo sát đang chạy. Dependency được import theo module từ `echarts/core`, không dùng wrapper React thứ ba và không nhận raw option từ API/người dùng.

Lý do chọn để spike:

- có hơn 20 chart type và cho phép kết hợp component;
- `dataset` tách dữ liệu khỏi cấu hình chart, phù hợp catalog dimension/metric;
- hỗ trợ bar, line, area, scatter, pie/donut, boxplot, heatmap và custom series;
- hỗ trợ Canvas/SVG, responsive, data transform và ARIA/decal;
- có thể import module theo nhu cầu để giảm bundle.

Tài liệu tham chiếu chính thức:

- [Apache ECharts — Features](https://echarts.apache.org/en/feature.html)
- [Apache ECharts — Dataset](https://echarts.apache.org/handbook/en/concepts/dataset/)
- [Apache ECharts — ARIA accessibility](https://echarts.apache.org/handbook/en/best-practices/aria/)

Phạm vi chart đã triển khai gồm bar ngang, column, stacked bar, stacked column, line, area, pie và donut. Wrapper quản lý `init/ResizeObserver/dispose`, dùng Canvas renderer, bật `AriaComponent`, tooltip và bảng dữ liệu tương đương. Gallery luôn hiển thị đủ lựa chọn; loại chưa tương thích bị vô hiệu hóa kèm lý do cụ thể.

## 11. API riêng

```text
GET  /api/v1/graduation-analytics/datasets
POST /api/v1/graduation-analytics/datasets
GET  /api/v1/graduation-analytics/metadata
POST /api/v1/graduation-analytics/query
GET  /api/v1/graduation-analytics/datasets/{datasetId}/rows
```

### `POST /datasets`

Nhận:

- `datasetName`, `originalFileName`, `sheetName`;
- danh sách dòng đủ C–U với `sourceRowNumber`;
- không nhận formula text hoặc path local.

Backend chỉ validate structure/type/size, chuẩn hóa decimal/string kỹ thuật và lưu transaction. Response trả dataset metadata và hash route dashboard.

### `GET /metadata`

Trả catalog dimension/metric/chart compatibility dùng chung cho UI. Contract typed và versioned; frontend vẫn whitelist ID đã biết.

### `POST /query`

Request typed:

- `datasetIds`;
- filter khoa, CTĐT, khóa, tháng/năm;
- `metricIds`;
- `groupBy`, `seriesBy`;
- `aggregation` nằm trong enum cho phép;
- sort/top N.

Response:

- dữ liệu chart/table;
- unit, aggregation thực tế;
- `includedRows`, `totalRows`;
- source datasets và applied filters.

Không nhận column name, SQL, regex hoặc expression tự do. Service ánh xạ enum sang LINQ expression đã định nghĩa sẵn.

### `GET /rows`

Server-side search/filter/sort/pagination cho bảng C–U. `sortBy` dùng whitelist; page size có giới hạn.

## 12. Phân quyền

Tạo `GRADUATION_ANALYTICS_ACCESS` để module độc lập trong hệ quyền hiện có:

| Vai mặc định | Xem | Import |
| :--- | :---: | :---: |
| `ADMIN` | Có | Có |
| `SURVEY_ADMIN` | Có | Có |
| `DEPARTMENT_MANAGER` | Chưa cấp mặc định | Không |
| `LECTURER` | Không | Không |

Frontend guard để điều hướng đúng; backend policy mới là lớp bảo vệ thật. Chưa tách quyền xem/import vì MVP chưa có vai chỉ đọc của module. Khi có nhu cầu, thêm `GRADUATION_ANALYTICS_IMPORT` thay vì kiểm tra role viết cứng.

## 13. Tổ chức mã nguồn dự kiến

### Backend

- `Domain/GraduationAnalyticsModels.cs`
- `Application/GraduationAnalytics/GraduationAnalyticsContracts.cs`
- `Infrastructure/GraduationAnalytics/EfGraduationAnalyticsService.cs`
- `API/GraduationAnalytics/GraduationAnalyticsEndpoints.cs`
- `Infrastructure/Persistence/AppDbContext.cs`: chỉ thêm hai `DbSet` và mapping bảng mới
- `Infrastructure/Persistence/Migrations/...AddGraduationAnalytics.cs`
- `Infrastructure/Persistence/DatabaseSeeder.cs`: permission mới
- `API/Auth/PermissionAuth.cs`, `API/Program.cs`: policy/DI/endpoint

### Frontend

- `pages/GraduationAnalyticsPage.tsx`
- `components/graduation/GraduationImportDialog.tsx`
- `components/graduation/GraduationDashboard.tsx`
- `components/graduation/GraduationChartBuilder.tsx`
- `components/graduation/GraduationChartTypePicker.tsx`
- `components/graduation/GraduationChart.tsx`
- `components/graduation/GraduationSourceTable.tsx`
- `components/graduation/GraduationDatasetHistory.tsx`
- `utils/graduationImportExcel.ts`
- `services/graduationAnalyticsApi.ts`
- `styles/graduation-analytics.css`
- cập nhật tối thiểu `Sidebar.tsx`, `App.tsx`, `modulePermissions.ts`, `types.ts`

Không tạo một component riêng cho từng chart nếu cùng wrapper + option factory giải quyết rõ hơn. Các option factory phải typed theo chart type, không dùng `any`.

## 14. Giao diện và tương tác

- Module nằm trong nhóm **BÁO CÁO/TỔNG QUAN**, có nhãn `Thống kê tốt nghiệp`.
- Dashboard là workspace dữ liệu dày vừa phải, không phải landing page hay lưới card trang trí.
- Chart picker lấy ý tưởng từ ảnh tham chiếu: thumbnail đơn giản + tên chart + selected state rõ, nhưng chỉ 4–8 lựa chọn tương thích thay vì gallery cố định 20 loại.
- Màu teal/blue tiết chế, surface trắng, border mảnh, radius 0–4 px theo `rules/.rulesforai`.
- Không gradient, glass, 3D, shadow nặng hoặc animation phô trương.
- Motion 120–200 ms và tôn trọng reduced motion.
- Async state đủ loading/success/empty/validation error/permission denied/network error/retry.
- Giữ filter, dataset, metric, chart type trong URL để refresh/back-forward không mất trạng thái.
- Focus visible, modal trả focus, chart có mô tả text và luôn có bảng dữ liệu tương đương.
- Desktop kiểm tra `1440×900`; mobile `390×844`.
- Mobile stack toolbar/panel, chart resize ổn định, bảng C–U cuộn ngang; không biến mỗi dòng thành card.

## 15. Trình tự triển khai

### Giai đoạn A — Spike dữ liệu và chart

- [x] A1. Tạo fixture ẩn danh từ workbook mẫu.
- [x] A2. Chứng minh parser đọc được cached result của formula K/M/O/Q/S/U.
- [x] A3. Unit test: header hai tầng, dòng 6, formula-only blank rows, null khác zero, decimal không sai số.
- [x] A4. Spike và tích hợp Apache ECharts 6.1 bằng modular import; kiểm tra TypeScript, resize và dispose instance.
- [x] A5. Chốt ECharts riêng cho module tốt nghiệp; giữ Recharts cho các trang hiện hữu.
- [x] A6. Chốt metadata dimension/metric/aggregation/compatibility.

### Giai đoạn B — Bảng mới và backend độc lập

- [x] B1. Thêm hai entity/table mới, không thay đổi bảng nghiệp vụ hiện có.
- [x] B2. Tạo EF migration và review SQL migration: chỉ `CREATE TABLE/INDEX` cho module mới.
- [x] B3. Test `Up`/`Down` migration.
- [x] B4. Implement import transaction và duplicate hash.
- [x] B5. Implement metadata catalog.
- [x] B6. Implement query engine enum → LINQ cho dimension/metric cố định.
- [x] B7. Implement weighted aggregation từ rate nguồn + coverage metadata.
- [x] B8. Implement rows paging/filter/sort.
- [x] B9. Endpoint authorization/integration tests.

### Giai đoạn C — Import UI

- [x] C1. Parser và typed service.
- [x] C2. Modal chọn file → preview C–U → xác nhận.
- [x] C3. Sticky grouped header, toggle nhóm cột, null/zero/percent đúng.
- [x] C4. Retry không mất preview; duplicate dataset có thông báo rõ.
- [x] C5. Thành công điều hướng đến dataset vừa import.

### Giai đoạn D — Dashboard mặc định

- [x] D1. Dataset picker + filter khoa/CTĐT/khóa/năm xét.
- [x] D2. KPI strip từ dữ liệu nguồn/tổng hợp có chú thích.
- [x] D3. So sánh khoa.
- [x] D4. So sánh CTĐT trong khoa.
- [x] D5. Cơ cấu kết quả.
- [x] D6. Xu hướng nhiều năm/thời điểm xét.
- [x] D7. Bảng nguồn C–U và lịch sử dataset.
- [x] D8. Switch Tổng quan/Khám phá chi tiết, đồng bộ `gaView` vào URL.
- [x] D9. Cột nhóm theo năm + đường trung bình, nhiều đường không giới hạn khoa và thanh chồng Đúng hạn/Chưa đúng hạn.

### Giai đoạn E — Chart builder có kiểm soát

- [x] E1. Chọn metric I–U/G.
- [x] E2. Chọn dimension và series.
- [x] E3. Compatibility engine chỉ hiện chart phù hợp trong phạm vi MVP.
- [x] E4. Chart type picker theo ảnh tham chiếu, responsive và keyboard.
- [x] E5. Sort/top N/label/legend/source note.
- [x] E6. Đồng bộ cấu hình vào URL và data table tương đương.

### Giai đoạn F — Xác minh

- [x] F1. `dotnet build` và toàn bộ `dotnet test` pass.
- [x] F2. `npm run build` và `npm run lint` pass.
- [x] F3. Parser đọc file mẫu hiện tại: đúng 40 dòng, đủ 19 cột, G/I/J là `5.019/1.241/1.016`.
- [x] F4. Đối chiếu trực tiếp cached rate K/M/O/Q/S/U với Excel.
- [x] F5. Test so sánh: khoa, ngành trong khoa, cùng khoa nhiều năm, toàn trường, nhiều dataset.
- [x] F6. Test null/0, file lỗi, file trùng, rollback và quyền 403.
- [x] F7. Visual QA thật ở `1440×900` và `390×844`; kiểm tra overflow, tooltip, legend, chart resize, modal và focus.
- [x] F8. Browser console sạch; wrapper ECharts quản lý init, resize và dispose khi đổi loại/filter hoặc unmount.
- [x] F9. So ảnh implementation với ảnh tham chiếu ở cùng viewport và sửa hierarchy/density, không sao chép trang trí không phù hợp.

## 16. Tiêu chí nghiệm thu

1. Migration chỉ tạo `GraduationAnalyticsDatasets` và `GraduationAnalyticsRows` cùng index/FK nội bộ; không alter bảng nghiệp vụ hiện có.
2. Hệ thống không có dữ liệu mẫu tự động; database rỗng phải hiển thị lời mời import và không sinh dashboard cho đến khi người dùng xác nhận file.
3. File mẫu preview đủ dữ liệu C–U theo phiên bản file tại thời điểm import; dòng formula trống không bị nhận nhầm.
4. K/M/O/Q/S/U lưu đúng cached result từ Excel, không bị hệ thống tính lại.
5. Null và zero được giữ khác nhau từ Excel → request → DB → API → table/chart.
6. Trước khi xác nhận import, database không thay đổi; lỗi lưu rollback toàn bộ.
7. Dashboard mặc định sinh được ngay sau import, không buộc người dùng cấu hình chart.
8. Chọn được mọi chỉ tiêu I–U làm metric; G là metric phụ.
9. So sánh được giữa khoa, ngành trong một khoa, khóa, năm/thời điểm, toàn trường và dataset.
10. Chart picker chỉ hiện loại hợp lệ và tự chuyển về loại mặc định nếu thay dimension làm chart cũ không còn phù hợp.
11. Điểm tổng hợp ghi rõ `source/sum/weighted-average` và coverage; không âm thầm biến giá trị tổng hợp thành dữ liệu Excel gốc.
12. Bất kỳ điểm chart nào cũng xem được tooltip và bảng nguồn tương ứng.
13. Không có dữ liệu nào được gửi sang dịch vụ chart bên ngoài.
14. Tài khoản thiếu `GRADUATION_ANALYTICS_ACCESS` không thấy menu và nhận `403` khi gọi API trực tiếp.
15. UI đạt loading/empty/error/no-results, keyboard, reduced motion, desktop/mobile theo `rules/.rulesforai`.

## 17. Quyết định không còn để ngỏ

- Không hỏi lại Excel có đúng công thức hay không; coi file là nguồn sự thật.
- Không kiểm tra chéo J/I/G hoặc tổng xếp loại trong MVP.
- Không bỏ các cột tỷ lệ.
- Không dùng bảng khảo sát/danh mục chính để lưu hoặc suy diễn dữ liệu tốt nghiệp.
- Không khóa implementation vào Recharts; chart dependency được quyết định bằng spike có tiêu chí.

Điểm duy nhất cần xác nhận khi bắt đầu triển khai là **dataset đầu tiên có được phép chứa dữ liệu của nhiều file/sheet hay luôn đúng một file và một sheet**. Thiết kế MVP hiện chọn đúng theo yêu cầu ban đầu: một dataset = một file, đọc một sheet có bộ header hợp lệ.
