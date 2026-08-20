# Phân tích bản mô phỏng Excel — hệ báo cáo nâng cao

Tài liệu đọc sáu ảnh chụp bản mô phỏng Excel, đối chiếu với những gì dự án đã có,
rồi ghi lại các chỉnh sửa đã chốt.

Chưa code gì. Đây là tài liệu để bàn trước.

- Nhánh: `hoang2`
- Ngày: 2026-08-21
- Cập nhật: 2026-08-21 — chốt chỉnh sửa cho cả sáu sheet

---

## 0. Hai thay đổi lớn nhất so với bản mô phỏng gốc

Sau khi chốt, **hai thứ tưởng là chặn đường thì không cần nữa**:

| Bản mô phỏng gốc cần | Đã chốt bỏ vì |
| :--- | :--- |
| **Loại học phần** (Chuyên ngành / Cơ sở ngành / Đại cương) | Sheet 1 đổi nhóm tương đương thành **khoa/viện**, không dùng loại học phần nữa |
| **Nhóm tiêu chí** (Thiết kế HP, Giảng dạy…) và **đơn vị phụ trách** | Sheet 3, 5, 6 đều đổi sang làm việc với **từng câu hỏi trực tiếp** |

Trước đó tôi xếp "gán nhóm tiêu chí" là ưu tiên 1 và cảnh báo rằng sheet 1 bị
chặn bởi việc phải điền loại cho 486 học phần. **Cả hai nút thắt đó biến mất.**
Toàn bộ sáu sheet giờ chỉ cần dữ liệu đã có trong CSDL, cộng thêm vài phép tính.

---

## 1. Sáu sheet sau khi chốt

### Sheet 1 — Chuẩn hoá điểm bằng Z-score

Ý chính giữ nguyên: so điểm thô giữa các lớp khác nhau về bản chất là so sai.

**Đã chốt:**

- Nhóm tương đương = **Khoa / Viện** (bản gốc là loại học phần × dải sĩ số)
- **Bỏ** cột `ID lớp` và cột `Loại HP`
- **Điểm nền toàn trường** = điểm trung bình của **tất cả lớp học phần đã có
  phiếu** trong chính đợt khảo sát đang xem
- Phần diễn giải để tôi tự quyết

Hai tầng chuẩn hoá:

```
Z toàn trường = (điểm lớp − TB toàn đợt)  / SD toàn đợt
Z trong nhóm  = (điểm lớp − TB khoa/viện) / SD khoa/viện
Chênh lệch    = Z trong nhóm − Z toàn trường
```

Bảng nhóm phía trên đổi thành: `Khoa/Viện · Số lớp · Điểm TB khoa · SD khoa`,
cộng một dòng `TOÀN TRƯỜNG`.

Bảng chi tiết mỗi lớp một dòng: `Học phần · Giảng viên · Sĩ số · Điểm ·
Z toàn trường · Khoa/Viện · Z trong khoa · Chênh lệch 2 cách · Diễn giải`.

**Diễn giải — đề xuất của tôi**, dựa trên `Z trong nhóm` vì đó mới là phép so
công bằng, và nêu bật trường hợp chuẩn hoá làm đổi kết luận:

| Điều kiện | Diễn giải |
| :--- | :--- |
| Hai cách cho kết luận trái ngược nhau (một bên ≥ +1, bên kia ≤ −1) | **Chuẩn hoá làm đổi kết luận rõ rệt** |
| `Z trong nhóm ≥ +1` | Trên mặt bằng khoa |
| `Z trong nhóm ≤ −1` | Thấp hơn mặt bằng khoa — theo dõi |
| Còn lại | Trong vùng bình thường |
| Khoa có ít hơn 5 lớp có phiếu | Khoa quá ít lớp để chuẩn hoá |

Dòng cuối là đề xuất tôi vẫn giữ: khoa chỉ có 1–2 lớp thì SD không có nghĩa,
in ra một con số trông chính xác sẽ gây hiểu nhầm. Xem mục 4.1.

### Sheet 2 — Biểu đồ điểm tổng hợp theo khoa/viện

