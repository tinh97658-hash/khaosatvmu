# Nhóm A — Lọc nhiễu phiếu trả lời

Todo list thực thi cho nhóm A trong [congviec.md](../../congviec.md).
Cập nhật ô `[ ]` → `[x]` khi xong từng việc.

- Nhánh: `hoang2`
- Bắt đầu: 2026-08-20

## 1. Chốt lại các quyết định

Ghi gọn ở đây để lúc code khỏi phải lật lại file kế hoạch.

| Điểm | Đã chốt |
| :--- | :--- |
| Thời gian tối thiểu | `4 giây × tổng số câu của bài`, kể cả câu Text và câu bẫy |
| Hằng số 4 giây | Viết cứng trong mã, không cấu hình, không lưu CSDL |
| Mốc bắt đầu | Vé ký HMAC, phát khi bấm "Bắt đầu làm bài" |
| Vé | Không lưu CSDL, không hạn dùng, bấm lại bao nhiêu lần cũng được |
| Câu bẫy | Bao nhiêu câu cũng được; **sai một câu là lọc ngay** |
| Câu bẫy và câu Text | Không tính vào `SurveyResponses.Score` |
| A2 chỉ chọn một mức | Chỉ xét câu thang `Options` **không phải** câu bẫy |
| Lý do lọc | Lưu hết, ngăn cách dấu phẩy |
| Báo sinh viên | **Không báo.** Nhận phiếu bình thường rồi lặng lẽ đánh dấu |
| Phiếu vẫn tính lượt | Bị lọc vẫn là một lượt nộp, chỉ không vào điểm trung bình |

Ba mã lý do: `TOO_FAST`, `SINGLE_ANSWER`, `ATTENTION_CHECK_FAILED`.

## 2. Danh sách việc

### Nhóm A1 — Cơ sở dữ liệu

- [x] A1-1. `SurveyModels.cs`: thêm `SurveyQuestion.AttentionCheckValue` (`int?`)
- [x] A1-2. `SurveyModels.cs`: thêm `SurveyResponse.IsValid` (`bool`) và
      `SurveyResponse.RejectionReasons` (`string?`)
- [x] A1-3. `AppDbContext.cs`: cấu hình 3 cột, `RejectionReasons` dài 200,
      `IsValid` mặc định `true`
- [x] A1-4. Migration `AddSurveyResponseFilteringColumns`, đủ `Up` và `Down`,
      phiếu cũ mặc định `IsValid = true`
- [x] A1-5. Apply migration, đối chiếu schema dưới CSDL

### Nhóm A2 — Lớp lọc nhiễu (thuần, test được không cần CSDL)

- [x] A2-1. Tạo `Application/Surveys/ResponseFilter.cs`: hằng
      `SecondsPerQuestion = 4`, mã lý do, hàm `Evaluate(...)` nhận danh sách câu
      trả lời + siêu dữ liệu câu hỏi + số giây làm bài, trả `(bool IsValid,
      string? Reasons)`
- [x] A2-2. Luật `TOO_FAST`: `số giây < 4 × tổng số câu`
- [x] A2-3. Luật `SINGLE_ANSWER`: chỉ xét câu `Options` không phải bẫy; có từ 2
      câu trở lên mà tất cả cùng một mức thì lọc
- [x] A2-4. Luật `ATTENTION_CHECK_FAILED`: sai một câu bẫy là lọc
- [x] A2-5. Ghép nhiều lý do bằng dấu phẩy theo thứ tự cố định
- [x] A2-6. Unit test cho từng luật và các ca ghép nhiều lý do

### Nhóm A3 — Vé bắt đầu làm bài

- [x] A3-1. Tạo `SurveyStartTicket`: ký HMAC-SHA256, nội dung gồm `LinkToken` và
      mốc thời gian phát, khóa đọc từ cấu hình `SurveyTicket:SigningKey`
- [x] A3-2. Vé phải gắn `LinkToken`, xin vé lớp A không dùng nộp lớp B được
- [x] A3-3. Thêm khóa ký vào `.env` và `.env.example`, **không commit khóa thật**
- [x] A3-4. Endpoint công khai `POST /api/public/surveys/{linkToken}/start` trong
      `publicGroup`, trả vé, có giới hạn tần suất
- [x] A3-5. Endpoint nộp bài nhận thêm vé, đọc mốc thời gian ra để tính số giây
- [x] A3-6. Vé không đọc được thì coi số giây làm bài bằng 0, để luật `TOO_FAST`
      tự bắt. Áp dụng chung cho cả ba ca: thiếu vé, sai chữ ký, sai `LinkToken`
- [x] A3-7. Unit test cho ký và kiểm vé

### Nhóm A4 — Nối vào luồng nộp bài

- [x] A4-1. `SubmitSurveyResponseCommand` nhận thêm vé
- [x] A4-2. `SubmitSurveyResponseAsync` gọi lớp lọc, ghi `IsValid` và
      `RejectionReasons` vào phiếu
- [x] A4-3. Sửa `ComputeScore` loại thêm câu bẫy khỏi phép trung bình
      (câu Text đã loại sẵn)
