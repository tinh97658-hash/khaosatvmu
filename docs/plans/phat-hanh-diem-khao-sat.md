# Phát hành điểm khảo sát — thiết kế đã phân tích, tạm gác lại

> Trạng thái: **CHƯA LÀM.** Đã phân tích xong, chốt là chưa triển khai (06/09/2026).
> Ghi lại để khi nào cần thì đọc lại và sửa theo bối cảnh lúc đó.

## 1. Ý tưởng ban đầu

Thêm nút **Phát hành** cạnh nút **Tính lại điểm** ở trang Bảng dữ liệu khảo sát.
Kịch bản mong muốn:

1. Sinh viên làm bài, admin chưa bấm gì — không ai có số liệu.
2. Admin bấm *Tính lại điểm* lần 1, 2, 3… → **chỉ admin** thấy điểm và thống kê.
   Trưởng bộ môn và giảng viên vẫn trống.
3. Đến một lần nào đó (ví dụ lần 5), admin bấm **Phát hành** → trưởng bộ môn và
   giảng viên bắt đầu thấy số liệu **của lần 5**.
4. Admin tiếp tục tính lại lần 6, 7, 8 mà không phát hành → admin thấy số mới,
   hai hồ sơ kia **vẫn giữ số của lần 5**.
5. Lần 9 admin tính lại rồi phát hành → hai hồ sơ kia nhảy từ lần 5 sang lần 9.

## 2. Ràng buộc cốt lõi phải biết trước

**Hệ thống không lưu lịch sử các lần tính điểm.** Mỗi lần bấm *Tính lại điểm* ghi
đè lên chính chỗ cũ. Nên **không thể** chỉ lưu một mốc thời gian "đã phát hành ở
lần 5" rồi dựng lại số liệu lần 5 — lần 6 đã xoá mất nó.

Muốn hai hồ sơ nhìn hai con số khác nhau thì **bắt buộc phải có hai bản dữ liệu
song song**. Đây là lý do mọi phương án bên dưới đều xoay quanh việc sao chép.

## 3. Hiện trạng — "Tính lại điểm" đang đụng vào đâu

Xem `RecalculateSemesterSurveyScoresAsync` trong
`src/Backend/Infrastructure/Surveys/EfSurveyService.cs`. Ba câu SQL thô nằm trong
**một transaction**.

### Chỉ đọc

| Bảng | Đọc gì | Để làm gì |
|---|---|---|
| `SurveyScoringSettings` | `MinimumResponseRate`, `MinimumValidRate` | hai ngưỡng của vòng lọc |
| `SemesterSurveys` | tồn tại hay không | chặn đợt không có thật |
| `CourseSections` | `ClassSize` | mẫu số của tỷ lệ phản hồi |
| `SurveyResponses` | `Score`, `IsValid`, `IsDeleted` | điểm và số đếm phiếu |
| `SurveyResponseAnswers` | `AnswerValue` | điểm từng câu |
| `SurveyQuestions` | `AttentionCheckValue` | loại câu bẫy ra |
| `AnswerScales` | `ScaleKind` | chỉ lấy câu thang `Options` |

### Ghi — đúng hai bảng

**`CourseSectionSurveys`** — UPDATE 5 cột cho **mọi** lớp của đợt (`LEFT JOIN` nên
lớp chưa có phiếu nào cũng được ghi về 0 thay vì giữ số cũ):

| Cột | Giá trị mới |
|---|---|
| `TotalResponseCount` | mọi lượt nộp chưa xoá |
| `ValidResponseCount` | phần qua bộ lọc nhiễu |
| `InvalidResponseCount` | tổng − hợp lệ |
| `AverageScore` | `avg(Score)` của phiếu hợp lệ **nếu** qua cả hai ngưỡng, không thì **NULL** |
| `ScoreCalculatedAt` | thời điểm bấm |

Ba cột đếm ghi cho mọi lớp. Riêng `AverageScore` chỉ ghi cho lớp đủ điều kiện;
lớp chưa đủ bị **ghi đè về NULL** kể cả khi lần trước đang có điểm.

**`CourseSectionSurveyQuestionScores`** — XOÁ TRẮNG mọi dòng của đợt rồi
`INSERT ... SELECT` lại `(CourseSectionSurveyId, QuestionId, AverageScore, AnswerCount)`.
Chỉ sinh dòng cho lớp vừa được ghi `AverageScore IS NOT NULL`, chỉ gộp phiếu
`IsValid`, bỏ câu bẫy và câu tự nhập.

