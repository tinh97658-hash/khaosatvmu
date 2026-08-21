# Kế hoạch công việc — phân quyền trưởng bộ môn

File này ghi dần các yêu cầu và cách sẽ làm cho phần phân quyền theo phạm vi dữ
liệu. **Chưa code gì cả** cho tới khi có yêu cầu rõ ràng.

Nối tiếp [congviec.md](congviec.md), nên đánh nhóm tiếp là **D**, **E**, **F** và
**G** cho khỏi lẫn với ba nhóm A, B, C bên đó.

- Nhánh: `hoang3`
- Cập nhật lần cuối: 2026-08-22

---

## 1. Đang có sẵn những gì

Phần này ghi lại hiện trạng để lát nữa bàn yêu cầu thì có cái mà đối chiếu. Tất
cả số liệu bên dưới đều đọc thẳng từ cơ sở dữ liệu đang chạy chứ không phải đoán.

### Hai lớp phân quyền

Tài liệu [docs/plans/upgrade-phan-quyen-theo-scope.md](docs/plans/upgrade-phan-quyen-theo-scope.md)
đã chốt mô hình: tách hẳn làm hai lớp, không gộp.

Lớp một là **quyền vào module**. Đi theo đường `Role → RolePermission →
Permission → Module`, chỉ trả lời được câu "có được vào trang này không".

Lớp hai là **quyền trên dữ liệu**. Đi theo đường `Role → Business Logic →
Lecturer/Department/Faculty → Data`, trả lời câu "vào rồi thì thấy dữ liệu nào".

Hiện tại **lớp một đã chạy, lớp hai chưa có một dòng code nào**. Đó chính là toàn
bộ khối lượng công việc của file này.

### Bảng `Roles`

| Code | Name |
|---|---|
| `ADMIN` | Administrator |
| `SURVEY_ADMIN` | Survey administrator |
| `DEPARTMENT_MANAGER` | Department manager |
| `LECTURER` | Lecturer |

Có một chỗ cần đính chính so với tài liệu. Tài liệu gọi trưởng bộ môn là
`HEAD_OF_DEPARTMENT` và có nhắc tới `DEAN` cho trưởng khoa, nhưng **trong cơ sở
dữ liệu tên thật là `DEPARTMENT_MANAGER`, và `DEAN` thì chưa tồn tại**. Làm thì
phải theo tên thật, đừng theo tên trong tài liệu.

### Mười ba `Permission`

Tất cả đều có đuôi `_ACCESS`, tức là chỉ quản quyền vào module chứ không quản
thêm sửa xoá:

```
COURSES_ACCESS               COURSE_CAMPAIGNS_ACCESS
COURSE_QUESTION_SETS_ACCESS  COURSE_SECTIONS_ACCESS
DEPARTMENTS_ACCESS           FACULTIES_ACCESS
LECTURERS_ACCESS             MAJORS_ACCESS
PROGRAM_CAMPAIGNS_ACCESS     PROGRAM_CRITERIA_ACCESS
PROGRESS_ACCESS              REPORTS_ACCESS
USER_ADMIN_ACCESS
```

### `RolePermissions` đang gán như thế nào

| Role | Số quyền |
|---|---|
| `ADMIN` | 13 |
| `SURVEY_ADMIN` | 12 |
| `DEPARTMENT_MANAGER` | 6 |
| `LECTURER` | **0** |

Sáu quyền của `DEPARTMENT_MANAGER` là `PROGRESS_ACCESS`, `REPORTS_ACCESS`,
`LECTURERS_ACCESS`, `COURSES_ACCESS`, `COURSE_SECTIONS_ACCESS`,
`COURSE_CAMPAIGNS_ACCESS`.

`LECTURER` chưa được gán quyền nào, nên đăng nhập bằng profile giảng viên hiện
chưa vào được module nào cả.

### Backend chặn bằng cách nào