**Đã chốt:** giữ nguyên, dùng làm **một phần của dashboard chính**, xem theo
từng bài khảo sát.

Đây là biểu đồ cột đơn giản, dữ liệu lấy thẳng từ bảng nhóm của sheet 1 nên gần
như không tốn thêm gì.

### Sheet 3 — Tổng hợp theo bộ môn

Phục vụ trưởng khoa.

**Đã chốt:**

- **Bỏ** cột `Số lớp đủ ĐK`
- Cột `Nhóm tiêu chí yếu nhất` → đổi thành **`Câu hỏi yếu nhất`**, chỉ hiện số
  câu, ví dụ `C13`

Cột còn lại: `Khoa/Viện · Bộ môn · Số lớp · Số GV · Số phiếu · Tỷ lệ PH BQ ·
Điểm tổng hợp · Lớp cảnh báo · Câu hỏi yếu nhất`.

Điểm tổng hợp tô thang màu đỏ → cam → vàng → xanh. Cột `Lớp cảnh báo` tô hồng
khi khác 0.

### Sheet 4 — Tách nguyên nhân: so các lớp trong cùng một học phần

Sheet có giá trị nghiệp vụ cao nhất:

> Nếu **mọi lớp** của một học phần đều thấp thì vấn đề thuộc **HỌC PHẦN** (giáo
> trình, đề cương, kết cấu tín chỉ). Nếu **chỉ một vài lớp** thấp thì vấn đề
> thuộc **GIẢNG VIÊN**.

**Đã chốt:**

- **Hiển thị cả học phần chỉ có 1 lớp** (bản gốc ghi "chỉ có được khi có nhiều lớp")
- Giữ **đúng bốn** loại kết luận như bản mô phỏng

Cột: `Mã HP · Tên học phần · Khoa/Viện · Số lớp · Số GV · Điểm TB · Thấp nhất ·
Cao nhất · Biên độ · Câu yếu nhất của HP · Kết luận chẩn đoán`.

| Kết luận | Suy ra từ |
| :--- | :--- |
| MỌI LỚP ĐỀU THẤP → rà soát HỌC PHẦN: giáo trình, đề cương, kết cấu tín chỉ | Điểm cao nhất vẫn dưới ngưỡng thấp |
| CHÊNH LỆCH LỚN GIỮA CÁC LỚP → khác biệt thuộc GIẢNG VIÊN, trao đổi ở cấp bộ môn | Biên độ vượt ngưỡng |
| Mọi lớp đều tốt — thực hành tốt của học phần, nên nhân rộng | Điểm thấp nhất vẫn trên ngưỡng tốt |
| Chênh lệch vừa phải — chưa đủ cơ sở kết luận | Còn lại |

Với học phần **1 lớp**: biên độ luôn bằng 0, nên chỉ rơi vào nhóm "mọi lớp đều
thấp" hoặc "mọi lớp đều tốt" hoặc "chưa đủ cơ sở kết luận" — không bao giờ ra kết
luận "khác biệt thuộc giảng viên". Đó là hành vi đúng: một lớp thì không có gì để
so, nên không kết luận được về giảng viên.

### Sheet 5 — Báo cáo cá nhân giảng viên

**Đã chốt:**

- CSDL không có "mã giảng viên" như trong ảnh, nên **không nhập mã**. Thay bằng
  **bộ lọc + nút Tìm**, mỗi lần chỉ hiện **đúng một giảng viên**
- **Bỏ** cột `Đủ ĐK công bố`
- Bảng "So sánh với mặt bằng chung" phải làm lại: bản gốc so theo **nhóm tiêu
  chí** mà hệ thống không có khái niệm đó. Đổi sang so với **mặt bằng bộ môn** và
  **mặt bằng khoa/viện** của chính giảng viên đó

Phân quyền dự kiến — cùng một trang, ba cách dùng:

| Vai | Cách dùng |
| :--- | :--- |
| Quản trị | Lọc và tìm bất kỳ giảng viên nào |
| Trưởng bộ môn | Chỉ tìm được giảng viên **thuộc bộ môn mình** |
| Giảng viên | **Không có bộ lọc**, mở ra là thấy ngay các lớp mình dạy |

