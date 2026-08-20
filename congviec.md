# Kế hoạch công việc

File này ghi dần các yêu cầu và cách sẽ làm. **Chưa code gì cả** cho tới khi có
yêu cầu rõ ràng.

- Nhánh: `hoang2`
- Cập nhật lần cuối: 2026-08-20

---

## 1. Đang có sẵn những gì

Phần này ghi lại hiện trạng để lát nữa bàn yêu cầu mới thì có cái mà đối chiếu,
và để không làm trùng những thứ đã có.

### Bảng lượt làm khảo sát `SurveyResponses`

Mỗi lần một sinh viên bấm nộp bài thì sinh ra đúng một dòng ở đây.

| Cột | Kiểu | Null |
|---|---|---|
| `ResponseId` | integer | NO (PK) |
| `CourseSectionSurveyId` | integer | NO (FK → `CourseSectionSurveys`, CASCADE) |
| `AdditionalComments` | text | YES |
| `Score` | numeric(4,2) | NO |
| `SubmittedAt` | timestamptz | NO |

### Bảng bài khảo sát riêng mỗi lớp `CourseSectionSurveys`

| Cột | Kiểu | Null |
|---|---|---|
| `CourseSectionSurveyId` | integer | NO (PK) |
| `SemesterSurveyId` | integer | NO (FK, CASCADE) |
| `CourseSectionId` | integer | NO (FK, CASCADE) |
| `LinkToken` | text | NO (UNIQUE) |
| `StartTime` / `EndTime` | timestamptz | NO (CHECK `EndTime > StartTime`) |
| `CreatedAt` | timestamptz | NO |
| `IsDeleted` / `DeletedAt` | boolean / timestamptz | NO / YES |

Có một chỗ cần đính chính lại so với lúc anh mô tả yêu cầu. Bảng này **chưa hề
có cột lượt làm nào cả**. Con số lượt làm mà anh đang nhìn thấy trên giao diện
là hệ thống đếm tại chỗ mỗi lần gọi API, đếm xong trả về rồi thôi, không lưu
xuống cơ sở dữ liệu. Cho nên phần C3 bên dưới sẽ là thêm mới cả ba cột đếm, chứ
không phải là "đã có cột lượt làm rồi giờ thêm hai cột nữa".

### Bảng câu hỏi `SurveyQuestions`

| Cột | Kiểu | Null |
|---|---|---|
| `QuestionId` | integer | NO (PK) |
| `SurveyTemplateId` | integer | NO (FK, CASCADE) |
| `QuestionText` | text | NO |
| `AnswerScaleId` | integer | NO (FK → `AnswerScales`, RESTRICT) |

### Điểm đang được tính như thế nào

Hàm `ComputeScore` trong
[EfSurveyService.cs](src/Backend/Infrastructure/Surveys/EfSurveyService.cs) lấy
trung bình cộng của các câu thuộc thang có mức chọn sẵn. Câu thuộc thang tự nhập
chữ đã bị loại ra rồi, không tham gia vào phép tính.

### Chống spam thì hiện đang có gì

