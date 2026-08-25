# Phân tích chuyên sâu — cách tính từng cột và tác động nếu áp quy tắc 68-95-99.7

Tài liệu mô tả 5 tab của trang *Phân tích chuyên sâu*: mỗi cột lấy số từ đâu,
tính bằng công thức nào, và nếu chuyển sang chấm theo quy tắc 68-95-99.7 thì kết
quả đổi ra sao.

Mọi con số minh hoạ đo trên dữ liệu thật ngày 2026-08-25: đợt *Khảo sát test*,
học kỳ 1 (2025-2026), **1830 lớp** trong đó **1825 lớp có phiếu hợp lệ**, 14
khoa/viện, 60 bộ môn, 403 học phần, 66.698 phiếu.

Mã nguồn:

- Backend: [`EfSurveyService.cs`](../../src/Backend/Infrastructure/Surveys/EfSurveyService.cs) — `GetSemesterSurveyNormalizationAsync`, `GetSemesterSurveyDepartmentSummaryAsync`, `GetSemesterSurveyCourseDiagnosisAsync`, `GetLecturerSurveyReportAsync`
- Ngưỡng: [`ReportThresholds.cs`](../../src/Backend/Application/Surveys/ReportThresholds.cs)
- Frontend: [`SurveyAnalysisPage.tsx`](../../src/Frontend/src/pages/SurveyAnalysisPage.tsx)

---

## 0. Hai quy ước dùng chung cho cả 5 tab

### 0.1. Lớp nào được đưa vào tính

`LoadAnalysedSectionsAsync` **loại bỏ lớp không có phiếu hợp lệ nào**:

```csharp
if (!tallies.TryGetValue(css.CourseSectionSurveyId, out var tally) || tally.ValidCount == 0)
    continue;
```

Nên 1830 lớp của đợt chỉ còn **1825 lớp** vào bảng. 4 lớp chưa ai nộp phiếu và 1
lớp chỉ có phiếu bị lọc đều biến mất khỏi mọi con số trong 5 tab.

### 0.2. Lớp thuộc khoa nào, bộ môn nào

Bảng `CourseSections` không giữ khoa/bộ môn riêng. Thứ tự suy ra:

| Cần | Thứ tự ưu tiên |
|---|---|
| Bộ môn | bộ môn của **học phần** → bộ môn của **giảng viên** |
| Khoa | khoa của **học phần** → khoa của **bộ môn** vừa suy ra → khoa của **giảng viên** |

Không ra được thì gom vào "Chưa thuộc khoa" / "Chưa thuộc bộ môn". Trang *Lớp học
phần* dùng đúng thứ tự này nên hai màn hình luôn khớp nhau.

### 0.3. Điểm của một lớp

Trung bình `Score` của **các phiếu hợp lệ**. `Score` của một phiếu là trung bình
29 câu chấm điểm — bỏ câu bẫy C16 và câu thang tự nhập. Phiếu bị lọc
(`IsValid = false`) vẫn tính là một lượt nộp nhưng không vào điểm.

> **Quan trọng:** mọi phép trung bình ở cấp khoa / bộ môn / học phần đều lấy
> trung bình **điểm của các lớp**, không phải trung bình các phiếu. Mỗi lớp một
> phiếu bầu — lớp 113 sinh viên và lớp 10 sinh viên cân bằng nhau.

---

## 1. Tab "Mặt bằng khoa/viện"

Mỗi dòng là một khoa/viện. Code: `GetSemesterSurveyNormalizationAsync`, phần
dựng `groups`.

| Cột | Cách tính |
|---|---|
| **Khoa / Viện** | Theo mục 0.2 |
| **Số lớp** | Đếm lớp của khoa **có phiếu hợp lệ** (mục 0.1) |
| **Điểm TB khoa** | Trung bình cộng điểm của các lớp trong khoa, làm tròn 3 số |
| **Độ lệch chuẩn** | Độ lệch chuẩn **mẫu** của các điểm lớp đó — xem 1.1. Dưới 2 lớp trả `—` |
| **Chuẩn hoá được** | `Có` khi số lớp ≥ **5**. Ít hơn thì hiện "Quá ít lớp" |

Dòng **TOÀN TRƯỜNG** tính trên cả 1825 lớp, **không phải** trung bình của 14 dòng
phía trên. Hai cách cho kết quả khác nhau vì các khoa có số lớp rất chênh
(207 lớp so với 35 lớp).