Ba khối của trang:

1. **Thông tin chung**: họ tên, bộ môn, khoa/viện, số lớp được đánh giá, tổng số
   phiếu, điểm tổng hợp bình quân
2. **Các lớp giảng dạy trong kỳ**: `Học phần · Sĩ số · Số phiếu · Tỷ lệ PH ·
   Điểm · Z trong khoa`
3. **So sánh với mặt bằng chung** — bảng làm lại, đề xuất ở mục 4.2

Ghi chú thiết kế của bản mô phỏng **giữ nguyên**, đây là điểm đúng:

> Báo cáo cá nhân **KHÔNG hiển thị thứ hạng**. Chỉ đặt cạnh mặt bằng bộ môn và
> toàn trường, vì chênh lệch nhỏ giữa các giảng viên không có ý nghĩa thống kê
> nhưng bảng xếp hạng lại khiến nó trông như có.

### Sheet 6 — Dashboard ban giám hiệu

**Đã chốt:**

- Là **một phần của dashboard chính**: vào chương trình, chọn bài khảo sát, thấy
  ngay tổng quan
- **Bỏ** cột `Đơn vị phụ trách`
- Cột `Nội dung` hiển thị **nguyên văn câu hỏi** của top 5 câu yếu nhất
- Phạm vi tính: **toàn trường**, tức mọi lớp học phần thuộc đợt khảo sát đó
- **Bỏ bốn chỉ số** khỏi khối "Chỉ số chính":
  `Hài lòng tổng thể (C15)` · `Số lớp không đủ ĐK công bố` ·
  `Số lớp cảnh báo mức 1` · `Số lớp cảnh báo mức 2`

Chỉ số chính còn lại đúng bốn ô:

| Chỉ số | Lấy từ |
| :--- | :--- |
| Số lớp học phần được khảo sát | Đếm `CourseSectionSurveys` của đợt |
| Tổng số phiếu thu được | Cộng `TotalResponseCount` |
| Tỷ lệ phản hồi bình quân | Tổng phiếu chia tổng sĩ số |
| Điểm tổng hợp toàn trường | Trung bình điểm các lớp có phiếu |

Bảng 5 tiêu chí yếu nhất sau khi bỏ cột đơn vị phụ trách:
`Câu · Nội dung câu hỏi · Điểm TB · Số lớp dưới ngưỡng`.

Kèm biểu đồ điểm trung bình từng câu toàn trường, và biểu đồ theo khoa/viện của
sheet 2.

> **Bỏ hẳn khái niệm "đủ điều kiện công bố".** Chưa rõ công bố cho ai và công bố
> cái gì, nên không định nghĩa được ngưỡng. Khi nào cần thì bàn lại — lúc đó chỉ
> là thêm một phép lọc theo tỷ lệ phản hồi, không đụng vào cấu trúc dữ liệu.

---

## 2. Dùng lại được ngay

| Bản mô phỏng cần | Dự án đã có |
| :--- | :--- |
| Điểm từng lớp | `CourseSectionSurveys.AverageScore` |
| Số phiếu, tỷ lệ phản hồi | `TotalResponseCount` + `CourseSections.ClassSize` |
| Điểm từng câu của lớp | `GetSemesterSurveyStatisticsAsync` |
| Câu yếu nhất của lớp | `SectionStatisticsRowDto.WeakestQuestionId` |
| Nội dung câu hỏi để hiện ở sheet 6 | `StatisticsQuestionColumnDto.QuestionText` |
| Loại phiếu làm ẩu khỏi điểm | Nhóm A — `IsValid` + `RejectionReasons` |
| Straight-lining như một KPI | Chính là mã `SINGLE_ANSWER`, **đã đếm sẵn** |
| Điểm theo khoa/viện, theo bộ môn | `GetFacultyDepartmentReportsAsync` |
| Điểm trung bình từng câu toàn trường | `GetQuestionAnalysisReportAsync` |
| Bảng câu yếu nhất toàn trường | `EfReportService`, hằng `WeakQuestionCount = 5` |
| Chỉ số dashboard | `GetSchoolSurveyOverviewAsync` |
| Khoa/viện, bộ môn, giảng viên của lớp | Danh mục đã đủ sau đợt import |
| Số lớp, số GV của một bộ môn | Suy ra từ `CourseSections` + `Lecturers` |
| Lọc phiếu nhiễu khỏi số chất lượng, giữ cho số tiến độ | Đã rà 12 chỗ trong `EfReportService` |

