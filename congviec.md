# Kế hoạch công việc

File này ghi dần các yêu cầu và kế hoạch triển khai. **Chưa code** cho tới khi có
yêu cầu rõ ràng.

- Nhánh: `hoang2`
- Cập nhật lần cuối: 2026-08-20

---

## 1. Hiện trạng liên quan

Ghi lại để không làm trùng và để đối chiếu khi bàn yêu cầu mới.

### `SurveyResponses` — bảng lượt làm khảo sát

| Cột | Kiểu | Null |
|---|---|---|
| `ResponseId` | integer | NO (PK) |
| `CourseSectionSurveyId` | integer | NO (FK → `CourseSectionSurveys`, CASCADE) |
| `AdditionalComments` | text | YES |
| `Score` | numeric(4,2) | NO |
| `SubmittedAt` | timestamptz | NO |

### `CourseSectionSurveys` — bài khảo sát riêng mỗi lớp

| Cột | Kiểu | Null |
|---|---|---|
| `CourseSectionSurveyId` | integer | NO (PK) |
| `SemesterSurveyId` | integer | NO (FK, CASCADE) |
| `CourseSectionId` | integer | NO (FK, CASCADE) |
| `LinkToken` | text | NO (UNIQUE) |
| `StartTime` / `EndTime` | timestamptz | NO (CHECK `EndTime > StartTime`) |
| `CreatedAt` | timestamptz | NO |
| `IsDeleted` / `DeletedAt` | boolean / timestamptz | NO / YES |

> **Đính chính:** bảng này **chưa có cột lượt làm nào**. Con số "lượt làm" đang
> thấy trên giao diện là `CourseSectionSurveyDto.ResponseCount`, đếm tại chỗ mỗi
> lần gọi API bằng `ResponseCountsAsync`, không lưu xuống DB. Nên phần C3 bên
> dưới là **thêm mới cả 3 cột đếm**, không phải "thêm 2 cột vào cột đã có".

### `SurveyQuestions`

| Cột | Kiểu | Null |
|---|---|---|
| `QuestionId` | integer | NO (PK) |
| `SurveyTemplateId` | integer | NO (FK, CASCADE) |
| `QuestionText` | text | NO |
| `AnswerScaleId` | integer | NO (FK → `AnswerScales`, RESTRICT) |

### Cách tính điểm hiện tại

`ComputeScore` trong [EfSurveyService.cs](src/Backend/Infrastructure/Surveys/EfSurveyService.cs)
lấy trung bình các câu **thuộc thang `Options`**; câu thang `Text` đã bị loại.

### Chống spam đang có