Xoá trắng thay vì UPSERT là cố ý: câu bị gỡ khỏi bộ đề, hoặc lớp bị huỷ hết
phiếu, thì dòng cũ phải biến mất chứ không được đứng lại.

### Hai điều dễ hiểu nhầm

- **Recalc KHÔNG chấm lại bộ lọc nhiễu.** `SurveyResponses.IsValid` và `Score` do
  lúc sinh viên nộp bài tính; recalc chỉ đọc. Đổi ngưỡng thời gian mỗi câu không
  ảnh hưởng phiếu cũ dù bấm tính lại bao nhiêu lần.
- Ngoài cơ sở dữ liệu còn một tác động: `schoolOverviewCache.Bump()` để dọn cache
  tổng quan 90 giây.

## 4. Thiết kế đã chốt (nếu làm lại)

### 4.1 Lược đồ — 7 cột + 1 bảng

Phương án đầu là ba bảng mới; rút gọn lại còn **một**, vì hai bảng kia vốn đã có
sẵn đúng một dòng cho mỗi đối tượng nên chỉ cần thêm cột, **không sinh dòng nào**.

Thêm vào `CourseSectionSurveys` (0 dòng mới):

```
PublishedAverageScore        numeric(4,2) NULL
PublishedTotalResponseCount  int NOT NULL DEFAULT 0
PublishedValidResponseCount  int NOT NULL DEFAULT 0
PublishedScoreCalculatedAt   timestamptz NULL
```

Thêm vào `SemesterSurveys` (0 dòng mới):

```
ScorePublishedAt                 timestamptz NULL
ScorePublishedByUserId           uuid NULL
ScorePublishedSourceCalculatedAt timestamptz NULL
```

Bảng mới duy nhất:

```
PublishedQuestionScores
  CourseSectionSurveyId int  ┐ PK, FK -> CourseSectionSurveys ON DELETE CASCADE
  QuestionId            int  ┘
  AverageScore          numeric(4,2) NOT NULL
  AnswerCount           int NOT NULL
```

**Vì sao điểm từng câu bắt buộc phải tách bảng, không gộp cột được:** tập *dòng*
của `CourseSectionSurveyQuestionScores` đổi giữa các lần tính — lớp rớt điều kiện
là recalc xoá hẳn dòng, mà bản đã phát hành thì phải giữ lại. Gộp cột thì phải
sửa recalc để không xoá dòng nữa mà chỉ null hoá, làm recalc rối hơn hẳn. Hai
bảng còn lại không có vấn đề này vì dòng của chúng không bao giờ mất.

### 4.2 Thao tác Phát hành

Một transaction, theo tập, phạm vi là **một đợt khảo sát**:

```sql
UPDATE "CourseSectionSurveys"
   SET "PublishedAverageScore"       = "AverageScore",
       "PublishedTotalResponseCount" = "TotalResponseCount",
       "PublishedValidResponseCount" = "ValidResponseCount",
       "PublishedScoreCalculatedAt"  = "ScoreCalculatedAt"
 WHERE "SemesterSurveyId" = @id AND NOT "IsDeleted";

DELETE FROM "PublishedQuestionScores" AS p
 USING "CourseSectionSurveys" AS c
 WHERE p."CourseSectionSurveyId" = c."CourseSectionSurveyId"
   AND c."SemesterSurveyId" = @id;

INSERT INTO "PublishedQuestionScores"
     ("CourseSectionSurveyId", "QuestionId", "AverageScore", "AnswerCount")
SELECT q."CourseSectionSurveyId", q."QuestionId", q."AverageScore", q."AnswerCount"
  FROM "CourseSectionSurveyQuestionScores" AS q
  JOIN "CourseSectionSurveys" AS c ON c."CourseSectionSurveyId" = q."CourseSectionSurveyId"
 WHERE c."SemesterSurveyId" = @id;

UPDATE "SemesterSurveys" SET "ScorePublishedAt" = @now, ... WHERE "SemesterSurveyId" = @id;
```

Nút này **không tính toán lại gì cả, chỉ sao chép** — nên chạy dưới một giây và
không có nguy cơ ra số khác với cái admin vừa xem.

Phát hành **đè lên** bản cũ của cùng đợt, không cộng dồn: bấm 100 lần vẫn đúng
chừng ấy dòng.