Bảng sắp xếp theo **số lớp giảm dần**, không phải theo điểm — nên đây không phải
bảng xếp hạng.

### 1.1. Vì sao khoa Đóng tàu ra 0.493

Khoa Đóng tàu có 35 lớp. Điểm 35 lớp đó, sắp tăng dần:

```
2.69 2.87 2.90 2.96 2.98 3.00 3.04 3.15 3.25 3.26 3.27 3.30 3.34 3.36 3.38
3.42 3.44 3.57 3.61 3.63 3.72 3.79 3.81 3.86 3.91 3.97 4.08 4.10 4.13 4.20
4.23 4.27 4.31 4.33 4.42
```

Bốn bước của `SampleStandardDeviation`:

1. **Trung bình** = tổng / 35 = **3.587** — chính là cột "Điểm TB khoa".
2. **Cộng bình phương khoảng cách tới trung bình.** Lớp 2.69 lệch −0.897 →
   `0.804`; lớp 4.42 lệch +0.833 → `0.694`; cứ thế 35 lớp. Tổng = **8.2575**.
   Bình phương để lệch âm và lệch dương không triệt tiêu nhau.
3. **Chia cho n−1 = 34** → phương sai `8.2575 / 34 = 0.24287`.
4. **Căn bậc hai** → `√0.24287 = 0.4928` → làm tròn **0.493**. ✔

**Vì sao chia 34 chứ không chia 35.** 35 lớp này là một *mẫu*. Trung bình 3.587
tính ra từ chính mẫu đó nên luôn nằm sát các điểm của mẫu hơn trung bình thật,
khiến tổng bình phương hụt một cách hệ thống. Chia `n−1` (hiệu chỉnh Bessel) bù
lại. Chia 35 sẽ ra 0.486 — thấp hơn 1.4%. Mẫu càng nhỏ chênh càng lớn: với 5 lớp
là 11%.

**Vì sao dưới 2 lớp trả null.** Một lớp thì `n−1 = 0`, chia cho 0. Trả `null` để
bảng hiện `—` thay vì vỡ.

**Đọc con số này.** 0.493 là độ lệch chuẩn **lớn nhất trong 14 khoa** (thấp nhất
là Viện Môi trường 0.417). Nghĩa là các lớp của Đóng tàu tản rộng nhất — điểm trải
từ 2.69 đến 4.42. Kết hợp với mặt bằng thấp nhất trường (3.587), đây là khoa vừa
yếu vừa không đều.

### 1.2. Nếu áp 68-95-99.7 vào tab này

Tab hiện **không có cột nào dùng Z**. Áp quy tắc nghĩa là **thêm cột mới**, không
đổi cột cũ. Hai cách tính Z cho một khoa, cho kết quả rất khác nhau:

| Khoa | Số lớp | Điểm TB | Z theo SD trường | Z theo sai số chuẩn |
|---|---:|---:|---:|---:|
| Công nghệ thông tin | 142 | 3.749 | +0.14 | **+1.61** |
| Quản trị tài chính | 131 | 3.730 | +0.09 | +1.06 |
| Viện Môi trường | 102 | 3.719 | +0.07 | +0.70 |
| Hàng hải | 175 | 3.703 | +0.04 | +0.47 |
| Kinh tế VTB | 207 | 3.697 | +0.02 | +0.31 |
| Cơ khí | 128 | 3.697 | +0.02 | +0.24 |
| Lý luận CT | 132 | 3.695 | +0.02 | +0.19 |
| Điện- ĐTTB | 134 | 3.690 | +0.01 | +0.08 |
| Máy tàu biển | 56 | 3.693 | +0.01 | +0.08 |
| IMET | 45 | 3.672 | −0.03 | −0.23 |
| GDTC | 169 | 3.661 | −0.06 | −0.75 |
| Cơ bản cơ sở | 205 | 3.648 | −0.09 | −1.23 |
| Đóng tàu | 35 | 3.587 | −0.22 | **−1.31** |
| Ngoại ngữ | 164 | 3.635 | −0.11 | **−1.47** |

