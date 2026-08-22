# Kế hoạch công việc — phân quyền giảng viên

File này ghi dần các yêu cầu và cách sẽ làm cho vai trò `LECTURER`. **Chưa code gì
cả** cho tới khi có yêu cầu rõ ràng.

Nối tiếp [congviec.md](congviec.md) (nhóm A, B, C) và [congviec2.md](congviec2.md)
(nhóm D, E, F, G), nên đánh nhóm tiếp là **H** và **I**.

- Nhánh: `hoang3`
- Cập nhật lần cuối: 2026-08-22

---

## 1. Đang có sẵn những gì

Số liệu bên dưới đọc thẳng từ cơ sở dữ liệu đang chạy, không phải đoán.

### Bốn quyền của `LECTURER`

Ở thời điểm congviec2 kết thúc thì `LECTURER` **chưa có quyền nào**. Giờ đã được
cấp bốn quyền:

| Mã quyền | Mở ra trang |
|---|---|
| `COURSES_ACCESS` | Học phần |
| `COURSE_SECTIONS_ACCESS` | Lớp học phần |
| `COURSE_CAMPAIGNS_ACCESS` | Khảo sát học phần |
| `PROGRESS_ACCESS` | Tiến độ thu phiếu |

Cộng thêm Bảng điều khiển — tab `overview` vốn không đòi quyền
([modulePermissions.ts](src/Frontend/src/auth/modulePermissions.ts)) — là **năm
trang**.

Ảnh chụp màn hình anh gửi chỉ có bốn mục vì lúc đó `PROGRESS_ACCESS` chưa được
cấp. Lấy cơ sở dữ liệu làm chuẩn.

### Nhóm Báo cáo vừa tách làm bốn quyền

Đợt vừa rồi tách `REPORTS_ACCESS` thành bốn mã riêng, tổng số `Permission` từ 13
lên **16**. Hiện `DEPARTMENT_MANAGER` đang bật `SURVEY_STATISTICS_ACCESS` và
`SURVEY_ANALYSIS_ACCESS`, tắt `REPORTS_ACCESS` và `SURVEY_DASHBOARD_ACCESS`.

`LECTURER` không có mã nào trong nhóm này, nghĩa là **giảng viên hiện không xem
được bất kỳ trang báo cáo hay kết quả điểm nào**. Ghi lại vì đây là thứ dễ bị hỏi
tới nhất — xem câu H-e.

### Bảng điều khiển đang dùng nhầm bản của trưởng bộ môn