### 4.3 Mối nối đọc — chỗ tốn công nhất

Thêm `IScoreSource`, trả lời đúng một câu: *người đang gọi đọc bản làm việc hay
bản đã phát hành?* Quy tắc đề xuất: `scope.SeesEverything` (ADMIN, SURVEY_ADMIN)
→ bản làm việc; còn lại → bản đã phát hành.

Toàn hệ thống chỉ đọc ảnh chụp ở **8 chỗ**, đều đã được gom sẵn:

| File | Hàm |
|---|---|
| `Infrastructure/Reports/EfReportService.cs` | `ResponseTalliesAsync` |
| | `QuestionScoreSnapshotsAsync` |
| | `BuildQuestionRankingAsync` |
| | `GetSectionSurveyAnalysisAsync` |
| `Infrastructure/Surveys/EfSurveyService.cs` | `LoadAnalysedSectionsAsync` |
| | `GetSemesterSurveyStatisticsAsync` |
| | `GetSurveyScopeAnalysisAsync` |
| | `BuildCourseDiagnosisAsync` |

Tám chỗ này hỏi `IScoreSource` rồi chọn bảng. Không phải sờ vào từng trang.

### 4.4 Bốn thứ đi kèm, bỏ là hỏng

1. **Khoá cache phải kèm nguồn.** Khoá hiện tại là
   `v{version}:{semesterId}:survey:...` — **không có người dùng**. Giữ nguyên thì
   admin nạp trang trước, trưởng bộ môn vào sau ăn luôn cache đó, tức là **rò rỉ
   số chưa phát hành**. Phải thêm `:published` / `:working` vào khoá.
2. **Trạng thái "chưa phát hành" phải nói rõ.** Trước lần phát hành đầu, hai hồ sơ
   kia mở trang thấy bảng trống — trông y như hỏng. Cần cờ `IsPublished` trong DTO
   để giao diện hiện thông báo trên 5 trang: Bảng dữ liệu khảo sát, Thống kê chi
   tiết, Thống kê & Báo cáo, Tổng quan khảo sát, Bảng điều khiển.
3. **Tiến độ thu phiếu KHÔNG bị chặn.** Trang đó đếm phiếu sống và là công cụ đôn
   đốc sinh viên — chặn thì trưởng bộ môn không biết lớp nào cần nhắc.
4. **Giao diện nút.** Cạnh *Tính lại điểm* thêm *Phát hành*, kèm dòng trạng thái:
   *"Tính lần cuối 14:32 · Phát hành lần cuối 09:15 — có số liệu mới chưa phát
   hành"*. Không có dòng này thì chính admin cũng không biết mình đã phát hành cái gì.

### 4.5 Ai thấy gì

| Hồ sơ | Quyền hiện có | Sau khi làm |
|---|---|---|
| ADMIN, SURVEY_ADMIN | đủ | bản làm việc, thấy ngay sau mỗi lần tính |
| DEPARTMENT_MANAGER | REPORTS, ANALYSIS, DASHBOARD, STATISTICS, PROGRESS | bản đã phát hành + Tiến độ (sống) |
| LECTURER | ANALYSIS, PROGRESS | bản đã phát hành + Tiến độ (sống) |

### 4.6 Ước lượng dung lượng (đo thật ngày 06/09/2026)

| Đợt | Lớp | Lớp đã chốt điểm | Câu chấm điểm | Dòng điểm từng câu |
|---|---|---|---|---|
| 2 — Khảo sát kết thúc học phần | 1.830 | 1.630 | 29 | 47.270 |
| 53 — Khảo sát thử | 142 | 0 | 29 | 0 |

Bấm Phát hành sinh ra **47.270 dòng** (chỉ ở `PublishedQuestionScores`; hai bảng
kia 0 dòng mới). Dung lượng ~**7 MB**, trên nền cơ sở dữ liệu 251 MB — tức
**2,8%**. Riêng `SurveyResponseAnswers` đã chiếm 214 MB (85%).

Mức tăng bám theo **số đợt**, không theo số lần bấm. Ước 2 đợt/kỳ × 2 kỳ/năm ≈
**28 MB/năm**.

### 4.7 Năm câu chưa chốt

1. Có nút **Thu hồi phát hành** không? Hiện thiết kế không rút lại được, chỉ còn
   cách phát hành đè bằng số khác.