- **Z theo SD trường** = `(TB khoa − 3.687) / 0.453`. Vô dụng ở đây: trung bình
  của 100-200 lớp thì ổn định hơn nhiều so với một lớp lẻ, nên mọi khoa đều nằm
  trong khoảng ±0.22. **Không khoa nào chạm 1σ** — cả 14 dòng đều "bình thường",
  cột thêm vào mà không nói được gì.
- **Z theo sai số chuẩn** = `(TB khoa − 3.687) / (0.453 / √n)`. Đây mới là phép
  đúng khi so *trung bình nhóm* với mặt bằng. Ra **4 khoa vượt ±1σ**: CNTT
  (+1.61) và Quản trị tài chính (+1.06) trên mặt bằng; Cơ bản cơ sở (−1.23), Đóng
  tàu (−1.31), Ngoại ngữ (−1.47) dưới mặt bằng. Không khoa nào chạm 2σ.

**Kết luận cho tab 1:** áp được và **có ích**, nhưng phải dùng **sai số chuẩn**
`σ/√n` chứ không phải `σ`. Đây là điểm dễ sai nhất trong cả tài liệu này: chia
nhầm mẫu số thì 14 khoa dồn hết vào vùng bình thường. Kết quả 5 tab hiện tại
**không đổi** vì đây là cột mới hoàn toàn.

---

## 2. Tab "Chuẩn hoá từng lớp"

Mỗi dòng là một lớp. Code: `GetSemesterSurveyNormalizationAsync`, phần dựng `rows`.

| Cột | Cách tính |
|---|---|
| **Mã HP · Học phần · Lớp** | Từ `Courses` và `CourseSections` |
| **Giảng viên** | Tên giảng viên; chưa gắn được thì lấy tên đọc từ file import; không có nữa thì "Chưa phân công" |
| **Khoa / Viện** | Theo mục 0.2 |
| **Sĩ số** | `CourseSections.ClassSize`. Không dính đến điểm, chỉ là mẫu số của tỷ lệ phản hồi |
| **Điểm** | Theo mục 0.3 |
| **Z toàn trường** | `(Điểm lớp − 3.687) / 0.453`. SD trường = 0 thì `—` |
| **Z trong khoa** | `(Điểm lớp − TB khoa) / SD khoa`. Khoa < 5 lớp hoặc SD = 0 thì `—` |
| **Chênh 2 cách** | `Z trong khoa − Z toàn trường` |
| **Diễn giải** | Xem 2.2 |

### 2.1. Ví dụ kiểm chứng

Lớp `18141 N09 Đại số`, GV Phạm Thị Thu Hoài, khoa Cơ bản cơ sở, điểm **4.13**:

```
Z toàn trường = (4.13 − 3.687) / 0.453 = 0.443 / 0.453 = 0.98
Z trong khoa  = (4.13 − 3.648) / 0.414 = 0.482 / 0.414 = 1.16
Chênh 2 cách  = 1.16 − 0.98 = +0.18
```

Chênh dương vì khoa Cơ bản cơ sở vừa có mặt bằng thấp hơn trường (3.648 < 3.687)
vừa **túm tụm hơn** (SD 0.414 < 0.453) — thước ngắn hơn nên cùng một khoảng cách
đếm ra nhiều bước hơn.

Chính vì SD từng khoa khác nhau (0.417 đến 0.493) mà **không thể xếp hạng lớp
bằng điểm thô giữa các khoa khác nhau**. Đó là lý do tồn tại của cả tab này.

### 2.2. Cột Diễn giải hiện tại

Ngưỡng duy nhất: `NotableZScore = 1.00`. Xét theo thứ tự:

| Kết luận | Điều kiện |
|---|---|
| Khoa quá ít lớp để chuẩn hoá | Khoa < 5 lớp |
| Chuẩn hoá làm đổi kết luận rõ rệt | Hai Z **trái dấu** và cả hai ≥ 1 về độ lớn |
| Trên mặt bằng khoa | Z trong khoa ≥ +1.00 |
| Thấp hơn mặt bằng khoa — theo dõi | Z trong khoa ≤ −1.00 |
| Trong vùng bình thường | Còn lại |

Kết quả hiện tại: **341 lớp** trên mặt bằng, **321 lớp** dưới mặt bằng — tổng
**662 lớp = 36.3%** bị gắn nhãn. **0 lớp** đổi kết luận.