Hiện mới chỉ có giới hạn tần suất gọi API thôi: mỗi địa chỉ IP chỉ được nộp tối
đa 10 lượt trong một phút, và endpoint xem phiếu thì giới hạn 800 request chạy
cùng lúc. Cả hai đều nằm ở
[Program.cs](src/Backend/API/Program.cs#L71-L80).

Còn chuyện chặn một người nộp nhiều phiếu cho cùng một lớp thì **chưa có gì
hết**. Thêm nữa, endpoint xem phiếu công khai đang được cache 15 phút theo
`LinkToken`, mà cả lớp thì dùng chung đúng một token — chi tiết này sẽ ảnh hưởng
tới phần A1 nên nhắc trước ở đây.

---

## 2. Nhóm A — Lọc nhiễu phiếu trả lời

Ý tưởng chung là: phiếu làm ẩu thì vẫn nhận, vẫn tính là một lượt nộp như bình
thường, nhưng đánh dấu lại để sau này không cho nó tham gia vào điểm trung bình
của lớp.

Đúng như anh chốt: ba mươi lượt nộp thì vẫn cứ là ba mươi lượt, nếu năm phiếu
bị lọc thì khi tính điểm trung bình cho lớp chỉ lấy hai mươi lăm phiếu còn lại.

### A1. Bắt buộc làm bài đủ lâu

Cái này để chặn kiểu sinh viên không thèm đọc đề, cứ thế bấm chọn cho xong.

**Đã chốt:** bốn giây nhân với **tổng số câu của cả bài**, tính hết mọi câu kể
cả câu tự nhập và câu bẫy. Bộ ba mươi câu thì phải làm ít nhất một trăm hai
mươi giây. Con số bốn giây viết thẳng vào mã nguồn, không cho ai sửa qua giao
diện.

Một cái lợi bất ngờ của việc chốt như vậy: **không cần thêm cột nào để lưu thời
gian tối thiểu nữa.** Trước đó tôi định thêm `MinimumDurationSeconds` vào
`SemesterSurveys` hoặc `CourseSectionSurveys`, và còn treo câu hỏi A-a hỏi anh
nên đặt ở bảng nào. Giờ hằng số đã cố định trong mã, số câu thì đếm được từ bộ
câu hỏi, nên cứ nhân ra là có, khỏi lưu. Câu A-a coi như bỏ.

Cũng không sợ chuyện sau này sửa hằng số bốn giây thì các phiếu cũ bị tính lại,
vì kết quả lọc đã được ghi cứng vào từng phiếu ngay lúc nộp rồi.

Vấn đề đặt ra ban đầu là **hệ thống không biết sinh viên mở phiếu lúc nào**.
Endpoint cho sinh viên xem phiếu là endpoint ẩn danh, mở ra rồi đóng lại, không
ghi lại dấu vết gì, mà còn được cache chung mười lăm phút cho tất cả sinh viên
của cùng một lớp. Không có mốc bắt đầu thì lấy gì mà trừ ra để biết em ấy làm
bài mất bao lâu.

**Chốt hướng giải quyết: thiết kế lại luồng phiếu, thêm một màn hình mở đầu có
nút "Bắt đầu làm bài".** Chi tiết ở mục A1-b ngay dưới. Cú bấm nút đó chính là
mốc bắt đầu, và server sẽ phát cho sinh viên một "vé bắt đầu" có ký chữ ký điện
tử tại đúng thời điểm ấy. Lúc nộp bài thì gửi kèm vé lên, server đọc mốc thời
gian trong vé ra mà tính. Không cần thêm bảng nào, không lưu gì xuống cơ sở dữ
liệu, và sinh viên không sửa được vì không có khoá ký.

Hai cách còn lại đã cân nhắc rồi loại: để trình duyệt tự bấm giờ rồi gửi số giây
lên thì mở DevTools ra sửa mất vài giây, tức là không chặn được đúng nhóm cần
chặn; còn ghi một dòng xuống cơ sở dữ liệu mỗi lần có người mở phiếu thì chính
xác nhưng phải thêm bảng, mà lúc cao điểm cả nghìn sinh viên cùng vào thì thành
gánh nặng vô ích.

### A1-b. Thiết kế lại luồng phiếu khảo sát

Hiện tại quét mã QR hoặc mở link là ra thẳng danh sách câu hỏi. Đổi thành hai
bước:

**Bước một, màn hình mở đầu.** Hiện thông tin chung của bài khảo sát và bản cam
kết ẩn danh, cuối màn có nút **Bắt đầu làm bài**.

**Bước hai, màn hình làm bài.** Chính là giao diện đang có, chỉ hiện ra sau khi
đã bấm nút.

Đồng hồ chạy từ lúc bấm "Bắt đầu làm bài" cho tới lúc bấm nộp. Khi bấm nộp thì
hiện hộp thoại hỏi lại có chắc muốn nộp không, xác nhận xong mới thật sự gửi đi.

Cách này giải quyết được ba việc một lúc:

Thứ nhất, có được mốc bắt đầu bằng một hành động rõ ràng của người dùng, thay vì
phải suy ra một cách gián tiếp.

Thứ hai, màn hình mở đầu là chỗ hợp lý nhất để đặt cam kết ẩn danh, tức là giải
luôn câu B-e đang treo — chỗ để nói với sinh viên hệ thống lưu gì và không lưu
gì.

Thứ ba, cứu được cache. Tách làm hai endpoint thì phần nặng là nội dung câu hỏi
vẫn cache mười lăm phút như cũ, chỉ riêng cú bấm "Bắt đầu" mới gọi riêng và
không cache, vì mỗi sinh viên phải nhận một vé khác nhau.

Về cái hộp thoại xác nhận thì không phải xử lý gì thêm. Server tính từ lúc phát
vé cho tới lúc nhận được request nộp bài, nên hộp thoại tự nhiên đã nằm trong
khoảng đó rồi. Sinh viên có ngồi phân vân trước hộp thoại mười phút thì cũng chỉ
làm thời gian dài thêm ra, mà ta chỉ chặn ngưỡng dưới nên không ảnh hưởng gì.

Bốn điểm phải để ý khi làm:

**Vé bắt buộc phải gắn với `LinkToken` của lớp.** Không thì sinh viên xin vé ở
lớp A rồi đem dùng để nộp cho lớp B. Chữ ký phải bao cả token vào trong.

**Vé không lưu xuống cơ sở dữ liệu, và bấm "Bắt đầu làm bài" lại bao nhiêu lần
cũng được.** Đây là chốt của anh ở câu A-j và A-k. Server phát vé xong là quên
luôn, không giữ trạng thái gì; chỉ khi sinh viên nộp bài thì dữ liệu mới thật sự
được ghi xuống. Nhờ vậy bấm bắt đầu rồi máy sập, mất điện, hay bận việc đi đâu
đó thì cứ mở lại link bấm bắt đầu lần nữa là xong, không kẹt gì cả. Vé cũng
không có hạn dùng.

**Vé lưu vào `localStorage` chung một chỗ với bài làm dở.** Trang hiện đã lưu
bài làm dở vào `localStorage` rồi, giờ nhét vé vào cùng ô đó. Lý do phải để
chung: nếu tách hai chỗ thì có lúc bài làm dở còn mà vé mất, sinh viên mở lại
thấy đáp án cũ còn nguyên nhưng đồng hồ về không, bấm nộp phát là dính lọc nhiễu
dù đã làm nghiêm túc cả chục phút. Để chung một ô thì hai thứ sống chết cùng
nhau: còn thì còn cả hai, mất thì mất cả hai, và mất cả hai thì đúng là phải làm
lại từ đầu, hợp lý.

Cũng không lo sinh viên lợi dụng chuyện này để lách. Vé có chữ ký nên không giả
được; xoá vé đi thì phải xin vé mới, mà vé mới đồng nghĩa đồng hồ chạy lại từ
đầu, tức là thiệt cho chính em ấy chứ không lợi.

**Cách này chỉ chặn được người làm ẩu thật thà.** Ai cố tình thì bấm "Bắt đầu",
để đó đi làm việc khác, lát sau quay lại bấm loạn hai mươi giây rồi nộp, vẫn
qua như thường. Đây là giới hạn cố hữu của mọi cơ chế đo thời gian chứ không
phải do thiết kế này dở. Cái bắt được nhóm đó là **câu bẫy độ tập trung ở mục
A3**. Ghi ra đây để sau này khỏi kỳ vọng nhầm vào A1.

**Không hiện thời gian tối thiểu lên màn hình mở đầu.** Ghi rõ "bài này phải làm
ít nhất một trăm năm mươi giây" thì hoá ra chỉ dẫn cho sinh viên biết cần ngồi
chờ bao lâu là đủ. Ước lượng kiểu "khoảng năm tới bảy phút" cũng không ghi luôn,
vì suy ra ngưỡng thật cũng chẳng khó.

Thay vào đó chỉ cần một dòng nhắc ở trên cùng màn hình mở đầu, đại ý **đọc kỹ
từng câu hỏi trước khi trả lời**. Vừa đủ để sinh viên hiểu là phải làm nghiêm
túc, mà không hé ra con số nào để lách.

Màn hình mở đầu dự kiến hiện những gì:

| Nội dung | Ghi chú |
|---|---|
| Dòng nhắc đọc kỹ trước khi làm | Đặt trên cùng, không nêu con số thời gian nào |
| Tên bộ câu hỏi | |
| Mã và tên học phần, tên lớp | |
| Tên giảng viên | |
| Học kỳ và năm học | |
| Số câu hỏi | |
| Khoảng thời gian phiếu mở | Đang có sẵn `StartTime` và `EndTime` |
| Cam kết ẩn danh | Câu chữ tuỳ theo việc chốt nhóm B |
| Nút **Bắt đầu làm bài** | |

### A2. Loại phiếu chỉ chọn đúng một mức

Sinh viên chọn cùng một đáp án cho tất tần tật các câu, kiểu kéo thẳng một cột
từ trên xuống dưới, thì loại.

Chỗ này có một cái bẫy phải để ý, không thì làm xong lại hỏng đúng vào trường
hợp cần bắt nhất. Phép kiểm này **bắt buộc phải bỏ qua câu bẫy độ tập trung ở
mục A3 và các câu tự nhập chữ**. Lý do là thế này: giả sử một em chọn toàn mức 5
cho mọi câu nhưng vô tình làm đúng câu bẫy yêu cầu chọn mức 3, thì tập hợp đáp
án của em ấy là {5, 3}, tức là có hai giá trị khác nhau, và sẽ lọt qua lưới kiểm
tra "chỉ chọn một đáp án" một cách ngon lành. Vì vậy chỉ được xét trên các câu
hỏi bình thường thôi.

### A3. Câu hỏi bẫy để kiểm tra độ tập trung

Thêm một cột vào bảng `SurveyQuestions` để chứa mức đáp án bắt buộc. Cột này để
trống thì đó là câu hỏi bình thường, còn điền số 3 vào thì sinh viên phải chọn
đúng mức 3 thì phiếu mới được coi là hợp lệ.

Ví dụ câu hỏi sẽ viết là: *"Bạn hài lòng với sự nhiệt tình và trách nhiệm của
giảng viên trong quá trình giảng dạy (hãy chọn đáp án 3)"*. Cái đoạn "(hãy chọn
đáp án 3)" ấy chỉ là chữ nằm trong nội dung câu hỏi để sinh viên đọc mà làm
theo thôi. Lúc hệ thống lọc thì nó so với **con số nằm trong cột mới**, chứ
không đi đọc chữ trong câu hỏi.

**Đã chốt:** một bộ đặt bao nhiêu câu bẫy cũng được, không giới hạn, thực tế bộ
ba mươi câu thì chừng một đến ba câu là vừa. Và **chỉ cần sai một câu bẫy là lọc
ngay**, không cần sai nhiều câu mới tính.

Kéo theo hai chuyện.

Thứ nhất, câu bẫy sẽ **không được tính vào điểm trung bình** của phiếu, xử lý y
hệt như câu tự nhập chữ. Đúng như anh nói: nó ép người ta chọn một mức duy nhất
nên điểm của nó chẳng nói lên điều gì, giả sử cả lớp làm đúng hết thì câu đó
điểm tuyệt đối, kéo điểm chung lên một cách vô nghĩa.

Thứ hai, phải có ràng buộc kiểm tra: chỉ được đặt bẫy trên câu thuộc thang có
mức chọn sẵn, và con số điền vào phải là một mức có thật của chính thang đó.
Không thể đặt bẫy "phải chọn mức 3" cho một câu dùng thang Có/Không, vì thang đó
chỉ có mức 1 và mức 5, sinh viên có muốn làm đúng cũng chịu.

### A4. Ghi kết quả lọc vào phiếu

Việc lọc sẽ chạy ngay lúc sinh viên bấm nộp, xong thì ghi kết quả xuống phiếu
luôn.

| Cột | Kiểu | Null | Ý nghĩa |
|---|---|---|---|
| `IsValid` | boolean | NO, default true | `true` là qua lọc, được tính vào trung bình lớp |
| `RejectionReasons` | varchar(200) | YES | Các lý do bị lọc, để trống khi phiếu hợp lệ |

Cột lý do không nằm trong yêu cầu anh nêu ban đầu, đây là tôi đề xuất thêm và
anh đã đồng ý. Nếu chỉ có đúng một ô đúng/sai thì lúc admin nhìn vào thấy "năm
phiếu bị lọc" mà chịu, không biết là do làm quá nhanh, do chọn một mức, hay do
sai câu bẫy.

**Đã chốt là lưu hết mọi lý do**, không phải chỉ lý do gặp đầu tiên. Nên tôi
đổi tên cột thành số nhiều `RejectionReasons` và nới độ dài lên 200 ký tự, lưu
các mã ngăn cách bằng dấu phẩy, kiểu `TOO_FAST,SINGLE_ANSWER`. Ba mã dự kiến:
`TOO_FAST`, `SINGLE_ANSWER`, `ATTENTION_CHECK_FAILED`.

Một phiếu dính cả ba lỗi thì chuỗi dài nhất cũng chỉ khoảng sáu mươi ký tự, nên
200 là thừa sức kể cả sau này thêm loại lỗi mới.

**Sinh viên không được báo là phiếu bị lọc.** Anh đã chốt ở câu A-l: cứ nhận
bình thường, hiện màn hình cảm ơn như mọi phiếu khác, rồi lặng lẽ đánh dấu. Báo
thẳng ra thì người làm ẩu biết ngay là có cơ chế đo và sẽ tìm cách lách, lọc
nhiễu mất hết tác dụng.

Còn một đặc điểm anh nên biết trước, không phải để quyết bây giờ mà để sau này
khỏi bất ngờ: kết quả lọc là **ảnh chụp tại đúng thời điểm nộp bài**. Sau này
nếu có sửa câu bẫy hoặc đổi thời gian tối thiểu thì những phiếu đã nộp từ trước
vẫn giữ nguyên kết quả cũ, hệ thống không tự chạy lại để tính lại cho chúng.

### A5. Màn hình cho admin xem phiếu bị lọc

Anh đã chốt câu A-h là có. Việc này thực ra sửa trang đang có chứ không phải làm
mới hoàn toàn: trang
[SectionSurveyResponsesPage.tsx](src/Frontend/src/pages/SectionSurveyResponsesPage.tsx)
hiện đang liệt kê phiếu trả lời của một lớp rồi, chỉ cần thêm vào đó một cột
trạng thái hợp lệ hay bị lọc, một cột lý do, và một bộ lọc để xem riêng nhóm bị
lọc.

Vì đã chốt sinh viên không được báo gì, nên đây là chỗ duy nhất nhìn thấy được
kết quả lọc. Cần hiển thị lý do bằng tiếng Việt dễ đọc chứ không phơi mã
`TOO_FAST` ra màn hình.

### Các bước sẽ làm cho nhóm A

1. Thêm cột `AttentionCheckValue` vào `SurveyQuestions`, thêm hai cột `IsValid`
   và `RejectionReasons` vào `SurveyResponses`. Không cần cột thời gian tối
   thiểu nữa vì đã tính ra được. Sửa
   [SurveyModels.cs](src/Backend/Domain/SurveyModels.cs) và
   [AppDbContext.cs](src/Backend/Infrastructure/Persistence/AppDbContext.cs).
2. Viết migration đầy đủ, có `Up` và `Down`, phiếu cũ mặc định `IsValid = true`.
3. Sửa `SaveSurveyQuestionCommand` trong
   [SurveyContracts.cs](src/Backend/Application/Surveys/SurveyContracts.cs) để
   nhận thêm mức đáp án bắt buộc, và bổ sung phần kiểm tra tính hợp lệ của nó
   trong `ValidateTemplateAsync`.
4. Viết một lớp lo việc lọc nhiễu, nhận vào danh sách câu trả lời cùng bộ câu
   hỏi rồi trả về hợp lệ hay không kèm lý do. Tách riêng ra như vậy thì viết
   unit test cho nó dễ, không phải dựng cả cơ sở dữ liệu lên mới test được.
5. Gọi lớp đó trong `SubmitSurveyResponseAsync`, và sửa `ComputeScore` để loại
   thêm câu bẫy ra khỏi phép trung bình.
6. Làm cơ chế vé bắt đầu ở
   [SurveyEndpoints.cs](src/Backend/API/Surveys/SurveyEndpoints.cs): thêm một
   endpoint công khai kiểu `POST /api/public/surveys/{linkToken}/start` trả về
   vé đã ký, và cho endpoint nộp bài nhận thêm vé để kiểm. Ký bằng HMAC với
   khoá lấy từ cấu hình, nội dung vé gồm `LinkToken` và mốc thời gian phát.
   Nhớ đặt giới hạn tần suất cho endpoint mới này.
7. Dựng lại giao diện phiếu thành ba trạng thái trong cùng một component
   ([PublicSurveyPage.tsx](src/Frontend/src/pages/PublicSurveyPage.tsx)): màn mở
   đầu, màn làm bài, màn đã nộp. Không cần thêm route mới. Lưu vé vào
   `localStorage` cùng chỗ với bài làm dở đang có sẵn, và khi mở lại mà thấy có
   bài dở thì bỏ qua màn mở đầu, vào thẳng màn làm bài.
8. Thêm hộp thoại xác nhận trước khi nộp, dùng lại `ConfirmDialog` đang có
   trong [Modal.tsx](src/Frontend/src/components/Modal.tsx).
9. Thêm ô nhập mức đáp án bắt buộc cho từng câu trong trình soạn bộ câu hỏi ở
   [SurveyTemplatesPage.tsx](src/Frontend/src/pages/SurveyTemplatesPage.tsx).
10. Thêm một cột nữa vào file Excel mẫu và cho trình import đọc được cột đó, sửa
    [surveyTemplateImportExcel.ts](src/Frontend/src/utils/surveyTemplateImportExcel.ts)
    và [SurveyTemplateImportDialog.tsx](src/Frontend/src/components/SurveyTemplateImportDialog.tsx).
11. Thêm cột trạng thái, cột lý do và bộ lọc vào
    [SectionSurveyResponsesPage.tsx](src/Frontend/src/pages/SectionSurveyResponsesPage.tsx)
    để admin xem được phiếu nào bị lọc và vì sao.

---

## 3. Nhóm B — Chặn một sinh viên nộp nhiều lần

> **HOÃN LẠI, CHƯA LÀM TỚI.** Anh đã quyết để phần này lại sau vì chưa đủ thông
> tin. Toàn bộ nội dung dưới đây giữ nguyên để sau này quay lại có cái mà đọc,
> nhưng **không nằm trong đợt code sắp tới**.

Việc cần làm là thêm một cột lưu thông tin máy vào bảng `SurveyResponses`.

Còn năm câu hỏi B-a đến B-e ở mục 5 phải trả lời xong đã.

Có mấy điều nên cân nhắc trước khi quyết.

Thứ nhất, phiếu khảo sát hiện đang **ẩn danh một cách có chủ đích**, và giao
diện thì đang nói thẳng với sinh viên như vậy: *"Thông tin của bạn được ghi nhận
ẩn danh và chỉ dùng cho mục đích khảo sát"*, rồi sau khi nộp xong lại hiện
*"Ý kiến của bạn được ghi nhận ẩn danh"*. Cả hai câu đều nằm ở
[PublicSurveyPage.tsx](src/Frontend/src/pages/PublicSurveyPage.tsx). Một khi đã
lưu thông tin máy thì mấy câu đó không còn đúng nữa, cho nên **sửa lại câu chữ
là việc bắt buộc phải làm kèm**, không phải mục tuỳ chọn thích thì làm.

Thứ hai, nên lưu dạng băm chứ đừng lưu địa chỉ IP với chuỗi trình duyệt nguyên
văn. Băm rồi thì vẫn so sánh được để phát hiện trùng, mà lại không giữ dữ liệu
nhận dạng người ta trong cơ sở dữ liệu.

Thứ ba, chuyện máy dùng chung. Phòng máy của trường hay máy sinh viên mượn nhau
thì nhiều em hợp lệ ngồi cùng một máy, chặn theo máy là chặn oan hết cả lượt.

Thứ tư, nếu định dựa vào địa chỉ IP thì phải biết là nó không đáng tin lắm. Cả
một giảng đường nối Wi-Fi trường thì thường chung đúng một IP do NAT, chặn phát
là chặn cả phòng. Ngược lại điện thoại dùng 4G thì đổi IP liên tục, cùng một em
mà mỗi lần vào một IP khác nhau.

Cuối cùng là một ghi chú kỹ thuật nhỏ: bảng `AuthAuditLogs` đã có sẵn cột
`IpAddress varchar(64)` và `UserAgent varchar(1000)` rồi
([AppDbContext.cs](src/Backend/Infrastructure/Persistence/AppDbContext.cs#L119-L120)),
nên nếu làm thì dùng lại đúng kiểu và độ dài đó cho nhất quán trong toàn hệ
thống.

### Các bước sẽ làm cho nhóm B

Chưa liệt kê được vì các bước phụ thuộc hoàn toàn vào việc chốt câu B-a (lấy
thông tin máy từ đâu) và câu B-d (chặn cứng hay chỉ đánh dấu). Riêng câu B-d nếu
chọn phương án chỉ đánh dấu thì gộp thẳng vào cơ chế `IsValid` của nhóm A được,
đỡ phải làm thêm một cơ chế riêng.

---

## 4. Nhóm C — Điểm trung bình và thống kê

### C1. Điểm trung bình của từng lượt làm bài

Anh mô tả: bộ ba mươi câu đều là thang mức độ hài lòng, một lượt làm có năm câu
chọn mức 1, sáu câu chọn mức 2, ba câu chọn mức 3, sáu câu chọn mức 4 và mười
câu chọn mức 5, thì tính ra `(5×1 + 6×2 + 3×3 + 6×4 + 10×5) / 30 = 100/30 = 3,33`.

**Cái này đã có sẵn rồi, không cần thêm cột.** Cột `SurveyResponses.Score` kiểu
`numeric(4,2)` đang làm đúng y như vậy, tính ngay lúc sinh viên nộp bài, và đã
loại sẵn các câu tự nhập chữ ra khỏi phép trung bình.

**Anh đã chốt là dùng luôn cột `Score` này, không tạo cột mới.** Việc duy nhất
cần làm thêm là **loại nốt câu bẫy độ tập trung** ra khỏi phép tính, như đã nói
ở mục A3. Câu tự nhập thì đã loại sẵn rồi.

### C2 và C3. Điểm trung bình của lớp, tính theo mẻ

Thêm cột vào `CourseSectionSurveys`. Không cập nhật mỗi lần có phiếu mới về, mà
để admin bấm một nút thì mới chạy tính lại toàn bộ — đúng như anh yêu cầu, vì
tính lại sau từng lượt nộp thì tốn thời gian vô ích.

Khi tính thì chỉ gộp những phiếu có `IsValid = true`.

| Cột | Kiểu | Null | Ý nghĩa |
|---|---|---|---|
| `AverageScore` | numeric(4,2) | YES | Để trống nghĩa là chưa tính lần nào |
| `TotalResponseCount` | integer | NO, default 0 | Tổng lượt nộp, ví dụ 30 |
| `ValidResponseCount` | integer | NO, default 0 | Lượt qua lọc, dùng để tính điểm, ví dụ 25 |
| `InvalidResponseCount` | integer | NO, default 0 | Lượt bị lọc nhiễu, ví dụ 5 |
| `ScoreCalculatedAt` | timestamptz | YES | Lần bấm tính gần nhất |

Cột `ScoreCalculatedAt` là tôi đề xuất thêm. Có nó thì admin nhìn vào biết ngay
con số đang xem được tính từ lúc nào, và biết là từ đó tới giờ có phiếu mới nào
về mà chưa được gộp vào hay không.

Về ba cột đếm thì đúng là `InvalidResponseCount` có thể suy ra được bằng cách
lấy tổng trừ đi số hợp lệ. Nhưng lưu cả ba thì màn danh sách lớp hiển thị thẳng
ra được, khỏi phải trừ, mà nếu có lúc nào ba con số không khớp nhau thì biết
ngay là dữ liệu đang có vấn đề.

Về cách tính, sẽ viết thành một câu `UPDATE ... FROM (SELECT ... GROUP BY ...)`
chạy trọn vẹn bên trong Postgres. Nghĩa là dù lớp có bao nhiêu phiếu đi nữa thì
cũng không phải kéo hết chúng về bộ nhớ của ứng dụng rồi mới cộng, nên bấm một
cái là xong cho cả đợt.

### C4. Trang thống kê riêng cho admin

Anh chốt câu C-b là làm hẳn một trang mới chứ không nhét nút vào trang đang có,
và câu C-c là chỉ admin hệ thống được dùng.

Về quyền thì tiện, hệ thống đã có sẵn quyền `ADMIN_ACCESS` thuộc nhóm "Quản trị
hệ thống", và cũng đã có sẵn hằng số `AuthPolicies.AdminAccess` trong
[PermissionAuth.cs](src/Backend/API/Auth/PermissionAuth.cs). Dùng lại luôn,
không phải thêm quyền mới.

Trang gồm phần chọn học kỳ và đợt khảo sát, một nút bấm để tính lại toàn bộ, và
bên dưới là bảng dữ liệu mô tả ngay sau đây.

#### Bảng dữ liệu khảo sát của các lớp học phần

Anh đã đưa một bản mô phỏng bằng Excel, tên là "BẢNG SỰ DỮ LIỆU KHẢO SÁT CỦA MỘT
LỚP HỌC PHẦN", mỗi dòng là một lớp. Đây chính là thiết kế của bảng này. Bản mô
phỏng có hai cột đã bỏ theo yêu cầu của anh: cột "% bất mãn" và cột "Đủ điều
kiện công bố".

| Cột | Lấy từ đâu | Đã có chưa |
|---|---|---|
| ID lớp | `CourseSections.CourseSectionId` | Có |
| Mã HP | `Courses.CourseCode` | Có |
| Bộ môn | `Departments.DepartmentName` | Có |
| Họ tên GV | `Lecturers.FullName` | Có |
| Sĩ số | `CourseSections.ClassSize` | Có |
| Số phiếu | Tổng lượt nộp, tính cả phiếu bị lọc | Sẽ là `TotalResponseCount` |
| Tỷ lệ PH | Số phiếu chia sĩ số | Có, `EfReportService` đang tính |
| C1, C2, … Cn | Điểm trung bình từng câu của lớp đó | Có, `SectionSurveyAnalysisDto` |
| Điểm tổng hợp | Điểm trung bình của cả lớp | Sẽ là `AverageScore` |
| Câu yếu nhất | Câu có điểm thấp nhất trong các cột C | Suy ra được, chưa làm ở cấp lớp |
| Điểm câu yếu | Điểm của chính câu đó | Suy ra được |
| Phiếu bị cờ | Số phiếu bị lọc nhiễu | Sẽ là `InvalidResponseCount` |
| Số ý kiến mở | Số phiếu có điền ô "Ý kiến khác" ở cuối bài | Chưa có |

Về cột **Số ý kiến mở**, anh đã chốt là chỉ đếm ô "Ý kiến khác" ở cuối phiếu,
tức là đếm số dòng có `SurveyResponses.AdditionalComments` khác rỗng. Không đếm
các câu hỏi thuộc thang tự nhập chữ, dù giờ hệ thống có cả hai chỗ chứa chữ.

Bốn điểm cần lưu ý khi dựng bảng này:

**Số cột C phải co giãn.** Bản mô phỏng cứng ở C1 đến C18 vì bộ câu hỏi mẫu có
mười tám câu. Hệ thống cho tối đa ba mươi câu và mỗi đợt dùng một bộ khác nhau,
nên số cột phải sinh theo bộ câu hỏi của đợt đang xem. Bảng sẽ rất rộng, cần
cuộn ngang và ghim mấy cột đầu lại cho khỏi lạc.

**Câu tự nhập và câu bẫy không có cột C.** Hai loại này không có điểm nên không
lên bảng được. Tôi sẽ chỉ sinh cột C cho các câu thuộc thang có mức chọn sẵn và
không phải câu bẫy. Nghĩa là bộ hai mươi câu mà có một câu tự nhập với hai câu
bẫy thì bảng chỉ có mười bảy cột C.

**Điểm tổng hợp và các cột C phải khớp nhau.** Trong file mô phỏng thì trung
bình cộng của C1 đến C18 ra khoảng 3.51 nhưng cột Điểm tổng hợp ghi 3.54, lớp
615 thì ra 2.78 mà ghi 2.89. Chắc do số liệu mô phỏng sinh ngẫu nhiên chứ không
tính từ nhau. Khi làm thật thì cả hai đều tính từ **chỉ những phiếu hợp lệ**,
nên hai con số sẽ khớp.

**Câu yếu nhất khi bộ trộn nhiều thang thì hơi khập khiễng.** Thang Có/Không
dùng mức 1 và 5 nên điểm của nó vẫn nằm trong dải 1 đến 5 như thang mức độ hài
lòng, so sánh được về mặt con số. Nhưng ý nghĩa thì khác hẳn: một câu Có/Không
điểm thấp nghĩa là phần lớn trả lời "Không", chứ không phải là sinh viên không
hài lòng. Nếu anh thấy dễ gây hiểu nhầm thì mình chỉ xét câu yếu nhất trong
nhóm câu dùng thang mức độ hài lòng thôi, nói một tiếng là tôi sửa lại.

### Hai câu C-d và C-e anh để tôi quyết

**C-e — báo cáo có lọc chỉ lấy phiếu hợp lệ không: có, nhưng phải phân biệt hai
loại số.**

Số nào liên quan tới chất lượng thì chỉ tính phiếu hợp lệ: điểm trung bình, phân
bố các mức, xếp hạng câu hỏi yếu nhất, so sánh giữa các khoa. Lý do đơn giản là
nếu điểm trung bình của lớp loại phiếu nhiễu ra mà báo cáo lại gộp vào, thì cùng
một thứ mà hai màn hình cho hai con số khác nhau, còn tệ hơn là chọn hẳn một
kiểu.

Nhưng số nào liên quan tới tiến độ thu phiếu thì phải đếm hết: tổng lượt nộp, tỷ
lệ hoàn thành so với sĩ số lớp. Vì một em nộp phiếu ẩu thì vẫn là đã tham gia,
không thể coi như em ấy chưa làm được.

**C-d — báo cáo đọc cột `AverageScore` mới hay tự tính lại: giữ nguyên tự tính
lại như hiện nay.**

Cột `AverageScore` là ảnh chụp của lần bấm nút gần nhất, còn báo cáo thì nên
phản ánh đúng dữ liệu tại thời điểm xem. Nếu báo cáo đi đọc cột đó thì admin nào
quên bấm nút sẽ nhìn thấy số cũ mà không biết, và tệ hơn là hai màn hình khác
nhau lại nói hai con số khác nhau.

Vậy phân vai thế này: cột `AverageScore` phục vụ màn danh sách lớp và trang
thống kê mới, nơi cần hiển thị nhanh vài trăm dòng cùng lúc; còn `EfReportService`
vẫn tính trực tiếp như đang làm, vốn đã chạy tốt và có cache chín mươi giây cho
báo cáo toàn trường. Để tránh nhầm lẫn thì chỗ nào hiện `AverageScore` cũng phải
hiện kèm `ScoreCalculatedAt`.

Nếu anh thấy nên làm khác thì nói, tôi sửa lại.

### Các bước sẽ làm cho nhóm C

1. Thêm năm cột trên vào `CourseSectionSurveys`, sửa
   [SurveyModels.cs](src/Backend/Domain/SurveyModels.cs) và
   [AppDbContext.cs](src/Backend/Infrastructure/Persistence/AppDbContext.cs),
   rồi viết migration.
2. Sửa `ComputeScore` để loại câu bẫy, như đã nói ở nhóm A.
3. Viết một hàm tính lại theo mẻ, chạy bằng một câu `UPDATE ... FROM` duy nhất.
4. Mở một endpoint cho việc tính lại, phạm vi tính thì tuỳ câu trả lời C-b, đặt
   trong [SurveyEndpoints.cs](src/Backend/API/Surveys/SurveyEndpoints.cs).
5. Làm trang thống kê mới cho admin theo thiết kế ở mục C4: chọn học kỳ và đợt,
   nút bấm tính lại, bảng dữ liệu các lớp với số cột C sinh động theo bộ câu
   hỏi. Trang mới đặt cạnh
   [CourseSurveysPage.tsx](src/Frontend/src/pages/CourseSurveysPage.tsx), thêm
   mục vào [Sidebar.tsx](src/Frontend/src/components/Sidebar.tsx) và khai báo
   route trong [App.tsx](src/Frontend/src/App.tsx).
6. Bổ sung các số liệu bảng C4 cần mà chưa có: câu yếu nhất và điểm của nó ở
   cấp lớp, số phiếu có điền ý kiến khác.
7. Rà lại toàn bộ
   [EfReportService.cs](src/Backend/Infrastructure/Reports/EfReportService.cs)
   thêm điều kiện `IsValid = true` vào những chỗ tính số về chất lượng, giữ
   nguyên những chỗ đếm tiến độ thu phiếu, theo quyết định ở câu C-e.

---

## 5. Những câu cần anh chốt

### Nhóm A — lọc nhiễu

| # | Câu hỏi |
|---|---|
**Nhóm A đã chốt xong toàn bộ, không còn câu nào treo.**

| # | Câu hỏi | Đã chốt |
|---|---|---|
| A-a | Cột thời gian tối thiểu đặt ở bảng nào | Bỏ câu hỏi. Không cần cột nào, tính ra được từ hằng số và số câu |
| A-b | Lấy mốc bắt đầu làm bài theo cách nào | Màn hình mở đầu có nút "Bắt đầu làm bài", server phát vé có ký |
| A-c | Con số giây mỗi câu, cố định hay cho sửa | **4 giây**, viết cứng trong mã nguồn, không ai sửa được |
| A-d | Tính trên câu nào | Tổng số câu của cả bài, kể cả câu tự nhập và câu bẫy |
| A-e | Bao nhiêu câu bẫy một bộ | Bao nhiêu cũng được, không giới hạn |
| A-f | Sai mấy câu bẫy thì lọc | Sai một câu là lọc ngay |
| A-g | Lưu một lý do hay lưu hết | Lưu hết, ngăn cách bằng dấu phẩy |
| A-h | Có màn hình xem phiếu bị lọc không | Có, thêm vào trang danh sách phiếu đang có |
| A-i | Màn mở đầu có hiện thời gian tối thiểu không | Không hiện con số nào, chỉ một dòng nhắc đọc kỹ ở trên cùng |
| A-j | Vé có hạn dùng không | Không. Không lưu DB, bấm bắt đầu lại bao nhiêu lần cũng được |
| A-k | Mở lại sau khi đóng trình duyệt thì sao | Như A-j: bấm bắt đầu lại là được |
| A-l | Báo cho sinh viên biết phiếu bị lọc không | Không báo. Nhận bình thường rồi lặng lẽ đánh dấu |

### Nhóm B — chặn nộp trùng

**Cả nhóm B đã hoãn lại, chưa cần trả lời bây giờ.** Giữ lại đây để sau này quay
lại còn biết đang vướng ở đâu.

| # | Câu hỏi |
|---|---|
| B-a | Lấy thông tin máy từ đâu: băm IP cộng chuỗi trình duyệt, mã ngẫu nhiên lưu trong `localStorage`, hay cả hai? |
| B-b | Chặn trong phạm vi nào: một máy chỉ nộp được một phiếu cho một lớp, hay cho cả đợt khảo sát? |
| B-c | Máy dùng chung xử lý sao: chặn cứng, cảnh báo nhưng vẫn cho nộp, hay để admin gỡ chặn thủ công? |
| B-d | Chặn cứng luôn (trả lỗi, không nhận phiếu) hay vẫn nhận rồi đánh dấu, tức là gộp vào cơ chế `IsValid` của nhóm A? |
| B-e | Câu chữ "ẩn danh" trên giao diện sửa lại thành gì? Giờ đã có chỗ đặt rồi: bản cam kết ở màn hình mở đầu tại mục A1-b. |

### Nhóm C — điểm và thống kê

**Nhóm C đã chốt xong toàn bộ.**

| # | Câu hỏi | Đã chốt |
|---|---|---|
| C-a | Dùng cột `Score` cũ hay cột mới | Dùng luôn cột `Score`, chỉ cần loại câu bẫy và câu tự nhập |
| C-b | Nút tính điểm đặt ở đâu | Làm hẳn một trang thống kê riêng cho admin |
| C-c | Ai được bấm | Admin hệ thống, dùng quyền `ADMIN_ACCESS` đã có sẵn |
| C-d | Báo cáo đọc cột mới hay tự tính | Tôi quyết: giữ nguyên tự tính, cột mới chỉ phục vụ trang thống kê và danh sách lớp |
| C-e | Báo cáo có lọc phiếu hợp lệ không | Tôi quyết: số về chất lượng thì lọc, số về tiến độ thu phiếu thì đếm hết |

---

## 6. Tổng hợp các cột dự kiến thêm

Gom lại một chỗ cho dễ hình dung khối lượng công việc. **Chưa chốt, chưa code.**

### `SurveyQuestions`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `AttentionCheckValue` | integer | YES | A3 |

Kèm ràng buộc: chỉ được khác rỗng khi câu thuộc thang có mức chọn sẵn, và giá
trị phải là một mức có thật của thang đó.

### `SurveyResponses`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `IsValid` | boolean | NO, default true | A4 |
| `RejectionReasons` | varchar(200) | YES | A4 |
| *(cột thông tin máy — hoãn lại cùng cả nhóm B)* | ? | ? | B |

### `CourseSectionSurveys`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `AverageScore` | numeric(4,2) | YES | C2 |
| `TotalResponseCount` | integer | NO, default 0 | C3 |
| `ValidResponseCount` | integer | NO, default 0 | C3 |
| `InvalidResponseCount` | integer | NO, default 0 | C3 |
| `ScoreCalculatedAt` | timestamptz | YES | C2 |

### Không cần cột thời gian tối thiểu

Ban đầu định thêm `MinimumDurationSeconds`, nhưng sau khi chốt hằng số bốn giây
viết cứng trong mã và tính trên tổng số câu của bài thì nhân ra là có, khỏi lưu.
Bỏ cột này.

### Việc phải làm mà không phải thêm cột

Ngoài mấy cột trên thì còn một loạt việc kéo theo: dựng lại luồng phiếu thành
màn mở đầu và màn làm bài như mục A1-b; làm endpoint phát vé bắt đầu và ký HMAC;
thêm hộp thoại xác nhận trước khi nộp; sửa `ComputeScore` để loại câu bẫy; rà
`EfReportService` thêm điều kiện lọc phiếu hợp lệ nếu chốt C-e; thêm ô nhập mức
đáp án bắt buộc vào trình soạn bộ câu hỏi; thêm một cột nữa vào file Excel mẫu
và trình import; viết bản cam kết ẩn danh cho màn mở đầu; và làm endpoint cùng
nút bấm tính điểm trung bình theo mẻ.

Riêng phần vé bắt đầu thì cần thêm một khoá ký trong cấu hình, kiểu
`SurveyTicket:SigningKey`. Khoá này phải khác nhau giữa máy dev và máy chạy
thật, và không được commit lên git.

---

## 7. Yêu cầu tiếp theo

_(chờ anh mô tả thêm)_

---

## 8. Nhật ký

| Ngày | Nội dung |
|---|---|
| 2026-08-20 | Đã xong: chuyển thang trả lời từ cấp bộ câu hỏi xuống từng câu hỏi, thêm thang loại `Text`, đổi `SurveyResponseAnswers.SelectedValue` (int) thành `AnswerValue` (chữ). Migration `20260820075102_MoveAnswerScaleToQuestionAndTextAnswers`. |
| 2026-08-20 | Nhận yêu cầu chặn nộp trùng, điểm mỗi lượt, điểm trung bình lớp. Lập file kế hoạch này. |
| 2026-08-20 | Nhận yêu cầu lọc nhiễu và đếm phiếu hợp lệ. Sắp xếp lại thành ba nhóm A, B, C. Chưa code. |
| 2026-08-20 | Viết lại file theo văn nói, bổ sung các bước thực hiện cho từng nhóm. |
| 2026-08-20 | Chốt câu A-b: thiết kế lại luồng phiếu thành màn mở đầu có nút "Bắt đầu làm bài" rồi mới vào màn làm bài, server phát vé có ký tại lúc bấm nút. Thêm hộp thoại xác nhận trước khi nộp. Việc này giải luôn chỗ đặt cam kết ẩn danh cho câu B-e. Thêm bốn câu hỏi A-i đến A-l. |
| 2026-08-20 | Chốt câu A-i: màn mở đầu không hiện thời gian tối thiểu, cũng không hiện ước lượng, chỉ một dòng nhắc đọc kỹ trước khi làm đặt trên cùng. |
| 2026-08-20 | Nhận bản mô phỏng Excel của bảng thống kê, ghi thành thiết kế cho trang admin ở mục C4. Bỏ cột "% bất mãn" và cột "Đủ điều kiện công bố". Cột "Số ý kiến mở" chỉ đếm ô "Ý kiến khác" cuối phiếu. |
| 2026-08-20 | Chốt nốt nhóm A và nhóm C. Bốn giây mỗi câu viết cứng trong mã, tính trên tổng số câu nên bỏ luôn cột `MinimumDurationSeconds`. Vé không lưu DB, bấm bắt đầu lại thoải mái. Lưu hết lý do lọc nên đổi cột thành `RejectionReasons varchar(200)`. Không báo cho sinh viên biết phiếu bị lọc. Làm trang thống kê riêng cho admin dùng quyền `ADMIN_ACCESS`. Nhóm B hoãn lại. Hai câu C-d và C-e tôi tự quyết, đã ghi rõ lý do trong mục 4. |
