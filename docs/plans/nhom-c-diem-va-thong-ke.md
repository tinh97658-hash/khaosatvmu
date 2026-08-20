# Nhóm C — Điểm trung bình và trang thống kê

Todo list thực thi cho nhóm C trong [congviec.md](../../congviec.md).
Nhóm A đã xong, xem [nhom-a-loc-nhieu-phieu.md](nhom-a-loc-nhieu-phieu.md).

- Nhánh: `hoang2`
- Bắt đầu: 2026-08-21

## 1. Hai bước đã xong từ trước

| Bước | Làm ở đâu |
| :--- | :--- |
| C-bước 2. `ComputeScore` loại câu bẫy | Nhóm A, cụm A4 |
| C-bước 7. Rà `EfReportService` thêm `IsValid` | Làm sớm vì để lệch số thì hai màn hình cho hai con số khác nhau |

Bước 7 đã rà 12 chỗ gộp phiếu, tách theo quyết định C-e: số về chất lượng chỉ
gộp phiếu `IsValid`, số về tiến độ thu phiếu đếm hết. Câu bẫy cũng đã bị loại
khỏi phân tích theo câu hỏi ở 4 chỗ nạp `SurveyQuestions`.

## 2. Chốt lại các quyết định

| Điểm | Đã chốt |
| :--- | :--- |
| Điểm mỗi lượt | Dùng luôn `SurveyResponses.Score`, không tạo cột mới |
| Điểm trung bình lớp | Cột mới trên `CourseSectionSurveys`, tính theo mẻ khi bấm nút |
| Khi tính | Chỉ gộp phiếu `IsValid = true` |
| Cách tính | Một câu `UPDATE ... FROM (SELECT ... GROUP BY ...)` chạy trọn trong Postgres |
| Quyền | `REPORTS_ACCESS` (`AuthPolicies.ReportsAccess`) |
| Trang | Làm hẳn trang mới, không nhét nút vào trang cũ |
| Báo cáo đọc gì | Vẫn tự tính như hiện nay; cột mới chỉ phục vụ trang thống kê và danh sách lớp |
| Chỗ nào hiện `AverageScore` | Phải hiện kèm `ScoreCalculatedAt` |
| Số ý kiến mở | Chỉ đếm ô "Ý kiến khác" cuối phiếu, không đếm câu thang Text |
| Cột C | Chỉ sinh cho câu thang `Options` và không phải câu bẫy |

## 3. Danh sách việc

### Nhóm C1 — Năm cột đếm trên `CourseSectionSurveys`

- [x] C1-1. `SurveyModels.cs`: thêm `AverageScore`, `TotalResponseCount`,
      `ValidResponseCount`, `InvalidResponseCount`, `ScoreCalculatedAt`
- [x] C1-2. `AppDbContext.cs`: `AverageScore` kiểu `numeric(4,2)`, ba cột đếm
      mặc định 0
- [x] C1-3. Migration `AddCourseSectionSurveyScoreColumns`, đủ `Up` và `Down`
- [x] C1-4. Apply migration, đối chiếu schema dưới CSDL

### Nhóm C2 — Tính lại theo mẻ

- [x] C2-1. Hàm `RecalculateSemesterSurveyScoresAsync(semesterSurveyId)` chạy
      bằng một câu `UPDATE ... FROM` duy nhất, không kéo phiếu về bộ nhớ
- [x] C2-2. Lớp không có phiếu nào cũng phải về 0 chứ không giữ số cũ
- [x] C2-3. Trả về số lớp đã cập nhật và thời điểm tính
- [x] C2-4. Endpoint `POST /api/surveys/semester-surveys/{id}/recalculate-scores`
      gắn chính sách `ReportsAccess`, có `RequireAntiforgeryFilter`

### Nhóm C3 — Số liệu bảng thống kê còn thiếu

- [x] C3-1. DTO `SectionStatisticsRowDto`: một dòng của bảng C4
- [x] C3-2. Câu yếu nhất của từng lớp và điểm của nó
- [x] C3-3. Số phiếu có điền ô "Ý kiến khác"
- [x] C3-4. Danh sách cột C sinh theo bộ câu hỏi của đợt, bỏ câu bẫy và câu Text
- [x] C3-5. Endpoint đọc bảng thống kê theo đợt khảo sát

### Nhóm C4 — Trang thống kê cho admin

- [x] C4-1. Trang mới `SurveyStatisticsPage.tsx`: chọn học kỳ và đợt khảo sát
- [x] C4-2. Nút "Tính lại điểm" gọi endpoint theo mẻ, hiện số lớp đã cập nhật
- [x] C4-3. Bảng dữ liệu các lớp, số cột C sinh động theo bộ câu hỏi
- [x] C4-4. Cuộn ngang và ghim các cột đầu vì bảng rất rộng
- [x] C4-5. Hiện `ScoreCalculatedAt` kèm điểm, cảnh báo khi có phiếu mới về sau
      lần tính gần nhất
- [x] C4-6. Thêm mục vào `Sidebar.tsx` và khai báo route trong `App.tsx`
- [x] C4-7. Chỉ hiện mục này cho người có quyền `REPORTS_ACCESS`

### Nhóm C5 — Kiểm thử

- [x] C5-1. `dotnet build` sạch, `dotnet test` pass
- [x] C5-2. `npx tsc -b` và `npx oxlint` sạch
- [x] C5-3. Bấm tính lại rồi đối chiếu cột `AverageScore` với số tự tính từ SQL

## 4. Bảng dữ liệu của trang thống kê

Theo bản mô phỏng Excel, mỗi dòng là một lớp học phần.

| Cột | Lấy từ đâu | Loại số liệu |
| :--- | :--- | :--- |
| ID lớp | `CourseSections.CourseSectionId` | |
| Mã HP | `Courses.CourseCode` | |
| Bộ môn | `Departments.DepartmentName` | |
| Họ tên GV | `Lecturers.FullName` | |
| Sĩ số | `CourseSections.ClassSize` | |
| Số phiếu | `TotalResponseCount` | tiến độ, đếm hết |
| Tỷ lệ PH | Số phiếu chia sĩ số | tiến độ |
| C1…Cn | Điểm trung bình từng câu của lớp | chất lượng, chỉ phiếu hợp lệ |
| Điểm tổng hợp | `AverageScore` | chất lượng |
| Câu yếu nhất | Câu có điểm thấp nhất trong các cột C | chất lượng |
| Điểm câu yếu | Điểm của chính câu đó | chất lượng |
| Phiếu bị cờ | `InvalidResponseCount` | |
| Số ý kiến mở | Số phiếu có `AdditionalComments` khác rỗng | |

Hai cột đã bỏ theo yêu cầu: "% bất mãn" và "Đủ điều kiện công bố".

## 5. Việc cố ý không làm

- Nhóm B (chặn nộp trùng) vẫn hoãn.
- Không đổi `EfReportService` sang đọc cột `AverageScore`; báo cáo vẫn tự tính
  để luôn phản ánh dữ liệu tại thời điểm xem (quyết định C-d).
- Không tự chạy lại tính điểm khi có phiếu mới về; phải bấm nút.