Hơn một phần ba số lớp bị đánh dấu thì cột này gần như mất tác dụng phân loại:
nhìn vào bảng thấy nhãn khắp nơi, không biết soi cái nào trước.

### 2.3. Nếu áp 68-95-99.7 vào tab này

Đây là tab **thay đổi nhiều nhất**. Thay 1 mốc bằng 3 mốc:

| Bậc | Điều kiện | Lý thuyết | **Thực tế 1825 lớp** |
|---|---|---:|---:|
| Rất bất thường | \|Z\| ≥ 3 | 0.3% | **0 lớp — 0.0%** |
| Bất thường | 2 ≤ \|Z\| < 3 | 4.2% | **49 lớp — 2.7%** |
| Đáng chú ý | 1 ≤ \|Z\| < 2 | 27.2% | **613 lớp — 33.6%** |
| Bình thường | \|Z\| < 1 | 68.3% | **1163 lớp — 63.7%** |

**Thay đổi thực chất:** 662 lớp đang bị gộp chung một nhãn sẽ tách thành **49 lớp
đáng soi ngay** và 613 lớp chỉ cần biết. Danh sách cần xử lý rút từ 36.3% xuống
**2.7%** — đây mới là con số một trưởng khoa xem hết được trong một buổi.

**Bậc 3σ sẽ luôn rỗng.** Phân phối điểm lớp của đợt này đo được 63.7% / 97.3% /
100% thay vì 68.3 / 95.4 / 99.7 — giữa mỏng hơn, **đuôi cụt hẳn**. Không lớp nào
vượt 3σ. Hai hướng xử lý:

1. **Giữ giả định chuẩn** — chấp nhận bậc 3σ hiếm khi có dòng. Đúng ý nghĩa
   thống kê, và kỳ sau dữ liệu khác có thể xuất hiện.
2. **Dùng phân vị thực tế** — lấy đúng top/bottom 0.3% và 4.5% của đợt, luôn có
   dòng nhưng ý nghĩa đổi từ "bất thường" sang "cực trị của kỳ này".

> Một phần của đuôi cụt là do dữ liệu mẫu sinh ngày 2026-08-25 dùng mức chất
> lượng lớp có biên chặn cứng. Dữ liệu thật có thể có đuôi dày hơn.

---

## 3. Tab "Tổng hợp theo bộ môn"

Mỗi dòng là một bộ môn. Code: `GetSemesterSurveyDepartmentSummaryAsync`.

| Cột | Cách tính |
|---|---|
| **Khoa / Viện · Bộ môn** | Theo mục 0.2 |
| **Số lớp** | Đếm lớp có phiếu hợp lệ thuộc bộ môn |
| **Số GV** | Đếm giảng viên **phân biệt** dạy các lớp đó (`CountLecturers`) |
| **Số phiếu** | Tổng **mọi** lượt nộp, kể cả phiếu bị lọc |
| **Tỷ lệ PH BQ** | Trung bình của `Số phiếu ÷ Sĩ số` **từng lớp**, rồi ×100. Không phải tổng phiếu chia tổng sĩ số — lớp bỏ trống sĩ số bị loại khỏi phép này |
| **Điểm tổng hợp** | Trung bình điểm của các lớp trong bộ môn |
| **Lớp cảnh báo** | Đếm lớp có điểm **< 3.20** (`LowScore`) |
| **Câu hỏi yếu nhất** | Gộp mọi phiếu hợp lệ của bộ môn theo từng câu, lấy câu điểm thấp nhất. Bỏ câu bẫy và câu tự nhập |
| **Điểm câu yếu** | Điểm trung bình của chính câu đó |

Điểm câu yếu tính bằng `tổng điểm ÷ tổng lượt trả lời` trên toàn bộ môn — đây là
trung bình **theo phiếu**, không phải theo lớp. Khác quy ước 0.3, và là chỗ duy
nhất trong 5 tab làm vậy.

Dòng **Toàn trường** ở chân bảng tính trước khi lọc theo quyền, nên trưởng bộ môn
chỉ thấy một dòng của mình nhưng vẫn có mặt bằng toàn trường để so.

### 3.1. Nếu áp 68-95-99.7 vào tab này

Cột **Lớp cảnh báo** dùng ngưỡng **tuyệt đối** 3.20, trả lời câu hỏi *"lớp này có
đủ tốt không?"*. Z trả lời câu khác: *"lớp này có bất thường so với xung quanh
không?"*.