Mỗi mã quyền được sinh thành một policy tên `PERMISSION_<CODE>` ở
[Program.cs](src/Backend/API/Program.cs#L148), rồi từng nhóm route khai báo policy
của nó bằng `.RequireAuthorization(AuthPolicies.LecturersAccess)`.

Khi có request thì `HasPermissionAsync` ở
[EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L169) đọc
claim `active_profile_id`, lần ra `RoleId` của **profile đang hoạt động**, rồi tra
`RolePermissions`. Không có thì trả 403.

Điểm đáng nhớ: nó đọc role của profile chứ không phải của user. Nên một người có
hai profile thì đổi profile là đổi luôn bộ quyền, không phải đăng nhập lại bằng
tài khoản khác.

Ngoài ra `AuthPolicies` có sẵn cả cặp `*_ACCESS` và `*_READ` — ví dụ
`LecturersRead` cho endpoint chỉ đọc, `LecturersAccess` cho endpoint ghi. Đây là
chỗ duy nhất hiện đang phân biệt đọc với ghi.

Một đính chính nữa so với tài liệu: tài liệu vẽ luồng bắt đầu bằng `JWT`, nhưng
hệ thống thật dùng **cookie và session lưu ở server** (`AddCookie` trong
[AuthSetup.cs](src/Backend/API/Auth/AuthSetup.cs#L54)), không dùng JWT.

### Frontend ẩn menu bằng cách nào

Bảng ánh xạ trang sang quyền nằm ở
[modulePermissions.ts](src/Frontend/src/auth/modulePermissions.ts). Ba chỗ dùng
nó: [Sidebar.tsx](src/Frontend/src/components/Sidebar.tsx#L116) lọc menu,
[App.tsx](src/Frontend/src/App.tsx#L128) đá người dùng ra khỏi tab không có quyền
kể cả khi gõ thẳng hash, và [App.tsx](src/Frontend/src/App.tsx#L99) quyết định có
gọi API nạp dữ liệu nền hay không.

Đây chỉ là chuyện ẩn menu cho gọn, **không phải bảo mật**. Bảo mật nằm ở backend.

### Chỗ nối `Users` với `Lecturers` — chưa có

Đây là chỗ vướng nhất.

Bảng `Lecturers` hiện chỉ có `LecturerId`, `FullName`, `DepartmentId`,
`FacultyId`, `Email`, `PhoneNumber`, `PositionId`. **Không có cột `UserId`.**

Quét toàn bộ backend cũng không thấy một dòng nào nối user đang đăng nhập với
bản ghi giảng viên, kể cả nối bằng email. Nghĩa là lớp hai hiện chưa có điểm bắt
đầu: đăng nhập xong không có đường nào đi từ `UserId` ra `LecturerId`.

**Đã chốt: nối bằng cách so email giữa `Users` và `Lecturers`.** Mục 11 của tài
liệu đề xuất thêm `Lecturers.UserId FK UNIQUE` — **bỏ qua, không làm.** Cách làm
cụ thể ghi ở mục D1.

### Có sẵn một mầm scope nhưng chưa ai dùng

`UserProfile.OrganizationUnitCode` ([AuthModels.cs](src/Backend/Domain/AuthModels.cs#L25))
đã tồn tại, và `HasPermissionAsync` đã biết nhận thêm tham số
`resourceOrganizationUnitCode` để so khớp với nó. Nhưng:

- Chưa endpoint nào truyền tham số đó vào, nên nhánh so khớp chưa chạy bao giờ.
- Cả hai profile của tài khoản đang test đều để **trống** cột này, mà trống thì
  code hiểu là không giới hạn.

Tài liệu hoàn toàn không nhắc tới cột này. Nên đây là ngã ba: lấy phạm vi từ
`UserProfile.OrganizationUnitCode`, hay lấy từ `Lecturers.DepartmentId`. Xem câu
D-a.

### Tài khoản đang dùng để thử

| Bảng | Dữ liệu |
|---|---|
| `Users` | Id `f1cea7e3-…`, Email `hoangkenji3333@gmail.com`, DisplayName **Hoàng Bùi** |
| `Lecturers` | LecturerId **35**, FullName **Bùi Hưng Nguyên**, cùng email, Bộ môn **Luật hàng hải**, Khoa Hàng hải, 9 lớp |
| `UserProfiles` | `Truong Bo Mon` → `DEPARTMENT_MANAGER`, và `Giang Vien` → `LECTURER` |

Nối được là nhờ trùng email, và hiện đó là mối liên hệ duy nhất — chỉ đúng khi
người ta tự nhìn hai bảng chứ hệ thống chưa biết.

Hai điểm rút ra từ ví dụ này:

**Tên hai bên lệch hẳn.** User là "Hoàng Bùi", giảng viên là "Bùi Hưng Nguyên".
Nên khi làm màn hình gán user với giảng viên thì đừng dựa vào tên để gợi ý hay
xác nhận. Chỉ email khớp, tên thì không.

**Đã có sẵn ca thử hai mức phạm vi trên cùng một người.** Chọn profile "Giang
Vien" thì phạm vi là 9 lớp của riêng ông ấy; chọn "Truong Bo Mon" thì phạm vi là
toàn bộ bộ môn Luật hàng hải. Rất tiện để kiểm.

### Vấn đề đang nhìn thấy trên màn hình

Trưởng bộ môn Luật hàng hải đăng nhập vào trang Giảng viên thì thấy **112 kết
quả**, tức là toàn bộ giảng viên của cả bốn khoa, trong khi bộ môn ông ấy chỉ có
**14 người**. Mỗi dòng còn có đủ nút sửa và nút xoá.

Chuyện tương tự xảy ra ở Học phần, Lớp học phần, Khảo sát học phần và cả bốn
trang báo cáo. Bốn màn hình đó đang dùng lại nguyên si màn hình của admin.

### Số liệu để tham chiếu

| Chỉ số | Giá trị |
|---|---|
| Tổng giảng viên | 112 |
| Giảng viên có email | 112 (không ai trống, không ai trùng) |
| Lớp chưa xác định giảng viên | 132 |
| Bộ môn có lớp chưa xác định | 12 |

Riêng con số email thì cần nhớ bối cảnh: sau khi revert `ffd43a8`, cột
`Lecturers.Email` đã quay lại `NOT NULL DEFAULT ''` và 44 giảng viên trống email
bị xoá. Nên hôm nay so email thì chạy tốt, nhưng **rỗng vẫn là giá trị hợp lệ ở
cơ sở dữ liệu**, phải guard trong code.

---

## 2. Nhóm D — phân quyền dữ liệu cho trưởng bộ môn

### D0. Quyết định lớn nhất: không tạo trang mới

Anh có hỏi nên tạo trang mới giống hệt cho trưởng bộ môn, hay thêm code lọc vào
các trang đang có. **Chốt: không tạo trang mới, lọc ở backend, dùng lại đúng bốn
trang hiện tại.**

Lý do thứ nhất là bảo mật. Trang chỉ là chỗ hiển thị. Nếu chỉ làm trang mới biết
lọc thì API cũ vẫn trả về đủ 112 giảng viên, mở DevTools gọi thẳng
`/api/catalog/lecturers` là ra hết. Cho nên dù đi đường nào cũng **bắt buộc** phải
lọc ở backend. Mà đã lọc ở backend rồi thì trang cũ tự động hiện đúng dữ liệu,
trang mới thành thừa.

Lý do thứ hai là công sức về sau. Bốn màn hình đó kéo theo modal sửa, dialog
import, form thêm mới. Nhân đôi nghĩa là mọi lần sửa sau này phải sửa hai chỗ, và
kiểu gì cũng có lúc quên một chỗ.

### D1. Nối User với Lecturer, dựng `UserScope`

Làm một service trả về đúng một bản ghi:

```csharp
public sealed record UserScope(
    string RoleCode,
    int? LecturerId,
    int? DepartmentId,
    int? FacultyId);
```

Cách lấy, sau khi chốt G-d dùng khoá ngoại `Users.LecturerId`:

```
claims → UserId + active_profile_id
       → Users   (đã được nạp sẵn khi kiểm quyền)
       → LecturerId
       → Lecturers → DepartmentId, FacultyId
```

`Users` vốn đã được `ResolvePrincipalStateAsync` nạp trong mỗi lần kiểm quyền, nên
`LecturerId` có sẵn trong tay, không tốn thêm truy vấn nào.

`ADMIN` và `SURVEY_ADMIN` thì trả về scope rỗng, hiểu là không giới hạn. Tài khoản
nào có `LecturerId` bằng `NULL` cũng trả rỗng.

Điều quan trọng nhất của bước này: **chỉ đúng một file được phép dựng `UserScope`.**
Các câu query khác chỉ nhận `UserScope` chứ không tự đi tra. Gom một chỗ thì sau
này sửa cách nối hay thêm điều kiện gì cũng chỉ đụng một file.

*(Bản đầu của mục này mô tả cách so `Users.Email` với `Lecturers.Email` kèm hai
guard về trim và email rỗng. **Đã bỏ** sau khi chốt G-d — xem G6. Việc so email
giờ chỉ còn dùng một lần lúc backfill ở G3.)*

### D2. "Thuộc bộ môn" nghĩa là gì

Tài liệu viết `SELECT * FROM CourseSections WHERE DepartmentId = @departmentId`,
nhưng **`CourseSections` không hề có cột `DepartmentId`** — nó chỉ có `CourseId`
và `LecturerId`. Câu SQL đó là minh hoạ ý tưởng chứ không chạy được.

Nên phải tự chốt. **Đã chốt: lớp học phần đi theo học phần sở hữu.**

| Bảng | Điều kiện lọc |
|---|---|
| Giảng viên | `Lecturers.DepartmentId = @dept` |
| Học phần | `Courses.DepartmentId = @dept` |
| Lớp học phần | `CourseSections ⋈ Courses` với `Courses.DepartmentId = @dept` |
| Khảo sát học phần | các bài khảo sát gắn với những lớp trên |

Hệ quả cần biết: giảng viên bộ môn A vẫn dạy được học phần của bộ môn B. Theo
cách chốt này thì lớp đó thuộc phạm vi của trưởng bộ môn B, không thuộc A. Cách
này khớp với cách báo cáo hiện đang quy đơn vị theo học phần
([EfSurveyService.cs](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L1384):
`course?.DepartmentId ?? lecturer?.DepartmentId`), nên số liệu hai bên không đá
nhau.

### D3. Áp phạm vi vào bốn màn hình đọc

Đúng mục 8 của tài liệu: **không rải `if (role == ...)` vào từng endpoint.** Mỗi
hàm lấy danh sách nhận thêm `UserScope`, tự lọc bên trong.

| Màn hình | Hàm cần sửa |
|---|---|
| Giảng viên | `GetLecturersAsync` |
| Học phần | `GetCoursesAsync` |
| Lớp học phần | `GetCourseSectionsAsync` |
| Khảo sát học phần | hàm phục vụ `surveyApi.courseSectionSurveys` |

Ba hàm đầu nằm ở
[EfCatalogService.cs](src/Backend/Infrastructure/Catalog/EfCatalogService.cs), hàm
cuối ở [EfSurveyService.cs](src/Backend/Infrastructure/Surveys/EfSurveyService.cs).

### D4. Chặn cả ghi, không chỉ đọc

Tài liệu chỉ bàn `SELECT`, không có dòng nào nói về sửa xoá. Nhưng lọc danh sách
mà không chặn endpoint ghi thì vẫn gọi tay được — biết `LecturerId` của người
khác là sửa được, xoá được.

Nên mọi endpoint ghi của bốn nhóm trên phải kiểm bản ghi đích có nằm trong phạm
vi không, không thì trả 403. Theo D-c và D-d thì cụ thể là:

| Hành động | Trưởng bộ môn |
|---|---|
| Thêm giảng viên | Cho, nhưng ép `DepartmentId` về bộ môn của mình, không cho chọn bộ môn khác |
| Sửa giảng viên | Cho, nếu bản ghi đích thuộc bộ môn mình. Không cho đổi sang bộ môn khác |
| Xoá giảng viên | **Chặn hẳn**, kể cả giảng viên của bộ môn mình |
| Import lớp học phần | **Chặn hẳn** |
| Thêm / sửa lớp học phần | Cho, nếu học phần của lớp thuộc bộ môn mình |

Hai chỗ dễ quên: **ép bộ môn khi thêm** (không thì thêm được người vào bộ môn
khác) và **chặn đổi bộ môn khi sửa** (không thì sửa một phát là đẩy người của
mình sang bộ môn khác, hoặc kéo người bộ môn khác về mình).

### D5. Frontend chỉnh nhỏ

Dữ liệu đi qua props từ [App.tsx](src/Frontend/src/App.tsx), backend trả gì thì
trang hiện nấy, nên phần dữ liệu **không phải sửa gì**.

Sau khi chốt D-c và D-d thì phần frontend cụ thể là:

| Chỗ | Với trưởng bộ môn |
|---|---|
| Bộ lọc "Tất cả khoa / viện" ở trang Giảng viên | Ẩn — chỉ còn một bộ môn thì lọc chẳng để làm gì |
| Nút **Thêm giảng viên** | Giữ |
| Nút sửa (bút chì) từng dòng | Giữ |
| Nút **xoá** (thùng rác) từng dòng | **Ẩn** |
| Nút **Import Excel** ở trang Lớp học phần | **Ẩn** |
| Nút Thêm lớp học phần | Giữ |

Nhắc lại cho chắc: ẩn nút chỉ là cho gọn mắt. Việc chặn thật nằm ở D4, backend
phải tự từ chối chứ không tin vào chuyện nút đã bị ẩn.

### D6. Bốn trang báo cáo — lọc danh sách nhưng giữ nguyên mặt bằng

Đây là chỗ dễ làm sai nhất của cả đợt, nên tách riêng ra một mục.

Yêu cầu: trưởng bộ môn chỉ thấy các dòng thuộc bộ môn mình, **nhưng những con số
dùng để so sánh thì vẫn phải tính trên toàn trường**. Nếu không, z-score và độ
lệch chuẩn sẽ được tính lại trên vài chục lớp của một bộ môn, ra con số hoàn toàn
khác và mất hết ý nghĩa — lớp yếu của một bộ môn yếu sẽ hoá thành "đạt mặt bằng".

Nên **lọc ở bước cuối cùng lúc dựng danh sách trả về, tuyệt đối không lọc ở bước
nạp dữ liệu.** Cụ thể là `LoadAnalysedSectionsAsync` trong
[EfSurveyService.cs](src/Backend/Infrastructure/Surveys/EfSurveyService.cs#L1351)
phải giữ nguyên, vì chính nó nuôi cả phần tính mặt bằng lẫn phần hiển thị.

| Trang | Lọc cái gì | Giữ toàn trường |
|---|---|---|
| Chuẩn hoá điểm | Bảng chi tiết từng lớp | `SchoolAverageScore`, `SchoolStandardDeviation`, `SchoolSectionCount`, `ZSchool`, `ZFaculty`, `ZDifference`, bảng nhóm theo khoa |
| Tổng hợp theo bộ môn | Chỉ còn dòng bộ môn mình | Dòng tổng ở chân bảng |
| Chẩn đoán học phần | Học phần của bộ môn mình | — |
| Báo cáo giảng viên | Danh sách chọn giảng viên | Mặt bằng bộ môn và khoa dùng để so trong báo cáo |

Ba trường `ZSchool`, `ZFaculty`, `ZDifference` nằm ở `NormalizedSectionDto`
([SurveyContracts.cs](src/Backend/Application/Surveys/SurveyContracts.cs#L93)) —
chú thích trong code đã ghi rõ chúng so với mặt bằng toàn đợt và mặt bằng khoa,
cứ để nguyên như thế.

### D7. Không phải thêm `Permission` nào

Trưởng bộ môn đã có đủ sáu quyền cần thiết. Việc của nhóm D hoàn toàn nằm ở lớp
hai. Đây cũng đúng tinh thần tài liệu: `Permission` chỉ là quyền vào module, không
đẻ thêm mã quyền cho từng hành động.

---

## 3. Nhóm E — báo giảng viên thiếu email cho trưởng bộ môn

### E1. Hiện đang có gì

Khi import lớp học phần, dòng nào có tên giảng viên mà bỏ trống email thì lớp
được tạo với mã giảng viên để trống, tên đọc được ghi vào cột
`UnidentifiedLecturerName`. Hệ thống gom danh sách đó lại và cho tải về một file
Excel, mỗi bộ môn một sheet — xem
[courseSectionImportExcel.ts](src/Frontend/src/utils/courseSectionImportExcel.ts#L289),
tên file `giang-vien-thieu-email.xlsx`.

**Hạn chế:** file đó chỉ tồn tại đúng lúc import, trong trình duyệt của người
import. Đóng hộp thoại là mất. Trưởng bộ môn không bao giờ nhìn thấy nó, mà người
đi xin email lại chính là trưởng bộ môn. Đó là chỗ hiện chưa làm được.

### E2. Tin tốt: dữ liệu vẫn còn nguyên trong cơ sở dữ liệu

Không cần thêm bảng nào, cũng không cần import lại. Danh sách đó dựng lại được
bất cứ lúc nào từ `CourseSections` — lấy các dòng `LecturerId IS NULL` và
`UnidentifiedLecturerName` khác rỗng, nối sang `Courses` để biết bộ môn.

Đang có 132 lớp như vậy, trải trên 12 bộ môn:

| Bộ môn | Số lớp | Số giảng viên |
|---|---|---|
| Luật hàng hải | 36 | 6 |
| Kinh tế cơ bản | 31 | 6 |
| Kinh tế vận tải biển | 11 | 3 |
| Điện tự động tàu thủy | 7 | 3 |
| Máy và tự động công nghiệp | 6 | 3 |
| Quản lý kỹ thuật công nghiệp | 6 | 3 |
| Kinh tế đường thủy | 6 | 3 |
| Khai thác tàu biển | 6 | 4 |
| Máy tàu thủy | 5 | 4 |
| Hàng hải | 5 | 3 |
| TĐ hóa hệ thống điện | 5 | 2 |
| Điện tử viễn thông | 4 | 2 |

Bộ môn Luật hàng hải đang đứng đầu với 36 lớp thiếu, mà đó đúng là bộ môn của tài
khoản đang thử — tiện để kiểm ngay.

### E3. Thiết kế màn hình

**Đã chốt: không làm trang riêng, bổ sung thẳng vào trang Lớp học phần.**

Lý do là trang đó đã làm gần hết việc rồi. Mỗi dòng chưa xác định đã có cảnh báo
đỏ "Chưa xác định — thiếu email"; các dòng đó đã được sắp lên đầu bảng; và modal
sửa lớp đã có sẵn luồng gán giảng viên kèm dòng nhắc "Tên đọc từ tệp import: …
Chọn đúng giảng viên để gắn mã và xoá cảnh báo này". Làm trang riêng thì hiện lại
đúng những dòng đó, rồi muốn sửa vẫn phải quay về trang này.

Ba thứ cần thêm:

**Băng cảnh báo trên đầu trang.** Kiểu "36 lớp trong bộ môn chưa xác định giảng
viên, thuộc 6 người", kèm nút lọc nhanh chỉ hiện các lớp đó và nút tải Excel.

**Bảng gom theo giảng viên**, mở bằng một nút trên băng cảnh báo. Đây là chỗ trả
lời câu E-d, và lý do cần cả hai cách gom nằm ở con số: bộ môn Luật hàng hải có
36 lớp thiếu nhưng chỉ do **6 người** dạy. Cầm 36 dòng đi hỏi thì rối, cầm 6 cái
tên thì gọi điện xin email được ngay. Còn bảng chính vẫn phải theo lớp vì sửa là
sửa từng lớp.

**Nút tải Excel**, dùng lại hàm xuất file đang có ở
[courseSectionImportExcel.ts](src/Frontend/src/utils/courseSectionImportExcel.ts#L289),
chỉ khác là dữ liệu lấy từ endpoint mới thay vì từ kết quả import. Trưởng bộ môn
tải về thì chỉ có một sheet của bộ môn mình.

Phần backend là một endpoint trả danh sách giảng viên thiếu email **trong phạm vi
người đang đăng nhập**, dùng lại đúng `UserScope` của D1. Trưởng bộ môn gọi thì ra
bộ môn mình, admin gọi thì ra tất cả.

### E4. Nhóm E phụ thuộc nhóm D

Không làm E trước được, vì E cần biết người đang đăng nhập thuộc bộ môn nào, mà
cái đó chính là `UserScope` của D1. Nên thứ tự bắt buộc là D1 xong rồi mới tới E.

Ngược lại thì E là chỗ dùng thử `UserScope` gọn nhất — một endpoint, một màn hình,
không đụng vào luồng thêm sửa xoá nào. Làm E ngay sau D1 để kiểm chứng scope chạy
đúng, rồi mới đụng vào bốn màn hình lớn của D3.

### E5. Chuông báo — đã bỏ

Ban đầu chốt làm chuông báo trên thanh trên cùng. **Bỏ.** Việc báo cho trưởng bộ
môn chuyển hết sang bảng thông báo trên trang bảng điều khiển riêng, xem nhóm F.

Endpoint ở E3 vẫn giữ nguyên, chỉ là chỗ hiển thị đổi từ chuông sang một dòng
trong bảng thông báo.

---

## 4. Nhóm F — trang bảng điều khiển riêng cho trưởng bộ môn

Đây là **trang riêng đầu tiên làm cho một quyền khác ngoài admin**, nên làm cẩn
thận vì sau này role giảng viên, và có thể cả trưởng khoa, sẽ đi theo đúng khuôn
này.

### F0. Có mâu thuẫn với D0 không

Không. D0 nói không nhân đôi **bốn màn hình dữ liệu** — Giảng viên, Học phần, Lớp
học phần, Khảo sát học phần — vì chúng chỉ khác nhau ở tập dữ liệu, mà cái đó lọc
ở backend là xong.

Bảng điều khiển thì khác hẳn: nó không phải bảng dữ liệu, nó là màn hình mở đầu.
Nội dung cho admin và cho trưởng bộ môn khác nhau về bản chất chứ không phải khác
nhau ở số dòng — admin cần chỉ số toàn trường, trưởng bộ môn cần biết bộ môn mình
đang thiếu việc gì. Nên chỗ này **làm riêng là đúng**, không phải ngoại lệ.

### F1. Đặt ở đâu trong code

Hiện tab `overview` không đòi quyền gì
([modulePermissions.ts](src/Frontend/src/auth/modulePermissions.ts) ghi
`overview: null`), và [App.tsx](src/Frontend/src/App.tsx#L65) mặc định mở tab đó
khi không có hash. Nghĩa là **trưởng bộ môn hiện đã tự động đáp xuống đúng chỗ
này rồi**, chỉ có điều đang thấy bảng điều khiển của admin.

Nên không cần thêm tab mới, không cần logic chuyển hướng sau đăng nhập. Chỉ cần
[App.tsx](src/Frontend/src/App.tsx#L567) nhìn role mà chọn component:

```
currentTab === 'overview'
    ├── DEPARTMENT_MANAGER → DepartmentDashboardPage   (mới)
    └── còn lại            → DashboardOverview          (đang có)
```

Làm cách này thì bookmark cũ vẫn chạy, đường dẫn không đổi, và sau này thêm role
giảng viên chỉ là thêm một nhánh nữa.

Kèm theo: `App.tsx` cần biết role của profile đang hoạt động. Hiện nó mới chỉ đọc
`auth.access?.permissions`, chưa đọc role — nhưng `AuthProfileDto` đã trả sẵn
`role.Code` ([EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L247))
nên chỉ là chuyện lấy ra dùng.

### F2. Bố cục trang

Chia hai tầng, giống hình mẫu.

**Tầng trên — hàng thẻ điều hướng.** Giữ đúng kiểu thẻ của bảng điều khiển hiện
tại: biểu tượng, tiêu đề, một dòng nhãn nhỏ chữ hoa, một dòng mô tả, mũi tên bên
phải. Chỉ khác là chỉ hiện những trang trưởng bộ môn vào được, để không có thẻ nào
bấm vào lại bị đá ra.

Sáu quyền của trưởng bộ môn mở ra **chín trang**: `REPORTS_ACCESS` một mình đã cho
bốn trang (Tổng quan khảo sát, Thống kê & Báo cáo, Bảng dữ liệu khảo sát, Phân
tích chuyên sâu), cộng thêm Tiến độ thu phiếu, Giảng viên, Học phần, Lớp học phần,
Khảo sát học phần.

**Đã chốt F-a: lấy bốn thẻ theo việc phải làm**, không lấy bốn thẻ giống bản admin.

| Thẻ | Nhãn nhỏ | Vì sao có mặt |
|---|---|---|
| Lớp học phần | DỮ LIỆU KHẢO SÁT | Chỗ sửa lớp thiếu giảng viên, việc gấp nhất |
| Giảng viên | NHÂN SỰ BỘ MÔN | Thêm và sửa hồ sơ người của bộ môn |
| Tiến độ thu phiếu | VẬN HÀNH KHẢO SÁT | Biết lớp nào đang chậm mà đi giục |
| Phân tích chuyên sâu | CHUẨN HOÁ VÀ CHẨN ĐOÁN | Xem chẩn đoán học phần và báo cáo giảng viên |

Năm trang còn lại vẫn vào được từ menu bên trái, chỉ là không lên thẻ.

**Tầng giữa — dải chỉ số.** Xem F4.

**Tầng dưới — bảng thông báo.** Đây là phần khoảng trống bên dưới trong hình. Mỗi
dòng là một việc cần làm của bộ môn, có biểu tượng chuông bên trái, tiêu đề đậm,
một dòng phụ nói rõ số liệu, bấm vào thì nhảy sang trang tương ứng đã lọc sẵn.

### F3. Thông báo lấy từ đâu

**Đã chốt F-b: thông báo suy ra từ dữ liệu, không làm loại do người viết.**

Nghĩa là không có bảng `Notifications`, không có màn hình soạn thông báo, không có
trạng thái đã đọc. Mỗi lần mở trang thì hệ thống tính lại, còn việc thì còn dòng,
làm xong thì dòng tự biến mất.

Cái lợi: không bao giờ lệch với thực tế, không cần ai bấm nút gửi, không phải dọn
thông báo cũ. Cái mất: không gửi được thông báo kiểu "Nhà trường yêu cầu hoàn
thành khảo sát trước ngày 30/8" như hình mẫu thứ hai. Chấp nhận.

**Đợt này làm đúng một loại thông báo:**

| Loại | Ví dụ nội dung | Bấm vào đi đâu |
|---|---|---|
| Giảng viên chưa xác định | "36 lớp trong bộ môn chưa xác định giảng viên, thuộc 6 người" | Lớp học phần, lọc sẵn |

Chính là nhóm E, dùng lại nguyên endpoint ở E3. Không phải viết thêm gì cho phần
dữ liệu.

**Hai loại hoãn lại** (F-d chốt là tuỳ biến về sau): giục tiến độ thu phiếu, và
lớp chậm tiến độ. Ghi lại đây để sau quay lại còn nhớ. Khi làm thì dựng bảng thông
báo theo kiểu danh sách các mục cùng một khuôn, thêm loại mới chỉ là thêm một mục
vào danh sách chứ không phải sửa bố cục.

### F4. Dải chỉ số của bộ môn

**Đã chốt F-c: có, nhưng gọn.** Một dải bốn ô, không dựng lại cả mảng chỉ số của
bản admin.

| Ô | Số chính | Số phụ bên dưới |
|---|---|---|
| Tiến độ thu phiếu | % của bộ môn | % toàn trường, để so |
| Điểm trung bình | điểm bộ môn | điểm toàn trường, để so |
| Lớp cần lưu ý | số lớp dưới `ReportThresholds.LowScore` | ngưỡng đang dùng |
| Lớp chưa có giảng viên | số lớp | thuộc bao nhiêu người |

Mỗi ô có một số của bộ môn và một số toàn trường ngay dưới. Đây chính là chỗ **D6
áp dụng trực tiếp**: số bộ môn tính trên các lớp của bộ môn, số toàn trường tính
trên tất cả — tuyệt đối không tính lại mặt bằng chỉ trên phạm vi bộ môn.

Ô thứ tư dùng chung số với dòng thông báo ở F3, gọi một endpoint là ra cả hai.

### F5. Không thêm bảng, không thêm quyền

F-b đã chốt không làm thông báo do người viết, nên nhóm F **không cần bảng mới hay
quyền mới**. Tab `overview` vốn không đòi quyền, dữ liệu thì lấy từ các endpoint
đã có cộng thêm endpoint của E3.

---

## 5. Nhóm G — tự tạo tài khoản khi thêm giảng viên

### G0. Vì sao đổi cách

Câu D-e ban đầu chốt là "luật ngầm khi vận hành": phải có hồ sơ giảng viên trước
rồi mới tạo tài khoản. Nhưng luật ngầm thì con người quên, mà quên thì người đó
đăng nhập vào không thấy gì và không ai biết vì sao.

Có một chi tiết trong code làm đổi hẳn cách nhìn. **Đăng nhập chỉ có Google OAuth,
và hệ thống không tự đăng ký.** Ở
[EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L61):

```csharp
var user = userBySubject ?? userByEmail;
if (user is null)
    return new GoogleSignInResult(false, AuthErrorCodes.UserNotRegistered, ...);
```

Không có bản ghi `Users` khớp email thì bị từ chối thẳng, dù Google đã xác thực
xong. Và `GoogleSubject` chỉ được điền vào lần đăng nhập đầu tiên
(`user.GoogleSubject ??= identity.Subject`).

Nghĩa là **bản ghi `Users` chính là tấm vé cho phép đăng nhập, không cần mật
khẩu** — admin bắt buộc phải tạo trước bằng tay, chỉ cần email và tên.

Nên việc tự tạo tài khoản không phải thêm cơ chế mới. Nó **tự động hoá đúng cái
việc admin vốn đã phải làm thủ công**.

Con số hiện tại cho thấy khối lượng thủ công đó:

| | |
|---|---|
| Tổng `Users` | **2** |
| Giảng viên chưa có tài khoản | **111 / 112** |
| User không phải giảng viên | 1 — `abc@vmu.edu.vn`, admin hệ thống |

Làm tay 111 lần, sai một ký tự email là người đó vừa không đăng nhập được vừa mất
phạm vi dữ liệu.

Thêm một điểm an toàn: chỉ tạo `Users` chứ không tạo `UserProfiles`, nên 111 tài
khoản sinh ra **chưa ai đăng nhập được** cho tới khi admin chủ động cấp profile.
Bật tính năng này không cấp quyền cho ai và không làm lộ dữ liệu. Chi tiết ở G1-b.

### G1. Luồng mới

Thêm một giảng viên vào `Lecturers` thì đồng thời tạo **một bản ghi `Users`, chỉ
thế thôi**:

```
Lecturers (mới)
    │  FullName, Email
    ▼
Users (mới)
       Email        = email giảng viên
       DisplayName  = FullName giảng viên
       GoogleSubject = null, để lần đăng nhập đầu tự điền
```

**Không tạo `UserProfiles` kèm theo.** Việc cấp quyền là việc riêng của admin.

### G1-b. Hệ quả: chưa có profile thì chưa đăng nhập được

Cần nói rõ vì đây là thay đổi lớn về hành vi. Ở
[EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L83):

```csharp
var profiles = await GetProfilesAsync(user.Id);
if (profiles.Count == 0)
{
    AddAudit(user, null, "GOOGLE_LOGIN_NO_PROFILE");
    return new GoogleSignInResult(false, AuthErrorCodes.NoProfiles, ...);
}
```

Có `Users` nhưng không có `UserProfiles` nào thì **vẫn bị từ chối đăng nhập**, chỉ
khác mã lỗi: `NoProfiles` thay vì `UserNotRegistered`. Hệ thống có ghi lại một
dòng nhật ký `GOOGLE_LOGIN_NO_PROFILE`, nên tra ra được ai đã thử vào mà chưa được
cấp quyền.

Đây không phải nhược điểm, đây chính là điểm mạnh của cách làm này. Hai việc được
tách hẳn:

| Việc | Ai làm | Ý nghĩa |
|---|---|---|
| Tạo `Users` | Tự động, khi thêm giảng viên | Ghi nhận người này tồn tại trong hệ thống |
| Tạo `UserProfiles` | Admin làm tay | Quyết định cho người này vào và vào với vai trò gì |

Nghĩa là **thêm giảng viên không cấp quyền cho ai cả**. 111 bản ghi sinh ra từ
backfill sẽ không ai đăng nhập được cho tới khi admin chủ động cấp profile. Và vì
G-a chốt cho import tạo tài khoản, điều này cũng có nghĩa là import một file Excel
không cấp quyền cho ai — tài khoản rác do gõ sai email cũng chỉ nằm im.

Điều tương tự áp dụng cho trưởng bộ môn: D-c cho họ thêm giảng viên, nên họ cũng
sẽ gián tiếp sinh ra bản ghi `Users`. Không sao, vì cấp profile vẫn là việc riêng
của admin — trưởng bộ môn không tự cho ai vào hệ thống được.

Việc của admin sau đó rất nhẹ: muốn cho ai làm giảng viên thì thêm profile role
`LECTURER`, muốn cho ai làm trưởng bộ môn thì thêm profile role
`DEPARTMENT_MANAGER`. Một người có thể có cả hai, đúng mô hình mục 12 của tài
liệu. Không cần mật khẩu, không cần gửi thư mời — cấp profile xong là người ta bấm
đăng nhập bằng Google vào được.

### G2. Ba quy tắc bắt buộc

Hai cái đầu là ràng buộc kỹ thuật, không có lựa chọn nào khác.

**Giảng viên bắt buộc phải có email.** Ban đầu mục này viết "email rỗng thì bỏ qua,
không tạo tài khoản". Lúc bắt tay vào code mới phát hiện email rỗng **không tồn tại
được**: cột `Lecturers.Email` vừa `NOT NULL` vừa có UNIQUE index, nên NULL thì vướng
`NOT NULL`, còn chuỗi rỗng thì người thứ hai đụng UNIQUE.

Đây là dư chấn của lần revert `ffd43a8`: schema quay về `NOT NULL` nhưng code vẫn
giữ logic của thế giới email nullable, và form vẫn ghi "Để trống nếu chưa có". Thực
tế là **thêm giảng viên bỏ trống email đang crash**, chưa ai gặp vì chưa ai thử.

Đã ép luật vào code: thêm mã lỗi `CATALOG_LECTURER_EMAIL_REQUIRED`, chặn ở cả
`ValidateLecturerAsync` lẫn `ImportLecturersAsync`, và ô email trên form thành bắt
buộc. Guard "email rỗng thì bỏ qua" trong `EnsureUserForLecturerAsync` vẫn giữ,
nhưng giờ chỉ là phòng thủ cho dữ liệu cũ chứ không phải luồng thật.

**Email đã có tài khoản thì bỏ qua.** Ví dụ admin đồng thời là giảng viên. Phải
tra trước; có rồi thì không làm gì cả, tuyệt đối không tạo user thứ hai. Vì không
đụng tới `UserProfiles` nên cũng không có nguy cơ cấp nhầm quyền cho người đã có
tài khoản.

**Import lớp học phần cũng tạo tài khoản.** Câu G-a chốt: hễ đủ điều kiện tạo
giảng viên mới thì tạo `Users` đi kèm, không phân biệt thêm tay ở trang Giảng viên
hay sinh ra từ import. Một luật duy nhất, không có ngoại lệ nào phải nhớ.

Rủi ro còn lại chỉ là dữ liệu bẩn: gõ sai email một dòng trong file thì đẻ ra một
bản ghi `Users` thừa. Nhưng bản ghi đó không có profile nên không đăng nhập được,
không thấy gì — chỉ là một dòng nằm im trong bảng.

*(Quy tắc "sửa email giảng viên thì đồng bộ sang `Users`" ban đầu có ở đây. **Đã
bỏ** sau khi chốt G-d dùng khoá ngoại thay cho so email — xem G6.)*

### G3. Backfill — làm bằng một migration duy nhất

Câu G-c anh giao tôi quyết. **Chốt: gói cả ba việc vào một migration**, không dùng
script chạy tay, không làm nút bấm trong màn hình quản trị.

Ba việc migration đó làm, theo đúng thứ tự:

1. Thêm cột `Users.LecturerId` cùng UNIQUE index và khoá ngoại, theo G5.
2. Nối tài khoản đang có với giảng viên tương ứng bằng cách so email. Hiện chỉ có
   một cặp khớp — `hoangkenji3333@gmail.com` ↔ `LecturerId 35`. Tài khoản admin
   `abc@vmu.edu.vn` không khớp ai nên để `NULL`.
3. Tạo `Users` cho toàn bộ giảng viên có email mà chưa có tài khoản — hiện là 111
   người. Bỏ qua ai email rỗng, theo quy tắc ở G2. Chỉ ghi vào `Users`, không đụng
   `UserProfiles`.

Lý do chọn migration thay vì script: chạy đúng một lần, mọi máy đều lên cùng một
trạng thái, không ai quên chạy trên máy thật, và `Down` gỡ sạch được. Kho này đã
có tiền lệ đúng kiểu đó — migration `LinkProvisionalLecturersToCourseSections`
từng vừa đổi cấu trúc vừa nắn dữ liệu bằng SQL thô.

Vài lưu ý khi viết SQL, đọc thẳng từ cấu trúc bảng `Users`:

| Cột | Điền gì |
|---|---|
| `Id` | `gen_random_uuid()` — Postgres 15 có sẵn, không cần cài extension |
| `Email` | email giảng viên, đã trim |
| `DisplayName` | `FullName` của giảng viên |
| `GoogleSubject` | `NULL`, để lần đăng nhập đầu tự điền |
| `IsActive` | `TRUE` |
| `CreatedAt` / `UpdatedAt` | `now()` — cả hai đều `NOT NULL` |
| `LecturerId` | mã giảng viên tương ứng |

Chạy xong thì **chưa ai đăng nhập được thêm** — đó là đúng ý đồ. Admin cấp profile
tới đâu thì mở tới đó.

### G4. Bỏ được câu D-e

Không còn cần luật ngầm nào nữa. Thứ tự tạo do code ép, không phụ thuộc việc con
người có nhớ hay không. Trường hợp "đăng nhập mà không tra ra giảng viên" chỉ còn
xảy ra với tài khoản admin thuần — mà admin thì không bị lọc phạm vi nên không sao.

### G4-b. Xoá giảng viên thì khoá tài khoản

Câu G-b chốt là xoá mềm. Cần nói rõ một chi tiết: **bảng `Users` không có cột
`IsDeleted`**, nó chỉ có `IsActive`, và bản thân `User` cũng không phải
`ISoftDeletable` như `Lecturer`.

Nên "xoá mềm tài khoản" ở đây là đặt `IsActive = false`. Việc này chặn đăng nhập
thật, vì [EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L72)
kiểm `if (!user.IsActive)` rồi trả `AccountDisabled`.

Khoá ngoại `RESTRICT` không cản gì, vì xoá giảng viên là xoá mềm nên dòng
`Lecturers` vẫn nằm nguyên đó.

Chiều ngược lại — khôi phục giảng viên đã xoá — thì bật lại `IsActive = true`.

**Một cái bẫy của EF phát hiện lúc chạy test, phải nhớ.** Nếu bản ghi `User` còn nằm
trong change tracker vào lúc `Lecturer` bị đánh dấu xoá, EF **tự set
`Users.LecturerId = NULL`**, dù khoá ngoại khai báo `DeleteBehavior.Restrict`. Kết
quả là xoá giảng viên xong thì mất luôn liên kết, khôi phục lại chỉ còn một tài
khoản mồ côi.

Cách xử trong `DeleteLecturerAsync`: khoá tài khoản trước, lưu, **gỡ bản ghi khỏi
change tracker** (`db.Entry(account).State = EntityState.Detached`), rồi mới xoá
giảng viên. Có test `DeleteThenRestoreLecturer_ShouldLockThenUnlockAccount` canh
chỗ này.

### G5. Khoá ngoại `Users.LecturerId`

**Đã chốt: thêm cột `LecturerId` vào bảng `Users`, làm khoá ngoại trỏ sang
`Lecturers`.**

Lưu ý đây là **hướng ngược với mục 11 của tài liệu**. Tài liệu đề xuất
`Lecturers.UserId`, tức giảng viên trỏ sang tài khoản. Ở đây làm ngược lại: tài
khoản trỏ sang giảng viên.

| | Mục 11 đề xuất | Chốt làm |
|---|---|---|
| Cột mới nằm ở | `Lecturers.UserId` | `Users.LecturerId` |
| Ý nghĩa | Giảng viên này có tài khoản kia | Tài khoản này thuộc về giảng viên kia |
| Bản ghi không có cặp | Giảng viên chưa có tài khoản → NULL | Tài khoản admin thuần → NULL |

Hướng này hợp hơn với chính hệ thống, vì `ResolvePrincipalStateAsync`
([EfAuthService.cs](src/Backend/Infrastructure/Auth/EfAuthService.cs#L200)) **vốn
đã nạp sẵn bản ghi `Users`** trong mỗi lần kiểm quyền. Đặt cột ở đó thì
`LecturerId` có sẵn trong tay, không phải truy vấn thêm câu nào.

Thiết kế cột:

| | |
|---|---|
| Kiểu | `integer`, **nullable** — tài khoản admin thuần thì để trống |
| Ràng buộc | **UNIQUE khi có giá trị**, để hai tài khoản không cùng trỏ vào một giảng viên |
| Khi xoá | `RESTRICT`, đồng bộ với các khoá ngoại khác trong hệ thống |

### G6. Hệ quả lớn: bỏ được việc so email lúc chạy

Câu D-a chốt nối bằng so email. **Sau khi có `Users.LecturerId` thì việc so email
không còn cần nữa lúc chạy.** `UserScope` đọc thẳng:

```
claims → UserId → Users (đã nạp sẵn) → LecturerId → Lecturers → DepartmentId
```

Không so chuỗi, không lo hoa thường, không lo khoảng trắng, không lo email rỗng.

Kéo theo mấy thứ ở D1 và G2 thành không cần thiết nữa:

- Guard "bỏ qua email rỗng" khi dựng `UserScope` — vẫn giữ ở chỗ **tạo** tài khoản
  (G2) vì `Users.Email` là UNIQUE, nhưng không còn liên quan tới phạm vi dữ liệu.
- Quy tắc "sửa email giảng viên thì đồng bộ sang `Users`" — **bỏ**. Đổi email hai
  bên lệch nhau cũng không làm đứt phạm vi nữa, vì liên kết là khoá ngoại chứ
  không phải chuỗi.

Email quay về đúng vai trò của nó: thứ để đăng nhập và nhận dạng, không phải khoá
quan hệ. Đúng tinh thần mục 11, chỉ là làm bằng hướng ngược lại.

**Chỗ duy nhất còn dùng email** là lúc backfill ở G3, để nối tài khoản đang có với
giảng viên tương ứng. Một lần, xong thôi.

---

## 6. Các bước sẽ làm

1. Làm phần tự tạo tài khoản theo G1 và G2, gắn vào chỗ thêm giảng viên.
2. Chạy backfill 111 bản ghi `Users` đang thiếu theo G3. Kiểm bằng cách cấp tay
   một profile cho một giảng viên rồi đăng nhập thử — không cấp profile thì chưa
   vào được, đúng như G1-b.
3. Dựng service `UserScope` như D1, kèm bộ test cho ba trường hợp: admin, trưởng
   bộ môn có `Users.LecturerId`, và tài khoản có `LecturerId` bằng `NULL`.
4. Làm endpoint danh sách giảng viên thiếu email theo phạm vi, như E3. Đây là chỗ
   dùng thử `UserScope` đầu tiên và gọn nhất.
5. Làm phần hiển thị của E: băng cảnh báo, bảng gom theo giảng viên, nút tải
   Excel — tất cả nằm trong trang Lớp học phần.
6. Áp phạm vi vào bốn hàm đọc của D3.
7. Chặn ghi cho bốn nhóm endpoint như D4. Nhớ D-c cho thêm và sửa nhưng chặn xoá,
   D-d chặn import.
8. Chỉnh frontend theo D5: ẩn bộ lọc khoa, ẩn nút Import ở trang Lớp học phần,
   giữ nút Thêm.
9. Cho `App.tsx` đọc role của profile đang hoạt động, rồi tách nhánh tab
   `overview` theo F1.
10. Dựng `DepartmentDashboardPage` theo F2: bốn thẻ điều hướng, dải bốn ô chỉ số
    theo F4, rồi bảng thông báo với đúng một loại — giảng viên chưa xác định, dùng
    lại endpoint bước 4.
11. Rà bốn trang báo cáo theo D6 — lọc danh sách ở bước cuối, giữ nguyên mọi con
    số mặt bằng. Đây là bước cẩn thận nhất, để sau cùng.

Hai bước đầu là nhóm G, phải làm trước vì `UserScope` ở bước 3 chỉ kiểm chứng
được khi đã có tài khoản để đăng nhập thử.

Hết đợt này.

**Để sau, đã ghi lại chỗ nào rồi:** hai loại thông báo còn lại của F3 (giục tiến
độ, lớp chậm), và phạm vi cho role `LECTURER`. Role giảng viên thì lặp lại bước 6
và 7 với `LecturerId` thay cho `DepartmentId`; `UserScope` ở bước 3 đã trả sẵn
`LecturerId` nên không phải dựng lại.

---

## 7. Những câu cần anh chốt

### Nhóm D — phân quyền dữ liệu

| # | Câu hỏi | Đã chốt |
|---|---|---|
| D-a | Nối `Users` với `Lecturers` bằng gì | **Đã đổi ở G-d.** Ban đầu chốt so Email; sau chốt thêm khoá ngoại `Users.LecturerId` nên lúc chạy đọc thẳng khoá ngoại, không so email nữa. Email chỉ còn dùng một lần lúc backfill |
| D-b | "Lớp học phần thuộc bộ môn" hiểu thế nào | Theo **học phần sở hữu**, tức `Courses.DepartmentId` |
| D-c | Trưởng bộ môn được làm gì với giảng viên của bộ môn mình | Được **thêm** và **sửa**. Không được xoá |
| D-d | Trưởng bộ môn có được import lớp học phần không | **Không được import** |
| D-e | Đăng nhập role trưởng bộ môn mà không tìm thấy giảng viên khớp email thì sao | **Đã bị nhóm G thay thế.** Không còn luật ngầm nữa, thứ tự tạo do code ép. Code vẫn trả danh sách rỗng chứ không báo lỗi, nhưng trường hợp đó giờ chỉ còn xảy ra với admin thuần |
| D-f | `SURVEY_ADMIN` có bị giới hạn phạm vi không | **Tôi quyết: không.** Xử như `ADMIN`, thấy hết. Đây là role cấp quản trị, có 12/13 quyền (thiếu đúng `USER_ADMIN_ACCESS`), không gắn với bộ môn nào và chưa chắc có hồ sơ trong `Lecturers` để suy ra bộ môn |
| D-g | Có làm role `DEAN` cho trưởng khoa không | **Không cần** |
| D-h | Bốn trang báo cáo có lọc theo bộ môn không | **Có lọc**, nhưng mọi con số dùng làm mặt bằng so sánh — z-score, độ lệch chuẩn, điểm trung bình toàn trường — **vẫn tính trên toàn trường**. Chi tiết ở mục D6 |
| D-i | Có làm luôn phạm vi cho role `LECTURER` trong đợt này không | **Không.** Làm xong hẳn trưởng bộ môn rồi mới làm tiếp giảng viên |

### Nhóm E — báo giảng viên thiếu email

| # | Câu hỏi | Đã chốt |
|---|---|---|
| E-a | Màn hình đặt ở đâu | **Báo theo lớp học phần của bộ môn mình**, nằm ngay trong trang Lớp học phần đang có. Không làm trang riêng. Chi tiết ở mục E3 |
| E-b | Có thông báo chủ động không | Có, nhưng **không làm chuông báo**. Đưa thành một dòng trong bảng thông báo của trang bảng điều khiển riêng, xem nhóm F |
| E-c | Trưởng bộ môn có được tự bổ sung thông tin giảng viên thiếu không | **Được.** Khớp với D-c: thêm giảng viên mới rồi gán vào lớp |
| E-d | Gom theo giảng viên hay theo lớp | **Cả hai, mỗi cái một việc.** Bảng chính theo lớp để sửa tại chỗ; thêm một bảng gom theo giảng viên để cầm đi xin email. Lý do ở mục E3 |
| E-e | Chuông báo làm bản đếm sống hay bản đầy đủ có lịch sử | **Bỏ câu hỏi.** Không làm chuông nữa, chuyển sang bảng thông báo ở nhóm F |

### Nhóm F — trang bảng điều khiển riêng

| # | Câu hỏi | Đã chốt |
|---|---|---|
| F-a | Hàng thẻ điều hướng chọn những trang nào trong chín trang khả dĩ | **Bốn thẻ theo việc phải làm**: Lớp học phần, Giảng viên, Tiến độ thu phiếu, Phân tích chuyên sâu. Bảng đầy đủ ở F2 |
| F-b | Có làm thông báo do người viết không | **Không.** Chỉ thông báo suy ra từ dữ liệu, và đợt này **chỉ làm một loại**: đếm giảng viên chưa xác định. Không thêm bảng `Notifications` |
| F-c | Trang này có hiện chỉ số của bộ môn không | **Có, một dải bốn ô gọn.** Mỗi ô kèm số toàn trường để so. Chi tiết ở F4 |
| F-d | Ngoài loại thông báo đã làm thì còn nhắc gì nữa không | **Tuỳ biến về sau.** Hai loại đã nghĩ tới — giục tiến độ, lớp chậm — ghi lại ở F3 để sau quay lại |

### Nhóm G — tự tạo tài khoản khi thêm giảng viên

| # | Câu hỏi | Đã chốt |
|---|---|---|
| G-a | Import lớp học phần có được tự tạo `Users` không | **Có.** Hễ đủ điều kiện tạo giảng viên mới thì tạo `Users` đi kèm, không phân biệt thêm tay hay sinh từ import |
| G-b | Xoá giảng viên thì tài khoản xử sao | **Xoá mềm** — đặt `IsActive = false`. Lưu ý `Users` không có cột `IsDeleted`, chỉ có `IsActive`; chi tiết ở G4-b |
| G-c | Backfill làm bằng script hay nút bấm | **Tôi quyết: một migration duy nhất**, gói cả thêm cột, nối tài khoản cũ và tạo 111 tài khoản mới. Lý do ở G3 |
| G-d | Có làm khoá ngoại giữa `Users` và `Lecturers` không | **Có, nhưng ngược hướng mục 11**: thêm `Users.LecturerId` chứ không phải `Lecturers.UserId`. Chi tiết ở G5, hệ quả ở G6 |
| G-e | `ProfileName` và `ProfileCode` đặt là gì khi admin cấp profile | **Bỏ câu hỏi.** Không tự tạo profile nữa nên không cần quy ước đặt tên |

---

## 8. Tổng hợp cột dự kiến thêm

**Nhóm D và E không cần thêm cột nào.** Toàn bộ dữ liệu cần dùng đều đã có sẵn.

| Thứ cần | Lấy từ đâu | Đã có chưa |
|---|---|---|
| Role của phiên đăng nhập | claim `active_profile_id` → `UserProfiles.RoleId` | Có |
| Bộ môn của người đăng nhập | `Lecturers.DepartmentId` qua `Users.LecturerId` | Cột `LecturerId` là cột duy nhất phải thêm |
| Bộ môn của học phần | `Courses.DepartmentId` | Có |
| Bộ môn của lớp | qua `CourseSections.CourseId` → `Courses` | Có |
| Giảng viên thiếu email | `CourseSections.UnidentifiedLecturerName` | Có |

Nhóm F cũng vậy — với điều kiện F-b chốt là không làm thông báo do người viết.

**Nhóm G thì có, đúng một cột.**

### `Users`

| Cột | Kiểu | Null | Thuộc |
|---|---|---|---|
| `LecturerId` | integer | YES | G5 |

Kèm UNIQUE index (chỉ ràng khi có giá trị) và khoá ngoại sang `Lecturers` với
`ON DELETE RESTRICT`. Null nghĩa là tài khoản không gắn với giảng viên nào — hiện
chỉ có admin `abc@vmu.edu.vn` rơi vào diện này.

### Dữ liệu migration đó ghi thêm

Ngoài cột trên, migration ở G3 còn nắn dữ liệu: nối 1 tài khoản đang có với giảng
viên tương ứng, và tạo mới **111 dòng `Users`**. Không đụng `UserProfiles` — cấp
quyền vẫn là việc admin làm tay.

---

## 9. Yêu cầu tiếp theo

_(chờ anh mô tả thêm)_

---

## 10. Nhật ký

| Ngày | Nội dung |
|---|---|
| 2026-08-21 | Revert `ffd43a8`, bỏ luật giảng viên không email và trùng tên. Đã chạy `Down` migration: xoá 44 giảng viên trống email, 132 lớp trả về `UnidentifiedLecturerName`, cột `Email` về `NOT NULL DEFAULT ''`. Backup trước khi chạy để ở `database/backup-truoc-revert-ffd43a8.sql`, không commit. |
| 2026-08-21 | Khôi phục `dashboard.css` bị gỡ nhầm cùng lúc revert. Commit `9f3b0a7`. |
| 2026-08-21 | Sửa đếm giảng viên trong báo cáo: lớp chưa xác định giờ vẫn được tính, 19 học phần từ 0 lên khác 0. Gộp dropdown giảng viên 117 dòng về đúng 112 người. Đổi ô chọn giảng viên thành combobox gõ được. Sắp lớp chưa xác định lên đầu trang Lớp học phần. Commit `924f68f`. |
| 2026-08-21 | Đọc [docs/plans/upgrade-phan-quyen-theo-scope.md](docs/plans/upgrade-phan-quyen-theo-scope.md), đối chiếu với code thật. Phát hiện bốn chỗ tài liệu mô tả lệch: dùng cookie chứ không phải JWT, role tên `DEPARTMENT_MANAGER` chứ không phải `HEAD_OF_DEPARTMENT`, chưa có `DEAN`, và `CourseSections` không có cột `DepartmentId` nên câu SQL trong tài liệu không chạy được. |
| 2026-08-21 | Nhận yêu cầu phân quyền dữ liệu cho trưởng bộ môn và giảng viên. Chốt D0 không tạo trang mới mà lọc ở backend. Chốt D-b lớp học phần đi theo học phần sở hữu. Lập file kế hoạch này. |
| 2026-08-21 | Chốt D-a: nối `Users` với `Lecturers` bằng cách so email. Mục 11 của tài liệu (thêm `Lecturers.UserId FK UNIQUE`) bỏ qua, không làm, không ghi thành nợ. Chốt D-i: đợt này chỉ làm trưởng bộ môn, role `LECTURER` để sau. Nhóm D và E không thêm bảng, không thêm cột, không có migration. |
| 2026-08-21 | Chốt nốt nhóm D. Trưởng bộ môn được thêm và sửa giảng viên nhưng không được xoá, không được import. Không tìm thấy giảng viên khớp email thì trả rỗng, chuyện gán hồ sơ trước rồi tạo tài khoản sau là luật ngầm khi vận hành. Không làm role `DEAN`. Hai câu D-e và D-f tôi tự quyết. Thêm mục D6 cho bốn trang báo cáo: lọc danh sách ở bước cuối nhưng giữ nguyên z-score, độ lệch chuẩn và mọi mặt bằng toàn trường. |
| 2026-08-21 | Chốt nhóm E. Không làm trang riêng, bổ sung vào trang Lớp học phần: băng cảnh báo, bảng gom theo giảng viên, nút tải Excel. Dùng cả hai cách gom vì 36 lớp thiếu của Luật hàng hải chỉ do 6 người dạy. Có làm chuông báo nhưng hệ thống chưa có sẵn gì, đề nghị bản đếm sống không cần bảng thông báo — treo lại thành câu E-e. |
| 2026-08-21 | **Bỏ chuông báo.** Thay bằng nhóm F: một trang bảng điều khiển riêng cho trưởng bộ môn, hàng thẻ điều hướng ở trên và bảng thông báo ở dưới. Đây là trang riêng đầu tiên cho một quyền khác ngoài admin nên làm theo khuôn để sau này role giảng viên đi theo. Không cần tab mới vì `overview` vốn không đòi quyền và đã là tab mặc định — chỉ tách nhánh theo role trong `App.tsx`. Đề nghị thông báo suy ra từ dữ liệu, không cần bảng `Notifications`. Treo bốn câu F-a đến F-d. |
| 2026-08-21 | Lập nhóm G: thêm giảng viên thì tự tạo luôn `Users` và một `UserProfiles` role `LECTURER`. Phát hiện đăng nhập chỉ có Google OAuth và **không tự đăng ký** — không có bản ghi `Users` là bị từ chối thẳng, nên bản ghi đó chính là tấm vé đăng nhập mà admin vốn phải tạo tay. Hiện chỉ có 2 user, 111/112 giảng viên chưa có tài khoản. Nhóm G xoá được câu D-e, và làm cho `Lecturers.UserId` (mục 11) gần như miễn phí nên mở lại thành câu G-d. Treo năm câu G-a đến G-e. |
| 2026-08-22 | Bỏ phần tự tạo `UserProfiles` — nhóm G **chỉ tạo `Users`**. Hệ quả ghi ở mục G1-b: có `Users` mà không có profile thì đăng nhập vẫn bị từ chối, mã lỗi `NoProfiles`, kèm một dòng nhật ký `GOOGLE_LOGIN_NO_PROFILE`. Đây là ý đồ chứ không phải thiếu sót — tạo giảng viên là ghi nhận người đó tồn tại, còn cấp quyền vào hệ thống vẫn là việc riêng admin làm tay. Câu G-a nhẹ hẳn đi vì tài khoản rác không đăng nhập được. Bỏ câu G-e. |
| 2026-08-22 | Chốt nốt nhóm G. G-a: import cũng tạo `Users`, một luật duy nhất không ngoại lệ. G-b: xoá giảng viên thì đặt `IsActive = false` — lưu ý `Users` không có `IsDeleted`, chỉ có `IsActive`. G-c tôi quyết: gói cả thêm cột, nối tài khoản cũ và tạo 111 tài khoản mới vào **một migration duy nhất**. G-d: thêm khoá ngoại **`Users.LecturerId`**, tức ngược hướng mục 11 của tài liệu (`Lecturers.UserId`) — hợp hơn vì `ResolvePrincipalStateAsync` vốn đã nạp sẵn bản ghi `Users` mỗi lần kiểm quyền. |
| 2026-08-22 | Hệ quả của G-d, ghi ở mục G6: **bỏ hẳn việc so email lúc chạy**. `UserScope` đọc thẳng khoá ngoại, không lo hoa thường, khoảng trắng hay email rỗng. Bỏ luôn quy tắc đồng bộ email giữa hai bảng ở G2. Email quay về đúng vai trò đăng nhập và nhận dạng — đúng tinh thần mục 11, chỉ là làm bằng hướng ngược lại. Sửa lại mục D1 và câu D-a cho khớp. |
| 2026-08-22 | Soát lại toàn file trước khi triển. Sửa sáu chỗ: bỏ đoạn thừa ở G3 nói ngược lại quyết định dùng migration, xếp lại G4 trước G4-b và E4 trước E5, sửa "bảy trang" thành "chín trang" ở F2, làm rõ chỗ trưởng bộ môn thêm giảng viên cũng sinh `Users`, và bỏ chữ "khớp email" còn sót trong bước 3. |
| 2026-08-22 | Chốt nốt nhóm F. F-a: bốn thẻ theo việc phải làm — Lớp học phần, Giảng viên, Tiến độ thu phiếu, Phân tích chuyên sâu. F-b: không làm thông báo do người viết, và đợt này **chỉ làm một loại thông báo** là đếm giảng viên chưa xác định. F-c: có dải bốn ô chỉ số, mỗi ô kèm số toàn trường để so. F-d: hai loại thông báo còn lại tuỳ biến về sau. **Toàn bộ câu hỏi đã chốt, bắt đầu code.** |
| 2026-08-22 | Xong bước 1 và 2 của nhóm G. Migration `20260821172439_LinkUsersToLecturers`: thêm `Users.LecturerId`, nối 1 tài khoản cũ, tạo 111 tài khoản mới. Đã thử cả vòng `Down` rồi `Up` lại, số liệu khớp. Viết `EnsureUserForLecturerAsync` và `SetLecturerAccountActiveAsync`, nối vào 6 chỗ: ba chỗ tạo giảng viên (thêm tay, import giảng viên, import lớp học phần), sửa, xoá, khôi phục. Thêm 5 test tích hợp chạy trên DB thật trong transaction rồi rollback. |
| 2026-08-22 | Hai lỗi phát hiện lúc code, đều đã sửa và ghi lại ở G2 và G4-b: (1) thêm giảng viên bỏ trống email đang crash vì schema sau revert không cho email rỗng — đã ép email thành bắt buộc; (2) EF tự set `Users.LecturerId = NULL` khi xoá giảng viên nếu bản ghi `User` còn trong change tracker, dù khoá ngoại là `Restrict` — đã sửa bằng cách detach trước khi xoá. |