Điểm hợp nhau đáng nói: lưu ý cuối sheet 6 đòi theo dõi tỷ lệ straight-lining như
một KPI. Hệ thống **đã ghi sẵn** từng phiếu bị lọc vì lý do gì, chỉ cần đếm theo
kỳ là ra.

---

## 3. Chưa có — phải làm mới

### 3.1. Dữ liệu

| Thứ cần | Dùng ở đâu |
| :--- | :--- |
| **Ngưỡng "lớp cảnh báo"** — một mức, không chia hai | Sheet 3, cột `Lớp cảnh báo` |
| **Ngưỡng "điểm thấp" và "biên độ lớn"** | Sheet 4, cột kết luận chẩn đoán |
| **Ngưỡng điểm để đếm "số lớp dưới ngưỡng"** | Sheet 6, bảng 5 câu yếu nhất |
| **Ngưỡng số lớp tối thiểu để chuẩn hoá** | Sheet 1, cột `Z trong khoa` |

Bốn thứ này đều là **hằng số cấu hình**, không phải cột trong CSDL. Không cần
migration nào.

**Không còn cần**: loại học phần, dải sĩ số, nhóm tiêu chí, đơn vị phụ trách,
đủ điều kiện công bố, cảnh báo hai mức.

### 3.2. Phép tính

| Phép tính | Vì sao cần |
| :--- | :--- |
| **Độ lệch chuẩn** theo khoa/viện và toàn đợt | Z-score bắt buộc phải có. `EfReportService` hiện chỉ tính trung bình |
| **Z-score hai tầng** kèm chênh lệch | Sheet 1 |
| **Gộp theo mã học phần**: min, max, biên độ | Sheet 4 |
| **Mặt bằng bộ môn và khoa/viện** của một giảng viên | Sheet 5 |
| **Câu yếu nhất ở cấp bộ môn và cấp học phần** | Sheet 3 và 4. Hiện mới có ở cấp lớp |

### 3.3. Chức năng

- **Trang báo cáo cá nhân giảng viên** kèm bộ lọc và ba mức phân quyền
- **Dashboard chính** gom sheet 2 và sheet 6
- **Sinh PDF hàng loạt + gửi email** — dự án **không có hạ tầng email nào**, cùng
  nút thắt với [gui-file-loi-cho-truong-bo-mon.md](gui-file-loi-cho-truong-bo-mon.md)
- **Xuất Excel** các bảng thống kê

---

## 4. Đề xuất của tôi cho những chỗ được để tự quyết

### 4.1. Khoa có quá ít lớp thì không chuẩn hoá

Z-score tính trên nhóm 1–2 phần tử là con số vô nghĩa: nhóm một lớp thì SD không
tồn tại, nhóm hai lớp thì Z **luôn là ±0.71** bất kể điểm thật là bao nhiêu.

Đề xuất: khoa có dưới 5 lớp đã có phiếu thì cột `Z trong khoa` ghi
*"khoa quá ít lớp để chuẩn hoá"* thay vì in ra một con số.

Với dữ liệu hiện tại của đợt đang có, cần kiểm xem bao nhiêu khoa rơi vào diện
này trước khi chốt con số 5.

### 4.2. Bảng "So sánh với mặt bằng chung" của sheet 5

Bản gốc so theo tám nhóm tiêu chí. Không còn nhóm tiêu chí thì đề xuất đổi thành
**so theo từng câu hỏi**, ba cột số:

| Câu hỏi | Giảng viên | Mặt bằng bộ môn | Mặt bằng khoa/viện | Chênh so bộ môn |
| :--- | ---: | ---: | ---: | ---: |
| C1 … | 3.94 | 3.71 | 3.49 | +0.23 |