**Không nên thay.** Ba lý do:

1. `LowScore` dùng chung với dashboard và trang Tổng quan. Đổi ở đây là hai màn
   hình nói ngược nhau về cùng một việc.
2. Ngưỡng tuyệt đối có ý nghĩa **cố định theo thời gian**. 3.20 kỳ này và 3.20 kỳ
   sau là cùng một mức hài lòng. Z thì không — cả trường cùng tệ đi thì vẫn luôn
   có ~16% lớp "trên mặt bằng".
3. Hiện có **294 lớp cảnh báo — 16.1%**. Con số này đã đủ chọn lọc, không phải
   vấn đề như 36.3% của tab 2.

**Nên làm thay:** thêm **một cột mới** "Z bộ môn" = `(Điểm tổng hợp bộ môn − 3.687)
/ (0.453/√n)` — cùng phép sai số chuẩn như mục 1.2, để thấy bộ môn nào lệch mặt
bằng chung một cách có ý nghĩa thống kê. Giữ nguyên cột Lớp cảnh báo.

Kết quả các cột hiện tại: **không đổi**.

---

## 4. Tab "Chẩn đoán học phần"

Mỗi dòng là một học phần, gộp các lớp cùng học phần. Code: `BuildCourseDiagnosisAsync`.

| Cột | Cách tính |
|---|---|
| **Mã HP · Học phần · Khoa** | Từ `Courses` |
| **Số lớp** | Đếm lớp có phiếu hợp lệ của học phần |
| **Số GV** | Đếm giảng viên phân biệt |
| **Điểm TB** | Trung bình điểm các lớp |
| **Lớp thấp nhất** | `min` điểm lớp |
| **Lớp cao nhất** | `max` điểm lớp |
| **Biên độ** | `max − min` |
| **Câu hỏi yếu nhất · Điểm câu yếu** | Như tab 3, gộp theo học phần |
| **Kết luận** | Xem 4.1 |

Tab này **không dùng mặt bằng toàn trường** — chỉ so các lớp trong cùng một học
phần với nhau. Ý đồ: tách lỗi *học phần* khỏi lỗi *giảng viên*.

### 4.1. Bốn kết luận, xét theo thứ tự

```csharp
if (max < 3.20)  return CourseIssue;        // Mọi lớp đều thấp
if (min >= 4.00) return AllGood;            // Mọi lớp đều tốt
if (spread >= 0.80) return LecturerVariance;// Khác biệt do giảng viên
return Inconclusive;
```

"Mọi lớp đều thấp" xét trước vì đó là tín hiệu mạnh nhất: lớp tốt nhất còn dưới
ngưỡng thì biên độ rộng hay hẹp cũng không đổi được kết luận.

Kết quả hiện tại trên 403 học phần:

| Kết luận | Số HP | Tỷ lệ |
|---|---:|---:|
| Mọi lớp đều thấp | 16 | 4.0% |
| Mọi lớp đều tốt | 35 | 8.7% |
| **Khác biệt do giảng viên** | **168** | **41.7%** |
| Chưa đủ cơ sở kết luận | 184 | 45.7% |

### 4.2. Lỗi thống kê thật ở cột Biên độ

**`WideSpread = 0.80` không phải chuyện chọn mốc lỏng hay chặt — nó là một phép
đo sai.** Biên độ `max − min` **tự nở ra khi số lớp tăng**, kể cả khi mọi giảng
viên dạy như nhau. Càng nhiều lớp thì càng dễ vớ được một lớp cao bất thường và
một lớp thấp bất thường.

Đo trên chính dữ liệu này:

| Số lớp của học phần | Số HP | Biên độ TB | % vượt ngưỡng 0.80 |
|---:|---:|---:|---:|
| 2 | 95 | 0.54 | 27.4% |
| 3 | 50 | 0.73 | 42.0% |
| 4 | 44 | 0.83 | 54.5% |
| 5 | 16 | 1.17 | 87.5% |
| 6 | 23 | 1.06 | 78.3% |
| **7 trở lên** | **60** | 1.20 – 2.09 | **≈ 100%** |

**Mọi học phần từ 7 lớp trở lên đều bị quy cho giảng viên.** Không phải vì giảng
viên của chúng chênh nhau, mà chỉ vì chúng có nhiều lớp. Học phần 40 lớp có biên
độ trung bình 2.09 — gấp 2.6 lần ngưỡng, gần như không thể không vượt.