[App.tsx](src/Frontend/src/App.tsx#L576) chỉ tách đúng hai nhánh:

```
currentTab === 'overview'
    ├── isUnrestrictedRole  → DashboardOverview        (admin)
    └── còn lại             → DepartmentDashboardPage  (rơi cả LECTURER vào đây)
```

`isUnrestrictedRole` ([roles.ts](src/Frontend/src/auth/roles.ts#L16)) chỉ trả
`true` cho `ADMIN` và `SURVEY_ADMIN`, nên giảng viên đang thấy nguyên trang của
trưởng bộ môn: bốn thẻ Lớp học phần / Giảng viên / Tiến độ thu phiếu / Phân tích
chuyên sâu, dải chỉ số bộ môn, và bảng "Việc cần làm" đếm lớp chưa xác định.

Hai trong bốn thẻ đó bấm vào sẽ bị đá ra vì giảng viên không có
`LECTURERS_ACCESS` lẫn `SURVEY_ANALYSIS_ACCESS`.

### Phạm vi dữ liệu đang là phạm vi BỘ MÔN, không phải của riêng giảng viên

Đây là gốc của toàn bộ nhóm H. `UserScope`
([UserScope.cs](src/Backend/Application/Auth/UserScope.cs)) đã trả sẵn cả
`LecturerId` lẫn `DepartmentId`, nhưng **mọi chỗ lọc hiện chỉ dùng
`DepartmentId`**, không phân biệt vai trò:

| Hàm | Điều kiện lọc hiện tại |
|---|---|
| [`GetCoursesAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L1520) | `Courses.DepartmentId = scope.DepartmentId` |
| [`GetCourseSectionsAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L705) | lớp có học phần thuộc `scope.DepartmentId` |
| [`GetCourseSectionSurveysAsync`](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L491) | bài khảo sát của các lớp trên |
| [`GetUnidentifiedLecturersAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L1145) | lớp thiếu giảng viên thuộc `scope.DepartmentId` |

Nên hôm nay đăng nhập bằng profile giảng viên thì thấy đúng bằng trưởng bộ môn.
Ảnh chụp cho thấy rõ: 115 lớp và băng cảnh báo 36 lớp chưa xác định giảng viên.

### Số liệu để tham chiếu

Tài khoản thử `hoangkenji3333@gmail.com` → `Users.LecturerId = 35` → **Bùi Hưng
Nguyên**, bộ môn **Luật hàng hải**, khoa Hàng hải.

| Chỉ số | Của riêng giảng viên 35 | Của bộ môn | Toàn trường |
|---|---|---|---|
| Lớp học phần | **9** | 115 | 500 |
| Bài khảo sát | **9** | 115 | 500 |
| Học phần | **2** | 28 | 486 |
| Giảng viên | — | 14 | 112 |
| Lớp chưa xác định giảng viên | **0** | 36 | 132 |

Cả 9 lớp đều nằm trong học kỳ 1 năm 2025-2026, nên bật đúng học kỳ đó là kiểm
được ngay: **115 lớp phải tụt xuống 9, và 28 học phần xuống 2**.

Con số 2 học phần là vì 9 lớp của ông ấy chỉ trải trên hai học phần — nhiều lớp
N01, N02, N03… của cùng một học phần.

Con số 0 ở dòng cuối là chỗ đáng chú ý nhất, xem H5.

### Ba chỗ hiện chưa có kiểm phạm vi nào

Nhóm D đã gác kỹ giảng viên, học phần và lớp học phần, nhưng còn ba nhóm ghi
**chưa hề gọi `userScope` một lần nào**:

| Nhóm ghi | Hàm | Ai đang gọi được |
|---|---|---|
| Năm học và học kỳ | [`CreateAcademicYearAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L541), [`CreateSemesterAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L637) cùng bản `Update` và `Delete` | Ai có `COURSE_SECTIONS_ACCESS` |
| Đợt khảo sát | [`CreateSemesterSurveyAsync`](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L400), [`DeleteSemesterSurveyAsync`](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L459) | Ai có `COURSE_CAMPAIGNS_ACCESS` |
| Lịch mở đóng phiếu | [`UpdateCourseSectionSurveyScheduleAsync`](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L715) | Ai có `COURSE_CAMPAIGNS_ACCESS` |

Nghĩa là **giảng viên hôm nay xoá được cả năm học, tạo và xoá được đợt khảo sát
của toàn trường**. Xoá năm học còn xoá mềm lây xuống học kỳ và lớp học phần. Đây
là lỗ hổng thật, không phải chuyện ẩn nút.

Lý do trước đây không lộ: `DEPARTMENT_MANAGER` là vai trò tin cậy nên chưa ai để
ý. Giảng viên thì khác hẳn về mức tin cậy, nên nhóm H bắt buộc phải bịt.

### Một chỗ đang lỗi sẵn

[CourseSurveysPage.tsx](src/Frontend/src/pages/CourseSurveysPage.tsx#L124) nạp
`surveyApi.templates()` ngay khi mở trang. Endpoint đó thuộc nhóm
`COURSE_QUESTION_SETS_ACCESS` mà giảng viên không có, nên trả 403 và trang hiện
một dải báo lỗi đỏ. Danh sách đợt vẫn nạp được, chỉ dải lỗi là thừa.

---

## 2. Nhóm H — phân quyền dữ liệu cho giảng viên

### H0. Vẫn theo D0: không tạo trang mới

Ba trang dữ liệu — Học phần, Lớp học phần, Khảo sát học phần — dùng lại nguyên
trang hiện có, lọc ở backend. Lý do y hệt D0: trang chỉ là chỗ hiển thị, không
lọc ở backend thì mở DevTools gọi thẳng API là ra hết.

Ngoại lệ duy nhất là Bảng điều khiển, và đó chính là nhóm I — cùng lý do với F0.

### H1. Nới `UserScope` thêm một mức

`UserScope` hiện có hai mức: thấy hết (`SeesEverything`) và thấy theo bộ môn.
Giảng viên là mức thứ ba — **thấy theo chính mình**.

Không thêm trường mới, vì `LecturerId` đã có sẵn. Chỉ thêm hai thuộc tính suy ra
từ `RoleCode`:

```csharp
/// Chỉ thấy dữ liệu gắn với chính mình, không thấy cả bộ môn.
public bool SeesOnlyOwn => RoleCode == RoleCodes.Lecturer;

/// Không được ghi bất cứ thứ gì. Xem H3.
public bool IsReadOnly => SeesOnlyOwn;
```

Kèm theo phải sửa `SeesNothing`. Hiện nó là:

```csharp
public bool SeesNothing => !SeesEverything && DepartmentId is null;
```

Với giảng viên thì thiếu `LecturerId` mới là ca nguy hiểm, nên điều kiện phải
thành: bị giới hạn theo mình mà không biết mình là ai → cũng trả rỗng. Đúng tinh
thần chú thích đang có ở đó — **tuyệt đối không được rơi vào nhánh không lọc**.

Vẫn giữ nguyên luật của D1: chỉ đúng một file được dựng `UserScope`, là
[EfUserScopeResolver.cs](src/Backend/Infrastructure/Auth/EfUserScopeResolver.cs).
File đó không phải sửa gì — nó đã trả `LecturerId` từ khoá ngoại `Users.LecturerId`.

### H2. "Của giảng viên đó" nghĩa là gì

**Đã chốt H-b: cả ba trang đều quy về đúng một mốc — lớp mình dạy.**

| Trang | Trưởng bộ môn | Giảng viên |
|---|---|---|
| Lớp học phần | lớp có học phần thuộc bộ môn | `CourseSections.LecturerId = mình` |
| Học phần | `Courses.DepartmentId = bộ môn` | học phần có ít nhất một lớp mình dạy |
| Khảo sát học phần | bài khảo sát của các lớp trên | bài khảo sát của 9 lớp mình dạy |
| Tiến độ thu phiếu | ăn theo Khảo sát học phần | ăn theo Khảo sát học phần |

Cụ thể trang Học phần:

```sql
Courses.CourseId IN (
    SELECT CourseId FROM CourseSections WHERE LecturerId = <mình>
)
```

Ba điểm cần nhớ.

**Lớp học phần đổi hẳn trục lọc.** Trưởng bộ môn đi theo *học phần sở hữu* (câu
D-b), giảng viên đi theo *người dạy*. Hai trục khác nhau chứ không phải cùng một
trục xiết chặt hơn.

**Trang Học phần đi theo lớp, không đi theo bộ môn.** Đây là chỗ khác so với lúc
anh mô tả yêu cầu lần đầu — bản đầu là "lọc theo bộ môn của giảng viên", câu H-b
chốt lại thành "theo các học phần có lớp mình dạy". Chênh lệch không nhỏ: tài
khoản thử từ **28 học phần xuống còn 2**.

Đổi lại thì hết hẳn chuyện hai trang lệch nhau: mọi học phần hiện trên trang đều
có ít nhất một lớp của mình ở trang bên cạnh, và ngược lại. Kể cả **11 lớp dạy
chéo bộ môn** toàn trường — giảng viên bộ môn A dạy học phần bộ môn B — giờ cũng
tự khớp, học phần bộ môn B đó vẫn hiện vì mình có lớp dạy.

**Tiến độ thu phiếu không phải sửa gì.**
[SurveyProgressPage.tsx](src/Frontend/src/pages/SurveyProgressPage.tsx) nhận
`sectionSurveys` qua props từ [App.tsx](src/Frontend/src/App.tsx), mà dữ liệu đó
lấy từ `GetCourseSectionSurveysAsync`. Lọc một hàm là xong cả hai trang.

### H3. Giảng viên chỉ đọc, chặn toàn bộ ghi

Anh chốt trang Lớp học phần không thêm sửa xoá gì hết, và "gần như không có cái
gì để làm". Nên luật gọn nhất là **giảng viên không ghi được gì cả**, không có
ngoại lệ nào phải nhớ.

Cách làm: thêm một hàm gác cạnh
[`CheckAdminOnly`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L1816)
đang có:

```csharp
private static string? CheckReadOnly(UserScope scope) =>
    scope.IsReadOnly ? CatalogErrorCodes.OutOfScope : null;
```

Gọi nó ở **đầu mọi hàm ghi**, trước cả `CheckDepartmentInScope`. Vẫn theo bài học
của D4: kiểm phạm vi trước khi validate, không thì lộ dữ liệu bộ môn khác qua
chính mã lỗi trả về.

Danh sách chỗ phải gắn:

| Nhóm | Hàm ghi |
|---|---|
| Lớp học phần | `Create` / `Update` / `Delete` `CourseSectionAsync`, `ImportCourseSectionsAsync` |
| Học phần | `Create` / `Update` / `Delete` `CourseAsync`, `ImportCoursesAsync` |
| Năm học, học kỳ | `Create` / `Update` / `Delete` của `AcademicYear` và `Semester` |
| Đợt khảo sát | `CreateSemesterSurveyAsync`, `DeleteSemesterSurveyAsync` |
| Lịch phiếu | `UpdateCourseSectionSurveyScheduleAsync` |

Bốn nhóm ghi còn lại — giảng viên, khoa, bộ môn, ngành, bộ câu hỏi, khảo sát CTĐT
— không cần gác thêm, vì tầng quyền module đã chặn: giảng viên không có
`LECTURERS_ACCESS`, `FACULTIES_ACCESS`, `DEPARTMENTS_ACCESS`, `MAJORS_ACCESS`,
`COURSE_QUESTION_SETS_ACCESS`, `PROGRAM_*`.

### H4. Ba chỗ hổng ở mục 1 phải bịt luôn

Hai nhóm cuối trong bảng H3 — năm học/học kỳ và đợt khảo sát/lịch phiếu — hiện
chưa gọi `userScope` lần nào. Bịt chúng không chỉ vá cho giảng viên: **trưởng bộ
môn cũng đang xoá được năm học và đợt khảo sát toàn trường**.

Nên gác hai mức một lượt:

| Hàm | Giảng viên | Trưởng bộ môn |
|---|---|---|
| Năm học, học kỳ | chặn | chặn — `CheckAdminOnly` |
| Tạo, xoá đợt khảo sát | chặn | chặn — `CheckAdminOnly` |
| Sửa lịch phiếu | chặn — câu H-c | được, nhưng chỉ lớp trong bộ môn mình |

Hai dòng đầu là mở rộng ra ngoài phạm vi anh yêu cầu, nhưng cùng một lần sửa và
cùng một chỗ code. Ghi lại đây để anh biết là có đụng tới trưởng bộ môn.

Dòng cuối tôi tự quyết vế trưởng bộ môn: câu H-c chỉ chốt phần giảng viên. Giữ
quyền sửa lịch cho trưởng bộ môn vì đó là việc vận hành thật của họ, nhưng phải
thêm `CheckDepartmentInScope` để không sửa được lịch lớp của bộ môn khác — hôm nay
hàm đó chưa kiểm gì cả.

### H5. Không cho giảng viên thấy lớp chưa xác định giảng viên

Yêu cầu này gần như **tự thoả** nhờ H2. Lớp chưa xác định là lớp có
`CourseSections.LecturerId IS NULL`, mà giảng viên lọc theo `LecturerId = mình`,
nên 36 lớp đó rơi ra khỏi danh sách mà không phải viết thêm điều kiện nào.

Nhưng còn hai chỗ **không tự thoả**, phải chặn tay:

**Endpoint danh sách giảng viên thiếu email** —
[`GetUnidentifiedLecturersAsync`](src/Backend/Infrastructure/Catalog/EfCatalogService.cs#L1145)
lọc theo bộ môn, không theo người, nên gọi bằng tài khoản giảng viên vẫn trả về
đủ 36 lớp. Với giảng viên thì trả rỗng.

**Băng cảnh báo trên trang Lớp học phần** —
[ClassesPage.tsx](src/Frontend/src/pages/ClassesPage.tsx#L783) hiện khi
`unidentified.sectionCount > 0`. Endpoint trả rỗng thì băng tự tắt, nên đây chỉ
là hệ quả, không phải việc riêng. Kèm theo đó ba nút "Chỉ hiện lớp chưa xác
định", "Xem theo giảng viên" và "Tải Excel" cũng biến mất.

Và trang Bảng điều khiển cũng gọi endpoint này — xem I2.

### H6. Frontend: chế độ chỉ đọc

Dữ liệu đi qua props nên phần hiển thị không phải sửa. Việc duy nhất là ẩn nút,
và nhắc lại cho chắc: **ẩn nút chỉ để cho gọn mắt, chặn thật nằm ở H3.**

Hiện `isUnrestrictedRole` chỉ phân biệt được quản trị với phần còn lại, không đủ
để nói "vai trò này chỉ đọc". Thêm vào [roles.ts](src/Frontend/src/auth/roles.ts):

```ts
export function isReadOnlyRole(roleCode: string | null | undefined): boolean {
  return roleCode === ROLE_CODES.lecturer;
}
```

Chỗ phải ẩn:

| Trang | Chỗ ẩn |
|---|---|
| Lớp học phần | cả cột **Hành động** ([L588](src/Frontend/src/pages/ClassesPage.tsx#L588)), nút **Thêm lớp học phần** ([L832](src/Frontend/src/pages/ClassesPage.tsx#L832)), nút thêm **năm học** ([L628](src/Frontend/src/pages/ClassesPage.tsx#L628)) và **học kỳ** ([L771](src/Frontend/src/pages/ClassesPage.tsx#L771)) |
| Học phần | cột **Hành động** ([L240](src/Frontend/src/pages/CoursesPage.tsx#L240)), nút **Thêm học phần** ([L291](src/Frontend/src/pages/CoursesPage.tsx#L291)) |
| Khảo sát học phần | nút **Tạo bài khảo sát** ([L303](src/Frontend/src/pages/CourseSurveysPage.tsx#L303)), nút **Xóa đợt** ([L401](src/Frontend/src/pages/CourseSurveysPage.tsx#L401)), nút sửa lịch |
| Khảo sát học phần | bỏ luôn lời gọi `templates()` ([L124](src/Frontend/src/pages/CourseSurveysPage.tsx#L124)) khi vai trò chỉ đọc, để hết dải lỗi 403 |

**Giữ lại nút chép link và nút mã QR** của từng lớp, theo câu H-d. Hai nút đó chỉ
đọc, và giảng viên chính là người đưa link cho sinh viên nên bỏ đi thì hỏng việc.
Nghĩa là hàng nút của mỗi lớp với giảng viên còn đúng hai thứ đó, mất nút sửa
lịch.

Nút Import Excel ở hai trang đầu đã ẩn sẵn từ D5 vì gắn với `canManageAll`.

Cột Hành động ẩn hẳn cả cột chứ không ẩn từng nút, vì ẩn hết nút thì còn lại một
cột trống rộng 92px.

### H7. Không thêm cột, không thêm quyền

Toàn bộ nhóm H nằm ở lớp phân quyền thứ hai. `Users.LecturerId` thêm từ nhóm G đã
đủ, `UserScope` đã trả sẵn `LecturerId`. Không migration, không mã quyền mới.

---

## 3. Nhóm I — bảng điều khiển riêng cho giảng viên

### I1. Đặt ở đâu trong code

Đúng khuôn F1 đã dựng sẵn, chỉ là thêm một nhánh nữa:

```
currentTab === 'overview'
    ├── ADMIN, SURVEY_ADMIN  → DashboardOverview
    ├── LECTURER             → LecturerDashboardPage   (mới)
    └── còn lại              → DepartmentDashboardPage
```

Nhánh giảng viên phải đặt **trước** nhánh mặc định, không thì lại rơi vào trang
của trưởng bộ môn như hiện nay. `auth.activeProfile?.roleCode` đã có sẵn ở
[App.tsx](src/Frontend/src/App.tsx#L576), không phải lấy thêm gì.

### I2. Ba thẻ điều hướng

Anh chốt đúng ba lệnh, và cả ba đều nằm trong bốn quyền giảng viên đang có nên
không thẻ nào bấm vào bị đá ra:

| Thẻ | Tab | Nhãn nhỏ |
|---|---|---|
| Lớp học phần | `classes` | LỚP TÔI DẠY |
| Khảo sát học phần | `course-campaigns` | PHIẾU CỦA LỚP TÔI |
| Tiến độ thu phiếu | `progress` | VẬN HÀNH KHẢO SÁT |

Trang Học phần không lên thẻ, vẫn vào được từ menu bên trái — giống cách F2 để
năm trang còn lại của trưởng bộ môn.

Dùng lại nguyên kiểu thẻ của
[DepartmentDashboardPage.tsx](src/Frontend/src/pages/DepartmentDashboardPage.tsx#L36):
biểu tượng, tiêu đề, dòng mô tả, mũi tên phải.

**Đã chốt I-b: tạm bỏ bảng "Việc cần làm"** của bản trưởng bộ môn. Nó chỉ có đúng
một loại thông báo là đếm lớp chưa xác định giảng viên, mà H5 đã chốt giảng viên
không theo dõi việc đó. Còn lại sẽ luôn là ô trống "Không có việc nào cần xử lý",
nên để hẳn ra ngoài. Khi nào có loại thông báo thật cho giảng viên thì dựng lại.

### I3. Dải chỉ số: hai ô, không đụng điểm

**Đã chốt I-a: có dải, làm bản hai ô.**

| Ô | Số chính | Số phụ bên dưới |
|---|---|---|
| Lớp tôi dạy | số lớp mình dạy trong học kỳ | số bài khảo sát đã phát |
| Tiến độ thu phiếu | % thu được trên các lớp đó | số phiếu đã nộp trên tổng sĩ số |

Cả hai số lấy được từ `GetCourseSectionSurveysAsync` sau khi lọc ở H2 — chính là
dữ liệu trang Tiến độ thu phiếu đang dùng. **Không cần endpoint mới.**

Bản trưởng bộ môn có bốn ô (F4), ở đây bỏ hai: ô "Lớp chưa có giảng viên" bỏ theo
H5, ô "Điểm trung bình" và "Lớp cần lưu ý" bỏ theo H-e — giảng viên chỉ xem tiến
độ thu phiếu, không xem điểm.

Kéo theo: **không có số toàn trường để so** như F4. Dải này chỉ có số của chính
mình. Đó cũng là điều đúng, vì so điểm lớp mình với mặt bằng toàn trường chính là
thứ H-e đã chốt không cho xem.

### I4. Không thêm bảng, không thêm quyền

Giống F5. Tab `overview` vốn không đòi quyền, dữ liệu lấy từ endpoint đã có.

---

## 4. Các bước sẽ làm

> **Đã làm xong toàn bộ 10 bước** trong ngày 22/08/2026. Danh sách dưới đây giữ
> nguyên để đối chiếu; những chỗ làm khác kế hoạch ghi ở mục 9.

1. Nới `UserScope` theo H1: thêm `SeesOnlyOwn`, `IsReadOnly`, sửa `SeesNothing`.
   Kèm test cho ca giảng viên không tra ra `LecturerId` — phải rỗng, không được
   rơi vào nhánh không lọc.
2. Lọc `GetCourseSectionsAsync` theo `LecturerId` cho giảng viên. Kiểm bằng tài
   khoản thử: **115 lớp phải xuống 9**.
3. Lọc `GetCourseSectionSurveysAsync` theo cùng tập lớp đó. Kiểm hai trang một
   lượt: Khảo sát học phần và Tiến độ thu phiếu đều phải còn 9 dòng.
4. Lọc `GetCoursesAsync` theo các học phần có lớp mình dạy, theo H2. Kiểm: **28
   học phần phải xuống 2**.
5. Trả rỗng ở `GetUnidentifiedLecturersAsync` cho giảng viên, theo H5. Trang Lớp
   học phần phải hết băng cảnh báo 36 lớp.
6. Chặn ghi theo H3: thêm `CheckReadOnly`, gắn vào toàn bộ hàm ghi trong bảng.
7. Bịt ba chỗ hổng của H4. Đây là bước đụng tới cả trưởng bộ môn — chặn hẳn năm
   học, học kỳ và đợt khảo sát, riêng lịch phiếu thì thêm kiểm phạm vi bộ môn.
   Làm riêng một lượt cho dễ soát.
8. Frontend chế độ chỉ đọc theo H6: thêm `isReadOnlyRole`, ẩn hai cột Hành động,
   bốn nút thêm, hai nút của trang khảo sát, bỏ lời gọi `templates()`. **Giữ nút
   chép link và nút mã QR** theo H-d.
9. Tách nhánh `overview` cho `LECTURER` theo I1, dựng `LecturerDashboardPage` với
   ba thẻ của I2, không có bảng "Việc cần làm".
10. Làm dải hai ô theo I3.

Bước 1 phải xong trước, mọi bước còn lại đều dựa vào nó. Bước 6 và 7 nên làm sát
nhau vì cùng một kiểu sửa.

---

## 5. Những câu cần anh chốt

### Nhóm H — phân quyền dữ liệu

| # | Câu hỏi | Đã chốt |
|---|---|---|
| H-a | Lớp học phần lọc theo người dạy hay theo bộ môn | **Theo người dạy** — `CourseSections.LecturerId`. Rõ từ yêu cầu, ghi lại thành câu để đối chiếu về sau |
| H-b | Giảng viên dạy lớp của bộ môn khác thì trang Học phần có hiện học phần đó không | **Có. Trang Học phần lọc theo các học phần mà giảng viên có lớp dạy**, thay hẳn luật lọc theo bộ môn. Tài khoản thử từ 28 học phần xuống 2. Hết chuyện hai trang lệch nhau, kể cả 11 lớp dạy chéo. Chi tiết ở H2 |
| H-c | Giảng viên và trưởng bộ môn có được sửa lịch mở đóng phiếu của lớp mình không | **Giảng viên không.** Vế trưởng bộ môn tôi quyết: vẫn được, nhưng thêm kiểm phạm vi để chỉ sửa được lớp trong bộ môn mình. Chi tiết ở H4 |
| H-d | Giảng viên có được xem link và mã QR phiếu của lớp mình không | **Có.** Giữ hai nút đó trên trang Khảo sát học phần, vì giảng viên chính là người đưa link cho sinh viên |
| H-e | Giảng viên có được xem kết quả khảo sát lớp mình không | **Không. Chỉ xem tiến độ thu phiếu.** Không cấp mã quyền nào trong nhóm Báo cáo, không có điểm trên bảng điều khiển |

### Nhóm I — bảng điều khiển riêng

| # | Câu hỏi | Đã chốt |
|---|---|---|
| I-a | Trang bảng điều khiển giảng viên có dải chỉ số không | **Có, bản hai ô**: lớp tôi dạy và tiến độ thu phiếu. Không có ô điểm, không có số toàn trường để so. Chi tiết ở I3 |
| I-b | Bỏ hẳn bảng "Việc cần làm" hay giữ khung để sau thêm loại khác | **Tạm bỏ.** Khi nào có loại thông báo thật cho giảng viên thì dựng lại |

**Toàn bộ câu hỏi đã chốt.**

---

## 6. Tổng hợp cột dự kiến thêm

**Không thêm cột nào, không có migration.** Mọi thứ cần dùng đều đã có sau nhóm G.

| Thứ cần | Lấy từ đâu | Đã có chưa |
|---|---|---|
| Vai trò của phiên đăng nhập | claim `active_profile_id` → `UserProfiles.RoleId` | Có |
| Giảng viên của người đăng nhập | `Users.LecturerId` | Có, thêm từ nhóm G |
| Lớp của giảng viên | `CourseSections.LecturerId` | Có |
| Bài khảo sát của lớp | `CourseSectionSurveys.CourseSectionId` | Có |
| Bộ môn của học phần | `Courses.DepartmentId` | Có |

---

## 7. Yêu cầu tiếp theo

_(chờ anh mô tả thêm)_

---

## 8. Làm khác kế hoạch chỗ nào

Bốn chỗ lệch so với mục 2 và 3, đều theo hướng chặt hơn.

### 8a. `CheckReadOnly` gác từ bên trong, không rải ra từng endpoint

H3 viết là gọi `CheckReadOnly` ở đầu mọi hàm ghi. Lúc code thì thấy **mọi hàm ghi
mà giảng viên với tới được đều đã gọi sẵn `CheckDepartmentInScope` hoặc
`CheckAdminOnly`**, nên rải thêm một lời gọi nữa chỉ là lặp.

Đặt `CheckReadOnly` vào ngay trong `CheckDepartmentInScope` thay vì rải ra ngoài.
Cái được là không quên được chỗ nào: hàm ghi nào cũng phải đi qua đúng một cửa.
Đây là chỗ nguy hiểm vì **giảng viên VẪN có `DepartmentId`**, nên nếu chỉ so bộ môn
thì mọi thao tác trong bộ môn của chính họ đều lọt.

`CheckAdminOnly` không phải sửa, nó vốn đã từ chối mọi vai trò bị giới hạn.

### 8b. Thêm `GetLecturersAsync` vào diện lọc, ngoài ba trang của H2

Giảng viên không có `LECTURERS_ACCESS` nên không vào được trang Giảng viên, nhưng
**vẫn gọi được endpoint** — trang Lớp học phần cần nó để đọc tên người dạy. Chính
sách nhóm là `LecturersRead`, mà nhóm đó nhận cả `COURSE_SECTIONS_ACCESS`.

Nếu để nguyên thì hàm rơi vào nhánh lọc theo bộ môn và trả về **14 hồ sơ kèm
email** cho một vai trò chỉ đọc. Mà mọi lớp của họ đều do chính họ dạy nên chỉ cần
đúng một bản ghi. Đã lọc `LecturerId = mình`.

### 8c. Bốn hàm khôi phục cũng chưa kiểm phạm vi

H4 kể ba chỗ hổng. Lúc bịt thì thấy thêm: `RestoreAcademicYearAsync`,
`RestoreSemesterAsync`, `RestoreCourseSectionAsync` và `RestoreCourseAsync` **cũng
không gọi `userScope` lần nào**. Khôi phục đi cùng cặp với xoá nên đã gán đúng luật
của hàm xoá tương ứng: ba hàm đầu và học phần là quản trị, riêng lớp học phần thì
theo bộ môn.

### 8d. Ẩn thêm lối tắt sang trang báo cáo

H6 không kể hai chỗ này, nhưng chúng dẫn thẳng sang trang Thống kê & Báo cáo mà
câu H-e đã chốt giảng viên không được vào: nút **Kết quả** của từng lớp, và **số
lượt trả lời** vốn cũng là một nút điều hướng. Với vai trò chỉ đọc thì nút Kết quả
ẩn hẳn, còn số lượt trả lời đổi thành chữ thường không bấm được.

Kèm theo là một mã lỗi mới `SURVEY_OUT_OF_SCOPE`, song song với
`CATALOG_OUT_OF_SCOPE` đã có, và map sang 403 trong `SurveyEndpoints`.

---

## 9. Nhật ký

| Ngày | Nội dung |
|---|---|
| 2026-08-22 | Tách nhóm Báo cáo trong trang Phân quyền Module thành bốn quyền riêng: `SURVEY_DASHBOARD_ACCESS`, `REPORTS_ACCESS`, `SURVEY_STATISTICS_ACCESS`, `SURVEY_ANALYSIS_ACCESS`. Tổng `Permission` từ 13 lên 16. Backend tách `statisticsGroup` thành bốn nhóm route, thêm policy gộp `ReportingRead` cho endpoint dùng chung. |
| 2026-08-22 | Nhận yêu cầu phân quyền cho vai trò `LECTURER`, lập file kế hoạch này. Đọc lại hiện trạng: `LECTURER` giờ có bốn quyền, nhưng phạm vi dữ liệu vẫn đang là phạm vi bộ môn nên giảng viên thấy đúng bằng trưởng bộ môn — 115 lớp thay vì 9. Bảng điều khiển cũng đang rơi vào bản của trưởng bộ môn vì `App.tsx` mới tách hai nhánh. |
| 2026-08-22 | Phát hiện ba nhóm ghi chưa gọi `userScope` lần nào: năm học/học kỳ, tạo và xoá đợt khảo sát, sửa lịch phiếu. Nghĩa là giảng viên hiện xoá được cả năm học và đợt khảo sát toàn trường — trưởng bộ môn cũng vậy. Đưa vào H4, sẽ bịt cả hai vai trò một lượt. |
| 2026-08-22 | Ghi nhận yêu cầu "không cho giảng viên thấy lớp chưa có giảng viên" gần như tự thoả nhờ lọc theo `LecturerId`, chỉ còn phải chặn tay endpoint `GetUnidentifiedLecturersAsync`. Treo năm câu H-a đến H-e và hai câu I-a, I-b. |
| 2026-08-22 | Chốt nốt cả bảy câu. H-b đổi luật trang Học phần: **theo các học phần có lớp mình dạy** chứ không theo bộ môn như bản mô tả đầu — tài khoản thử từ 28 học phần xuống 2, đổi lại là hai trang Học phần và Lớp học phần khớp nhau hoàn toàn, kể cả 11 lớp dạy chéo bộ môn. Nên bỏ luôn mục H2-b. H-c: giảng viên không sửa lịch phiếu; vế trưởng bộ môn tôi quyết là vẫn cho nhưng thêm kiểm phạm vi. H-d: giữ nút chép link và mã QR. H-e: không cho xem điểm, chỉ tiến độ thu phiếu. I-a: dải hai ô, không có số toàn trường để so. I-b: tạm bỏ bảng "Việc cần làm". **Bắt đầu code.** |
| 2026-08-22 | Một chỗ để ý lúc dựng `LecturerDashboardPage`: `DepartmentDashboardPage` lấy đợt khảo sát bằng `surveys.at(-1)`, nhưng backend sắp `OrderByDescending(SemesterSurveyId)` nên đó là đợt **cũ nhất** chứ không phải mới nhất. Học kỳ đang có đúng một đợt nên chưa lộ. Trang mới dùng `surveys[0]`; **chưa sửa trang của trưởng bộ môn** vì đó là đổi hành vi của vai trò khác, ghi lại đây để hỏi. |
| 2026-08-22 | **Hết 10 bước.** 132 test, build và lint sạch cả hai phía. Bốn chỗ làm khác kế hoạch ghi ở mục 8, đều theo hướng chặt hơn: gác `CheckReadOnly` từ trong `CheckDepartmentInScope` thay vì rải ra từng endpoint, lọc thêm `GetLecturersAsync` xuống còn đúng hồ sơ của mình, bịt thêm bốn hàm khôi phục cũng chưa kiểm phạm vi, và ẩn thêm hai lối tắt sang trang báo cáo. Còn để sau: bảng "Việc cần làm" của giảng viên khi có loại thông báo thật (câu I-b). |