- `PublicSurveySubmission`: 10 lượt POST / 1 phút / mỗi IP ([Program.cs:71-80](src/Backend/API/Program.cs#L71-L80))
- `PublicSurveyConcurrency`: 800 request đồng thời cho GET phiếu
- **Chưa có** cơ chế chặn một người nộp nhiều phiếu cho cùng một lớp
- GET phiếu công khai đang **cache 15 phút theo `LinkToken`**, và mọi sinh viên
  của một lớp dùng chung đúng một token

---

## 2. Nhóm A — Lọc nhiễu phiếu trả lời

Mục tiêu: phiếu làm ẩu vẫn được nhận và vẫn tính là một lượt nộp, nhưng bị đánh
dấu để **không** tham gia vào điểm trung bình của lớp.

Nguyên tắc bạn đã chốt: *30 lượt nộp thì vẫn là 30 lượt; nếu 5 phiếu bị lọc thì
điểm trung bình của lớp chỉ tính trên 25 phiếu còn lại.*

### A1. Thời gian làm bài tối thiểu

Chặn kiểu bấm bừa không đọc đề.

- Công thức: `5 giây × số câu hỏi của bộ`
- Bộ 30 câu → tối thiểu 150 giây

**Vướng mắc phải giải trước khi code:** hệ thống hiện **không biết sinh viên mở
phiếu lúc nào**. Endpoint `GET /api/public/surveys/{linkToken}` là ẩn danh,
không ghi lại gì, và còn được cache chung 15 phút cho mọi sinh viên của lớp. Vậy
lấy mốc bắt đầu ở đâu:

- **(a) Client tự đếm rồi gửi số giây lên.** Dễ làm nhất, nhưng sinh viên sửa
  được bằng DevTools chỉ trong vài giây — coi như không chặn được ai có ý định
  gian lận.
- **(b) Server phát "vé bắt đầu" có ký (HMAC) khi mở phiếu**, client gửi kèm vé
  lúc nộp, server lấy thời điểm trong vé để tính. Không lưu thêm bảng nào,
  không sửa được nếu không có khoá. **Đây là phương án tôi đề xuất.**
- **(c) Lưu một dòng "đã mở phiếu" xuống DB mỗi lần có người mở.** Chính xác
  nhất nhưng thêm một bảng ghi và thêm tải cho lúc cao điểm.

### A2. Phiếu chỉ chọn duy nhất một mức

Sinh viên chọn cùng một đáp án cho tất cả các câu (kiểu kéo thẳng một cột) → lọc.

**Lưu ý bắt buộc:** phép kiểm này phải **bỏ qua câu bẫy độ tập trung (A3) và câu
tự nhập**. Nếu không, một phiếu chọn toàn mức 5 nhưng làm đúng câu bẫy (mức 3) sẽ
có 2 giá trị khác nhau và lọt lưới, đúng vào trường hợp cần bắt nhất.

### A3. Câu hỏi bẫy kiểm tra độ tập trung

Thêm một cột vào `SurveyQuestions` chứa **mức đáp án bắt buộc**.

- Cột trống (`NULL`) → câu hỏi bình thường
- Cột điền `3` → sinh viên phải chọn mức 3 thì phiếu mới hợp lệ

Ví dụ nội dung câu: *"Bạn hài lòng với sự nhiệt tình và trách nhiệm của giảng
viên trong quá trình giảng dạy (hãy chọn đáp án 3)"* — phần "(hãy chọn đáp án 3)"
chỉ là chữ trong `QuestionText` để sinh viên đọc; lúc lọc thì hệ thống so với
**giá trị trong cột mới**, không đọc chữ trong câu hỏi.

Hai hệ quả:

- Câu bẫy **không tính vào điểm trung bình** của phiếu, cùng cách xử lý như câu
  thang `Text`. Lý do bạn nêu: nó ép chọn một mức duy nhất nên điểm của nó vô
  nghĩa.
- Ràng buộc cần có: chỉ đặt được câu bẫy trên câu thuộc thang `Options`, và giá
  trị điền vào phải là một mức có thật của chính thang đó (không thể đặt bẫy
  "mức 3" cho câu dùng thang Có/Không chỉ có mức 1 và 5).

### A4. Cột kết quả lọc trên `SurveyResponses`

Chạy lọc **ngay lúc nộp bài**, lưu kết quả xuống phiếu.

| Cột | Kiểu | Null | Ý nghĩa |
|---|---|---|---|
| `IsValid` | boolean | NO | `true` = qua lọc, được tính vào trung bình lớp |
| `RejectionReason` | varchar(50) | YES | Lý do bị lọc, `NULL` khi hợp lệ |

`RejectionReason` không nằm trong yêu cầu bạn nêu, tôi đề xuất thêm: có nó thì
admin nhìn ra ngay 5 phiếu bị lọc là do làm quá nhanh, do chọn một mức, hay do
sai câu bẫy — nếu chỉ có `true/false` thì không truy được.

Giá trị dự kiến: `TOO_FAST`, `SINGLE_ANSWER`, `ATTENTION_CHECK_FAILED`.

**Đặc điểm cần biết:** kết quả lọc là ảnh chụp tại thời điểm nộp. Sau này sửa
câu bẫy hoặc đổi thời gian tối thiểu thì các phiếu đã nộp **giữ nguyên** kết quả
cũ, không tự tính lại.

---

## 3. Nhóm B — Chặn một sinh viên nộp nhiều lần

Thêm cột lưu **thông tin máy** vào `SurveyResponses`.

**Trạng thái: chưa chốt.** Xem câu hỏi B1–B5 ở mục 5.

Điểm cần lưu ý:

- Phiếu hiện đang **ẩn danh có chủ đích**. Giao diện nói thẳng với sinh viên:
  *"Thông tin của bạn được ghi nhận ẩn danh và chỉ dùng cho mục đích khảo sát"*
  và *"Ý kiến của bạn được ghi nhận ẩn danh"*
  ([PublicSurveyPage.tsx](src/Frontend/src/pages/PublicSurveyPage.tsx)). Lưu
  thông tin máy làm câu đó không còn đúng, nên **sửa lại câu chữ là việc bắt
  buộc đi kèm**, không phải mục tuỳ chọn.
- Lưu **băm (hash)** thay vì IP/User-Agent nguyên văn thì vẫn chặn trùng được mà
  không giữ dữ liệu nhận dạng.
- Máy phòng máy dùng chung: nhiều sinh viên hợp lệ ngồi cùng máy sẽ bị chặn oan.
- IP không đáng tin: cả giảng đường qua Wi-Fi trường thường chung một IP NAT;
  ngược lại điện thoại đổi IP liên tục.
- `AuthAuditLogs` đã có sẵn `IpAddress varchar(64)` và `UserAgent varchar(1000)`
  ([AppDbContext.cs:119-120](src/Backend/Infrastructure/Persistence/AppDbContext.cs#L119-L120)),
  nên dùng lại đúng kiểu/độ dài cho nhất quán.

---

## 4. Nhóm C — Điểm trung bình và thống kê

### C1. Điểm trung bình của từng lượt làm bài

> VD 30 câu thang mức độ hài lòng, một lượt chọn: 5 câu mức 1, 6 câu mức 2,
> 3 câu mức 3, 6 câu mức 4, 10 câu mức 5
> → `(5×1 + 6×2 + 3×3 + 6×4 + 10×5) / 30 = 100/30 = 3.33`

**Trạng thái: ĐÃ CÓ, không cần thêm cột.**

`SurveyResponses.Score numeric(4,2)` đang tính đúng như vậy ngay lúc nộp và đã
loại câu thang `Text`.

**Việc cần làm thêm:** loại tiếp **câu bẫy độ tập trung (A3)** ra khỏi phép trung
bình này.

→ Cần bạn xác nhận: dùng luôn cột `Score`, hay muốn cột riêng?

### C2. Điểm trung bình của từng lớp, tính theo mẻ

Thêm cột vào `CourseSectionSurveys`. **Không** cập nhật mỗi lần có phiếu mới;
admin bấm một nút để tính lại toàn bộ.

Chỉ gộp các phiếu có `IsValid = true`.

### C3. Đếm phiếu hợp lệ / không hợp lệ

Cột dự kiến thêm vào `CourseSectionSurveys`:

| Cột | Kiểu | Null | Ý nghĩa |
|---|---|---|---|
| `AverageScore` | numeric(4,2) | YES | `NULL` = chưa tính lần nào |
| `TotalResponseCount` | integer | NO, default 0 | Tổng lượt nộp (ví dụ 30) |
| `ValidResponseCount` | integer | NO, default 0 | Lượt qua lọc, dùng tính điểm (ví dụ 25) |
| `InvalidResponseCount` | integer | NO, default 0 | Lượt bị lọc nhiễu (ví dụ 5) |
| `ScoreCalculatedAt` | timestamptz | YES | Lần bấm tính gần nhất |

`ScoreCalculatedAt` là đề xuất thêm của tôi: có nó thì admin biết con số đang xem
tính từ lúc nào, và biết có phiếu nào về sau lần tính gần nhất chưa được gộp.

`InvalidResponseCount` về lý thuyết bằng `Total − Valid`, nhưng lưu cả ba thì
màn danh sách lớp hiển thị thẳng không phải trừ, và nếu lệch thì biết ngay là
dữ liệu có vấn đề.

Phía tính toán: một câu `UPDATE ... FROM (SELECT ... GROUP BY ...)` chạy trọn
trong Postgres, không kéo phiếu về bộ nhớ.

---

## 5. Câu hỏi cần chốt

### Nhóm A — lọc nhiễu

| # | Câu hỏi |
|---|---|
| A-a | Cột thời gian tối thiểu đặt ở bảng nào: `SemesterSurveys` (cả đợt dùng chung một bộ nên số câu như nhau, tiết kiệm) hay `CourseSectionSurveys` (cho phép chỉnh riêng từng lớp)? |
| A-b | Lấy mốc bắt đầu làm bài theo cách nào: (a) client tự đếm, (b) vé có ký của server, (c) lưu dòng "đã mở phiếu" xuống DB? |
| A-c | Hằng số 5 giây/câu: cố định trong mã nguồn, hay cho admin sửa được? |
| A-d | Thời gian tối thiểu tính trên **tất cả** câu hỏi hay chỉ câu chọn mức (bỏ câu tự nhập)? |
| A-e | Một bộ câu hỏi được đặt **bao nhiêu** câu bẫy? Một câu, hay nhiều câu tuỳ ý? |
| A-f | Sai câu bẫy thì lọc ngay, hay phải sai **quá n câu bẫy** mới lọc? |
| A-g | Một phiếu dính **nhiều** lỗi cùng lúc thì `RejectionReason` lưu lỗi đầu tiên gặp, hay lưu hết? |
| A-h | Admin có cần màn hình xem danh sách phiếu bị lọc kèm lý do không? |

### Nhóm B — chặn nộp trùng

| # | Câu hỏi |
|---|---|
| B-a | Lấy thông tin máy từ đâu: IP + User-Agent băm lại, mã ngẫu nhiên lưu `localStorage`, hay cả hai? |
| B-b | Chặn theo phạm vi nào: một máy chỉ nộp 1 phiếu cho **1 lớp**, hay cho cả **đợt khảo sát**? |
| B-c | Máy dùng chung (phòng máy, máy mượn) xử lý sao: chặn cứng, cảnh báo nhưng vẫn cho nộp, hay admin gỡ chặn thủ công? |
| B-d | Chặn cứng (trả lỗi, không nhận phiếu) hay vẫn nhận nhưng đánh dấu để lọc — tức là gộp luôn vào cơ chế `IsValid` của nhóm A? |
| B-e | Câu chữ "ẩn danh" trên giao diện sửa thành gì? |

### Nhóm C — điểm và thống kê

| # | Câu hỏi |
|---|---|
| C-a | Dùng luôn `SurveyResponses.Score`, hay muốn cột mới tách bạch? |
| C-b | Nút "Tính điểm trung bình" đặt ở đâu và tính phạm vi nào: một đợt khảo sát học kỳ, một học kỳ, hay toàn hệ thống? |
| C-c | Ai được bấm: dùng quyền `SurveyManage` đang có, hay cần quyền riêng? |
| C-d | Các báo cáo đang tính `AVG(Score)` trực tiếp trong `EfReportService` có chuyển sang đọc cột `AverageScore` mới không, hay giữ nguyên và cột mới chỉ phục vụ màn danh sách lớp? |
| C-e | `EfReportService` hiện gộp **mọi** phiếu. Sau khi có `IsValid`, toàn bộ báo cáo có phải lọc `IsValid = true` không? |

---

## 6. Tổng hợp thay đổi lược đồ dự kiến

Gộp lại để dễ hình dung khối lượng. **Chưa chốt, chưa code.**

### `SurveyQuestions`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `AttentionCheckValue` | integer | YES | A3 |

Ràng buộc kèm theo: chỉ khác `NULL` khi câu thuộc thang `Options`, và giá trị
phải là một mức có thật của thang đó.

### `SurveyResponses`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `IsValid` | boolean | NO, default true | A4 |
| `RejectionReason` | varchar(50) | YES | A4 |
| *(cột thông tin máy — tên và kiểu chờ chốt B-a)* | ? | ? | B |

### `CourseSectionSurveys`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `AverageScore` | numeric(4,2) | YES | C2 |
| `TotalResponseCount` | integer | NO, default 0 | C3 |
| `ValidResponseCount` | integer | NO, default 0 | C3 |
| `InvalidResponseCount` | integer | NO, default 0 | C3 |
| `ScoreCalculatedAt` | timestamptz | YES | C2 |

### `SemesterSurveys` *(hoặc `CourseSectionSurveys`, chờ chốt A-a)*

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `MinimumDurationSeconds` | integer | NO | A1 |

### Việc kéo theo, không phải thêm cột

- `ComputeScore` loại thêm câu bẫy độ tập trung (C1)
- `EfReportService` lọc `IsValid = true` (chờ chốt C-e)
- Trình soạn bộ câu hỏi thêm ô nhập mức đáp án bắt buộc cho từng câu (A3)
- File Excel mẫu và trình import thêm một cột nữa cho mức đáp án bắt buộc (A3)
- Sửa câu chữ "ẩn danh" trên giao diện phiếu (B)
- Endpoint + nút bấm tính điểm trung bình theo mẻ (C2)

---

## 7. Yêu cầu tiếp theo

_(chờ bạn mô tả thêm)_

---

## 8. Nhật ký

| Ngày | Nội dung |
|---|---|
| 2026-08-20 | Đã xong: chuyển thang trả lời từ cấp bộ câu hỏi xuống từng câu hỏi, thêm thang loại `Text`, đổi `SurveyResponseAnswers.SelectedValue` (int) → `AnswerValue` (text). Migration `20260820075102_MoveAnswerScaleToQuestionAndTextAnswers`. |
| 2026-08-20 | Nhận yêu cầu chặn nộp trùng, điểm mỗi lượt, điểm trung bình lớp. Lập file kế hoạch. |
| 2026-08-20 | Nhận yêu cầu lọc nhiễu (thời gian tối thiểu, phiếu một mức, câu bẫy độ tập trung) và đếm phiếu hợp lệ/không hợp lệ. Sắp xếp lại toàn bộ thành nhóm A/B/C. Chưa code. |