### 4.3. Nếu áp 68-95-99.7 vào tab này

Thay `max − min ≥ 0.80` bằng **độ lệch chuẩn của các lớp trong học phần**, so với
SD toàn trường 0.453. SD không nở theo n, nên sửa được đúng cái lỗi trên.

| Cách chấm | Số HP quy cho giảng viên | Tỷ lệ |
|---|---:|---:|
| Hiện tại: biên độ ≥ 0.80 | 168 | 41.7% |
| SD học phần ≥ 0.453 (1σ trường) | **117** | 29.0% |
| SD học phần ≥ 0.680 (1.5σ trường) | **27** | 6.7% |

**Đây là tab đáng sửa nhất**, hơn cả tab 2 — vì tab 2 chỉ là ngưỡng lỏng, còn tab
này đang cho kết luận **sai một cách hệ thống** với học phần nhiều lớp.

Đề xuất: dùng SD học phần với ba bậc 1σ / 1.5σ / 2σ so với SD toàn trường. Giữ
nguyên hai kết luận "Mọi lớp đều thấp" và "Mọi lớp đều tốt" vì chúng dùng ngưỡng
tuyệt đối và đang chạy đúng. Vẫn nên **giữ cột Biên độ để hiển thị** — nó dễ đọc
cho người dùng, chỉ là không dùng để ra kết luận nữa.

---

## 5. Tab "Báo cáo giảng viên"

Chọn một giảng viên rồi bấm Tìm. Code: `GetLecturerSurveyReportAsync`. Đợt này có
343 giảng viên.

### 5.1. Bảng lớp của giảng viên

| Cột | Cách tính |
|---|---|
| **Mã HP · Học phần · Lớp** | Các lớp giảng viên này dạy, có phiếu hợp lệ |
| **Sĩ số** | `CourseSections.ClassSize` |
| **Số phiếu** | **Mọi** lượt nộp của lớp, kể cả phiếu bị lọc |
| **Tỷ lệ PH** | `Số phiếu ÷ Sĩ số × 100`. Sĩ số 0 thì trả 0 |
| **Điểm** | Theo mục 0.3 |
| **Z-Score trong khoa** | `(Điểm lớp − TB khoa) / SD khoa` — **cùng công thức và cùng mặt bằng với tab 2**, cố ý để hai màn hình không nói hai số khác nhau cho cùng một lớp. Khoa < 5 lớp hoặc SD = 0 thì `—` |

Ba số ở đầu tab (số lớp, tổng phiếu, điểm trung bình) lấy trên các lớp của chính
giảng viên đó; điểm trung bình là trung bình **điểm các lớp**, không phải trung
bình các phiếu.

### 5.2. Bảng so từng câu hỏi

| Cột | Cách tính |
|---|---|
| **Câu** | Số thứ tự câu trong bộ câu hỏi (C1…C30), giữ đúng vị trí gốc |
| **Nội dung** | Nội dung câu hỏi |
| **Điểm GV** | **Trung bình** điểm câu đó trên các lớp giảng viên này dạy |
| **Trung vị bộ môn** | **Trung vị** điểm câu đó trên mọi lớp của bộ môn |
| **Trung vị khoa** | **Trung vị** điểm câu đó trên mọi lớp của khoa |
| **Chênh so bộ môn** | `Điểm GV − Trung vị bộ môn` |

**Chỗ cần biết:** cột giảng viên dùng **trung bình**, hai cột đơn vị dùng **trung
vị**. Cố ý — trung vị không bị một lớp cực đoan kéo lệch, hợp làm mốc so cho cả
đơn vị. Nhưng hệ quả là *"Chênh so bộ môn"* đang trừ hai đại lượng khác loại. Với
phân phối cân đối thì chênh lệch không đáng kể; với bộ môn có phân phối lệch thì
con số này khó diễn giải chính xác.

Câu bẫy C16 và câu thang tự nhập không xuất hiện trong bảng này.

### 5.3. Nếu áp 68-95-99.7 vào tab này

Cột **Z-Score trong khoa** dùng chung mặt bằng với tab 2, nên **phải sửa cùng lúc
với tab 2** — sửa một chỗ mà bỏ chỗ kia thì hai màn hình gắn nhãn khác nhau cho
cùng một lớp, đúng thứ mà comment trong code đang cố tránh:

> *"Z trong khoa dùng đúng mặt bằng khoa như sheet 1, để hai màn hình không nói
> hai con số khác nhau cho cùng một lớp."*

Áp 3 bậc vào đây thì mỗi lớp của giảng viên được gắn *Bình thường / Đáng chú ý /
Bất thường / Rất bất thường* thay vì chỉ một con số trần. Phân bố chung vẫn là
63.7% / 33.6% / 2.7% / 0% như mục 2.3.

Cột **Chênh so bộ môn** hiện **không có ngưỡng nào** — chỉ hiện số, người đọc tự
đánh giá. Có thể thêm bậc theo SD của câu đó trong bộ môn, nhưng cần cẩn thận:
đây là điểm **một câu** của **một lớp**, phân tán tự nhiên lớn hơn điểm tổng hợp
nhiều, nên không dùng lại được SD 0.453 của điểm lớp.

---

## 6. Tổng hợp: áp 68-95-99.7 đổi gì ở đâu

| Tab | Thước hiện tại | Loại | Đề xuất | Kết quả có đổi? |
|---|---|---|---|---|
| 1. Mặt bằng khoa/viện | Không có ngưỡng | — | **Thêm** cột Z dùng sai số chuẩn `σ/√n` | Không — cột mới |
| 2. Chuẩn hoá từng lớp | Z ≥ ±1.00 | Tương đối | **Thay** 1 mốc bằng 3 mốc | **Có** — 662 lớp gắn nhãn tách thành 49 + 613 |
| 3. Tổng hợp theo bộ môn | Điểm < 3.20 | Tuyệt đối | **Giữ nguyên**, thêm cột Z bộ môn | Không — cột mới |
| 4. Chẩn đoán học phần | Biên độ ≥ 0.80 | Tuyệt đối | **Thay** biên độ bằng SD học phần | **Có** — 168 HP xuống 117 (1σ) hoặc 27 (1.5σ) |
| 5. Báo cáo giảng viên | Z trong khoa, không ngưỡng | Lai | Áp cùng 3 bậc với tab 2 | **Có** — bắt buộc đồng bộ với tab 2 |

### Nguyên tắc rút ra

**Không thay ngưỡng tuyệt đối bằng Z.** Hai loại trả lời hai câu hỏi khác nhau:

> Tuyệt đối: *"Lớp này có đủ tốt không?"* — Tương đối: *"Lớp này có bất thường so
> với xung quanh không?"*

Bảng cần cả hai. `LowScore = 3.20` và `GoodScore = 4.00` là quyết định nghiệp vụ,
Z không thay được. Chỗ Z nên vào là nơi đang **đã dùng Z mà chỉ có một mốc**
(tab 2, tab 5), và nơi đang dùng một **phép đo sai** (biên độ của tab 4).

### Việc cần làm nếu triển khai

1. Thêm `NotableZScore` bậc 2 và 3 vào `ReportThresholds`, hoặc thay bằng mảng ba
   mốc `1.00 / 2.00 / 3.00`.
2. Mở rộng `NormalizationVerdicts` thêm hai mã cho bậc 2σ và 3σ, kèm nhãn tiếng
   Việt trong `normalizationVerdictLabels`.
3. Sửa `Verdict()` xét ba mốc theo thứ tự giảm dần.
4. Sửa `DiagnoseCourse()` nhận SD học phần thay biên độ; `CourseDiagnosisRowDto`
   thêm trường SD; giữ cột Biên độ để hiển thị.
5. Thêm cột Z cho tab 1 và tab 3 — nhớ dùng `σ/√n`, không phải `σ`.
6. Chốt: bậc 3σ theo giả định chuẩn (sẽ rỗng) hay theo phân vị thực tế.

Ba câu còn để ngỏ, cần quyết trước khi code:

| # | Câu hỏi |
|---|---|
| 1 | Làm cả 5 tab hay chỉ tab 2 và tab 4 (hai chỗ đổi kết quả thật)? |
| 2 | Bậc 3σ: giả định chuẩn hay phân vị thực tế? |
| 3 | Tab 4 lấy mốc 1σ (còn 117 HP) hay 1.5σ (còn 27 HP)? |