Hai điểm đề xuất kèm theo:

**Dùng trung vị, không dùng trung bình** cho hai cột mặt bằng. Một lớp cá biệt
điểm rất thấp sẽ kéo trung bình bộ môn xuống, làm mọi giảng viên khác trông như
trên mặt bằng. Trung vị không bị vậy. Bản mô phỏng cũng chọn trung vị.

**Bảng dài 29 dòng** với bộ câu hỏi hiện tại. Nếu thấy dài quá thì rút còn phần
đầu và phần cuối: 5 câu giảng viên vượt mặt bằng nhiều nhất và 5 câu kém nhất —
đó cũng là thứ người đọc thật sự cần.

### 4.3. Biểu đồ khoa/viện nên để trục từ 0

Bản mô phỏng cắt trục từ 3.10. Chênh lệch thật giữa khoa cao nhất và thấp nhất
là 0.53 điểm trên thang 5, nhưng biểu đồ làm nó trông như gấp nhiều lần. Người
đọc là ban giám hiệu nên dễ dẫn tới kết luận quá tay.

Đề xuất: để trục 0–5, hoặc giữ nguyên nhưng ghi rõ trục đã cắt.

### 4.4. "Số phòng học cần sửa chữa ưu tiên cao"

Con số này ngụ ý hệ thống biết từng phòng học, mà dữ liệu chỉ có điểm câu theo
lớp. Không có bảng phòng học, không có ánh xạ lớp → phòng.

Đề xuất: đổi thành **"Số lớp có điểm cơ sở vật chất dưới ngưỡng"** — tính được
ngay, và vẫn đủ để bộ phận thiết bị lần ra phòng.

---

## 5. Thứ tự nên làm

Xếp lại sau khi bỏ được hai nút thắt.

| Ưu tiên | Việc | Vì sao |
| :--- | :--- | :--- |
| 1 | Sheet 4 — tách nguyên nhân học phần / giảng viên | Chỉ cần gộp theo mã HP từ dữ liệu đã có. Giá trị nghiệp vụ cao nhất, không cần cột mới |
| 2 | Sheet 1 + sheet 2 — Z-score theo khoa và biểu đồ khoa | Chỉ thêm phép tính SD. Không còn bị chặn bởi loại học phần |
| 3 | Sheet 3 — tổng hợp theo bộ môn | Gần với `GetFacultyDepartmentReportsAsync` đang có |
| 4 | Sheet 6 + dashboard chính | Phần lớn chỉ số đã có, thiếu ngưỡng cảnh báo |
| 5 | Sheet 5 — báo cáo cá nhân, bản xem trên web | Cần trung vị theo bộ môn và khoa trước |
| 6 | Phân quyền trưởng bộ môn và giảng viên cho sheet 5 | Phụ thuộc phần phân quyền tài khoản |
| 7 | Sinh PDF hàng loạt + gửi email | Chặn bởi hạ tầng email |

### Đã làm

Sheet 1, 3, 4, 5 nằm trong một trang `Phân tích chuyên sâu` ở sidebar, chia theo
tab. Sheet 2 và sheet 6 gộp thành trang `Tổng quan khảo sát`. Tất cả mở cho tài
khoản có quyền `REPORTS_ACCESS`.

| Sheet | Trang / Tab | Endpoint |
| :--- | :--- | :--- |
| 1 | Phân tích chuyên sâu › Chuẩn hoá điểm | `GET /api/surveys/semester-surveys/{id}/normalization` |
| 3 | Phân tích chuyên sâu › Tổng hợp theo bộ môn | `GET .../department-summary` |
| 4 | Phân tích chuyên sâu › Chẩn đoán học phần | `GET .../course-diagnosis` |
| 5 | Phân tích chuyên sâu › Báo cáo giảng viên | `GET .../lecturers` và `GET .../lecturers/{lecturerId}` |
| 2 + 6 | Tổng quan khảo sát | `GET .../dashboard` |