2. `SURVEY_ADMIN` có được bấm Phát hành như `ADMIN`, hay chỉ `ADMIN`?
3. Trưởng bộ môn đang mở được **Bảng dữ liệu khảo sát** (có `SURVEY_STATISTICS_ACCESS`).
   Cho họ xem bản đã phát hành, hay ẩn hẳn trang khỏi hồ sơ đó?
4. Phạm vi phát hành theo **từng đợt khảo sát** — mỗi đợt một trạng thái riêng.
5. Làm chung với việc lọc phạm vi ở `EfReportService` hay tách ra?

## 5. Vì sao tạm gác lại

Quyết định ngày 06/09/2026: **không làm**, vì hai lý do.

**Thứ nhất, thứ nguy hiểm mà nút phát hành định chặn thì hệ thống đã chặn rồi.**
Hai vòng lọc ngưỡng khiến lớp chưa thu đủ phiếu không có điểm — `AverageScore` để
NULL, mọi trang đọc ra "chưa đủ điều kiện". Tình huống đáng sợ nhất, kiểu giảng
viên mở ra thấy 2.10 từ 3 phiếu rồi hoảng, vốn đã không xảy ra được. Lớp nào hiện
ra điểm thì đã qua ≥50% tỷ lệ phản hồi và ≥80% phiếu hợp lệ.

**Thứ hai, giá thật không nằm ở 47.270 dòng mà ở vận hành:**

- Một thao tác thủ công phải nhớ. Admin quên bấm thì hai hồ sơ kia thấy trống
  trơn, và họ sẽ báo là lỗi hệ thống chứ không đoán ra là chưa phát hành.
- Hai con số cùng tồn tại. Trưởng khoa thấy 3.72, trưởng bộ môn thấy 3.65, không
  ai giải thích được vì sao — trong khi cả hai đều đúng.
- Trưởng bộ môn và giảng viên luôn cập nhật chậm hơn admin. Đó là mục đích của
  tính năng, nhưng cũng là điều gây khó chịu nhất khi dùng.
- 8 chỗ đọc phải đi qua mối nối mới, 5 trang phải có trạng thái rỗng, khoá cache
  phải sửa. Mọi báo cáo viết về sau đều phải nhớ quy tắc này.

Đổi lại chỉ được một thứ: quyền duyệt trước khi số đến tay giảng viên. Nếu Phòng
Đảm bảo chất lượng **không** có yêu cầu đó bằng văn bản thì không đáng.

## 6. Hai phương án thay thế

**A. Không làm gì thêm.** Ai cũng thấy lần tính gần nhất; ngưỡng lọc là lớp bảo
vệ duy nhất. Chi phí bằng không.

**B. Khoá theo `EndTime`.** Chỉ mở điểm cho trưởng bộ môn và giảng viên **sau khi
đợt khảo sát đóng**. Đang thu phiếu thì hai hồ sơ đó chỉ thấy Tiến độ thu phiếu.

So với nút phát hành:

- Không có thao tác thủ công nào, không quên được.
- Sau `EndTime` không còn phiếu mới, nên các lần admin bấm tính lại đều ra cùng
  kết quả — **độ trễ bằng không**.
- Sửa đúng một chỗ: điều kiện lọc theo `EndTime` + vai trò, không đụng lược đồ.
- Nhược điểm: admin không chủ động chọn được thời điểm.

## 7. Việc còn treo, độc lập với quyết định trên

`EfReportService` **không có `IUserScopeResolver`** — không lọc theo đơn vị ở bất
kỳ endpoint nào, trong khi `EfSurveyService` lọc ở 8 chỗ. Mà `DEPARTMENT_MANAGER`
có `REPORTS_ACCESS`.

Hệ quả: trưởng bộ môn mở **Thống kê & Báo cáo → Tra cứu chi tiết** đang thấy từng
lớp của **cả trường**, kèm tên giảng viên và điểm của họ.

Một phần có thể là cố ý — mặt bằng toàn trường phải tính trên toàn bộ dữ liệu thì
trưởng bộ môn mới có cái mà so (xem ghi chú ở `DepartmentDashboardDto`). Nhưng
bảng chi tiết từng lớp thì khác: đó là dữ liệu chi tiết, không phải mặt bằng.

Nếu xử lý, khoá cache tổng quan cũng phải kèm phạm vi người dùng — cùng lý do ở
mục 4.4.