- [x] A4-4. Phiếu bị lọc vẫn trả về `SubmitSurveyResponseDto` như bình thường,
      **không lộ kết quả lọc ra ngoài**

### Nhóm A5 — Soạn câu bẫy trong bộ câu hỏi

- [x] A5-1. `SaveSurveyQuestionCommand` nhận thêm `AttentionCheckValue`
- [x] A5-2. `ValidateTemplateAsync`: chỉ cho đặt bẫy trên câu thang `Options`,
      và giá trị phải là một mức có thật của chính thang đó
- [x] A5-3. Mã lỗi mới cho hai trường hợp trên
- [x] A5-4. `SurveyEndpoints.cs`: request record và ánh xạ
- [x] A5-5. DTO đọc ra cũng phải trả `AttentionCheckValue` để giao diện hiển thị

### Nhóm A6 — Frontend: luồng phiếu ba màn

- [x] A6-1. `PublicSurveyPage.tsx` tách thành ba trạng thái trong cùng component:
      màn mở đầu, màn làm bài, màn đã nộp. Không thêm route mới
- [x] A6-2. Màn mở đầu hiện: dòng nhắc đọc kỹ (trên cùng), tên bộ câu hỏi, mã và
      tên học phần, tên lớp, tên giảng viên, học kỳ và năm học, số câu hỏi,
      khoảng thời gian phiếu mở, cam kết ẩn danh, nút **Bắt đầu làm bài**
- [x] A6-3. **Không hiện con số thời gian tối thiểu** dưới bất kỳ dạng nào
- [x] A6-4. Bấm "Bắt đầu làm bài" gọi endpoint phát vé, nhận vé rồi mới sang màn
      làm bài
- [x] A6-5. Lưu vé vào `localStorage` **cùng một ô** với bài làm dở đang có
- [x] A6-6. Mở lại mà thấy có bài dở kèm vé thì vào thẳng màn làm bài
- [x] A6-7. Hộp thoại xác nhận trước khi nộp, dùng lại `ConfirmDialog`
- [x] A6-8. Nộp xong xoá cả vé lẫn bài dở khỏi `localStorage`

### Nhóm A7 — Frontend: trình soạn và import Excel

- [x] A7-1. `SurveyTemplatesPage.tsx`: ô nhập mức đáp án bắt buộc cho từng câu,
      chỉ bật khi câu đó dùng thang `Options`
- [x] A7-2. `surveyTemplateImportExcel.ts`: thêm cột mức đáp án bắt buộc vào tệp
      mẫu và phần đọc tệp
- [x] A7-3. `SurveyTemplateImportDialog.tsx`: cột mới trong bảng xem trước

### Nhóm A8 — Frontend: màn admin xem phiếu bị lọc

- [x] A8-1. DTO phiếu trả lời trả thêm `IsValid` và `RejectionReasons`
- [x] A8-2. `SectionSurveyResponsesPage.tsx`: cột trạng thái hợp lệ / bị lọc
- [x] A8-3. Cột lý do, dịch mã sang tiếng Việt, **không phơi mã `TOO_FAST`**
- [x] A8-4. Bộ lọc xem riêng nhóm bị lọc
- [x] A8-5. Dòng bị lọc bôi khác màu cho dễ thấy

### Nhóm A9 — Kiểm thử

- [x] A9-1. `dotnet build` sạch
- [x] A9-2. `dotnet test` toàn bộ pass
- [x] A9-3. `npx tsc -b` và `npx oxlint` sạch
- [ ] A9-4. Chạy thử: nộp nhanh, nộp toàn một mức, sai câu bẫy, phiếu sạch

## 3. Đã chốt: vé không đọc được thì coi như 0 giây

Ba trường hợp — thiếu vé, sai chữ ký, vé của lớp khác — xử lý **giống hệt nhau**:
số giây làm bài tính bằng 0, luật `TOO_FAST` tự bắt, phiếu vẫn được nhận và vẫn
tính là một lượt nộp.

Chọn cách này vì nó không cần thêm gì cả: không mã lỗi mới, không màn báo lỗi ở
frontend, không đường phục hồi phải nghĩ thêm. Cả ba ca gộp một nhánh:

```csharp
var elapsedSeconds = ticket.TryRead(linkToken, out var issuedAt)
    ? (now - issuedAt).TotalSeconds
    : 0;
```

Người chỉnh mốc thời gian trong DevTools vẫn bị lọc vì chữ ký hỏng. Người trung
thực gặp sự cố (Safari chế độ riêng tư chặn `localStorage`, đổi khoá ký giữa đợt
khảo sát) chỉ mất phiếu khỏi điểm trung bình chứ không mất bài đã làm, và cũng
không được báo gì — đúng quyết định A-l.

## 4. Việc cố ý không làm trong nhóm A

- Toàn bộ nhóm B (chặn nộp trùng) — đã hoãn.
- Nhóm C (điểm trung bình lớp, trang thống kê) — làm sau khi xong nhóm A.
- Không tự chạy lại kết quả lọc cho phiếu cũ khi sau này sửa câu bẫy hoặc đổi
  hằng số 4 giây. Kết quả lọc là ảnh chụp tại thời điểm nộp.