Trang `Bảng điều khiển` bỏ hết số liệu, chỉ còn bốn lối vào chính: Tổng quan
khảo sát · Tiến độ thu phiếu · Phân tích chuyên sâu · Lớp học phần.

**Bỏ dòng "Số phòng học cần sửa chữa ưu tiên cao".** Đề xuất ở mục 4.4 là đổi
thành "số lớp có điểm cơ sở vật chất dưới ngưỡng", nhưng cách đó cần biết câu
nào thuộc nhóm cơ sở vật chất — mà nhóm tiêu chí đã bị bỏ khỏi phạm vi. Khi nào
cần thì phải có lại cách đánh dấu nhóm cho câu hỏi trước.

---

## 6. Còn cần chốt

**Đã chốt:** "lớp cảnh báo" ở sheet 3 và "lớp dưới ngưỡng" ở sheet 6 dùng **chung
một ngưỡng**, để hai màn hình không bao giờ nói ngược nhau.

### 6.1. Các ngưỡng — đề xuất

Rút từ chính bản mô phỏng, đọc ngược từ những dòng đã được tô màu trong ảnh.

| Hằng số | Đề xuất | Căn cứ |
| :--- | ---: | :--- |
| `ĐIỂM_THẤP` — dùng cho lớp cảnh báo, lớp dưới ngưỡng, và "mọi lớp đều thấp" | **3.20** | Bản mô phỏng ghi thẳng "Số lớp <3,20" |
| `ĐIỂM_TỐT` — dùng cho "mọi lớp đều tốt, nên nhân rộng" | **4.00** | Trong ảnh, học phần 14120 có min 4.07 được xếp "mọi lớp đều tốt" |
| `BIÊN_ĐỘ_LỚN` — dùng cho "khác biệt thuộc giảng viên" | **0.80** | Trong ảnh: 0.82 · 1.02 · 1.22 → "chênh lệch lớn"; 0.72 · 0.73 → "vừa phải" |
| `Z_ĐÁNG_KỂ` — ngưỡng trên/dưới mặt bằng | **1.00** | Quy ước thống kê thông thường |
| `SỐ_LỚP_TỐI_THIỂU_CHUẨN_HOÁ` | **5** | Xem mục 4.1 |

Ba câu còn để ngỏ:

| # | Câu hỏi |
| :--- | :--- |
| 1 | Đồng ý năm con số trên chứ? |
| 2 | Sheet 5: bảng so sánh hiện đủ 29 câu hay rút còn 5 câu tốt nhất và 5 câu kém nhất? |
| 3 | "Số phòng học cần sửa chữa" đổi theo đề xuất 4.4 hay bỏ hẳn? |

### 6.2. Dữ liệu thử hiện tại chưa kiểm chứng được sheet 1 và sheet 4

Đã đo trên đợt khảo sát đang có:

```
31 lớp có phiếu · điểm từ 3.60 đến 3.73 · trung vị 3.67 · độ lệch chuẩn 0.031
Tất cả 31 lớp đều thuộc DUY NHẤT khoa Hàng hải
```

Hai vấn đề, đều do **script sinh dữ liệu thử của tôi**, không phải do thiết kế:

**Điểm quá đều.** Tôi sinh câu trả lời theo cùng một phân phối cho mọi lớp nên
mọi lớp đều tụ quanh 3.67. Độ lệch chuẩn 0.031 nghĩa là chênh 0.03 điểm đã thành
Z = 1. Không lớp nào chạm ngưỡng 3.20 hay 4.00, nên sheet 3, 4, 6 sẽ ra toàn
"chưa đủ cơ sở kết luận".

**Chỉ một khoa có dữ liệu.** Sheet 1 và sheet 2 so giữa các khoa, mà chỉ có khoa
Hàng hải có phiếu thì không có gì để so.

Trước khi làm sheet 1 và sheet 4, cần sinh lại dữ liệu thử: rải lớp qua nhiều
khoa, và cho mỗi lớp một "mức chất lượng" riêng để điểm trải từ khoảng 2.8 đến
4.5 như bản mô phỏng. Việc này chỉ là sửa script, không đụng code sản phẩm.
