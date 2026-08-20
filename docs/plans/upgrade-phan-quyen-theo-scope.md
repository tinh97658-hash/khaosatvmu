# Kế hoạch nâng cấp phân quyền theo scope

## 1. Bối cảnh

Bản nâng cấp phân quyền theo module đã đưa hệ thống về mô hình:

```text
ActiveProfile -> Role -> RolePermission -> Permission -> Module access
```

Tầng tiếp theo cần làm là **scope**: sau khi user được phép vào một module, hệ thống phải biết user được xem và thao tác dữ liệu trong phạm vi nào.

Hiện `UserProfile` đã có:

- `OrganizationUnitCode`
- `OrganizationUnitName`

Hai trường này đang là text tự do, phù hợp để ghi chú "đơn vị/phạm vi" nhưng chưa đủ chặt để lọc dữ liệu an toàn. Mục tiêu của phase này là biến `OrganizationUnit` trong hồ sơ làm việc thành scope có kiểu rõ ràng, có thể validate, có thể đưa vào authorization context và dùng thống nhất ở dashboard, tiến độ thu phiếu, thống kê báo cáo, danh mục đào tạo và khảo sát học phần.

## 2. Nguyên tắc thiết kế

- `Permission` vẫn chỉ trả lời câu hỏi: user có được vào module không.
- `Scope` trả lời câu hỏi: trong module đó, user được thấy dữ liệu nào.
- `Action` trả lời câu hỏi: trên dữ liệu được thấy, user được xem/thêm/sửa/xóa hay chỉ xem.
- Không nhồi scope hoặc CRUD vào permission code. Không tạo permission kiểu `REPORTS_FACULTY`, `COURSE_SECTION_OWN`, `CATALOG_EDIT_DEPARTMENT`.
- Backend là nơi enforce scope. Frontend chỉ dùng scope để hiển thị bộ lọc/mặc định UI, không được là lớp bảo vệ chính.
- Scope luôn đi theo `ActiveProfileId`, không cộng dồn scope của nhiều profile.
- Scope phải cấu hình được bằng dữ liệu khi tạo/sửa hồ sơ làm việc, hạn chế hard-code theo `roleCode`.
- Business code không được rải điều kiện `roleCode` để quyết định nghiệp vụ. Nếu tạm thời action policy được suy ra từ role, việc suy ra đó phải nằm trong một authorization abstraction tập trung.
- Scope phải dựa vào quan hệ dữ liệu thật: `Faculties`, `Departments`, `Majors`, `Lecturers`, `Courses`, `CourseSections`, `CourseSectionSurveys`.
- `SYSTEM` là một loại scope dữ liệu, không phải quyền bypass authorization.

Nguyên tắc chốt:

```text
RolePermission quyết định vào module.
UserProfileScope quyết định phạm vi dữ liệu.
ActionPolicy quyết định được làm gì trong phạm vi đó.
```

Quy ước tên trong kế hoạch:

- Khi nói đến bảng database, dùng đúng tên bảng PascalCase số nhiều: `Faculties`, `Departments`, `Majors`, `Lecturers`, `Courses`, `CourseSections`, `CourseSectionSurveys`.
- Khi nói đến entity/model C# hoặc khái niệm nghiệp vụ, có thể dùng tên số ít như `Faculty`, `Department`, `CourseSection`.

## 3. Ranh giới phase này

Phase này chỉ xây **base phân quyền theo scope** để các module nghiệp vụ dùng chung. Không cố triển khai thay logic thống kê báo cáo, vì báo cáo là phần có thể thay đổi theo người phụ trách module và theo yêu cầu sau này.

Mục tiêu cần đạt:

- Chuẩn hóa scope trong hồ sơ làm việc.
- Trả scope trong authorization context.
- Có helper/service backend để áp scope vào query.
- Có guard backend để chặn truy cập/mutation ngoài scope.
- Cập nhật các API hiện có ở mức tối thiểu để không lộ dữ liệu toàn trường cho profile scope hẹp.
- Tạo hợp đồng rõ ràng để bất kỳ báo cáo mới nào sau này cũng phải gọi lớp scope chung.

Không cố chốt trước:

- Báo cáo sẽ có bao nhiêu loại.
- Báo cáo sẽ nhóm theo khoa, ngành, bộ môn, lớp học phần, giảng viên, câu hỏi hay tiêu chí.
- Cấu trúc biểu đồ, dashboard hay chỉ số vận hành chi tiết.
- Logic nghiệp vụ riêng của module thống kê báo cáo do người khác triển khai.

Quy tắc cho team report sau này:

```text
Mọi query báo cáo phải lấy AccessContext của active profile
  -> áp scope bằng helper chung
  -> sau đó mới aggregate/group/sort/paginate theo nghiệp vụ báo cáo.
```

Nói cách khác, phase này làm "đường ray an toàn" cho report, không làm trước toàn bộ report.

## 4. Actor và phạm vi nghiệp vụ

Danh sách actor sau cuộc họp:

| Actor/Profile | Số user dự kiến | Scope mặc định | Module chính |
| --- | ---: | --- | --- |
| Ban giám hiệu | 1 | Toàn trường | Thống kê báo cáo |
| Phó hiệu trưởng | 1 | Toàn trường hoặc mảng được phân công | Thống kê báo cáo |
| Thanh tra | 1 | Toàn trường hoặc phạm vi thanh tra được phân công | Bảng điều khiển, tiến độ thu phiếu, thống kê báo cáo |
| Trưởng bộ môn | Nhiều | Bộ môn | Bảng điều khiển, tiến độ thu phiếu, thống kê báo cáo, danh mục đào tạo, khảo sát học phần |
| Giảng viên | Rất nhiều | Các lớp học phần phụ trách | Bảng điều khiển, tiến độ thu phiếu, thống kê báo cáo, danh mục đào tạo, khảo sát học phần |

Ghi chú quan trọng:

- Ban giám hiệu, Phó hiệu trưởng, Thanh tra hiện có thể là 1 user nhưng vẫn không nên thiết kế theo giả định "chỉ 1 user". Dữ liệu nên chịu được việc sau này có nhiều người cùng chức năng.
- Giảng viên là actor có số lượng lớn nhất và scope hẹp nhất. Thiết kế phải tối ưu cho truy vấn theo `LecturerId` và `CourseSectionId`.
- Trưởng bộ môn không phải "giảng viên cộng thêm quyền". Đây là profile có scope lớn hơn, thường theo `DepartmentId`, và action rộng hơn trong danh mục đào tạo.

## 5. Mô hình scope đề xuất

Không tiếp tục dùng riêng `OrganizationUnitCode/Name` dạng text tự do để enforce quyền. Thay vào đó thêm scope chuẩn hóa vào `UserProfile`.

### 5.1. Cột mới trong `UserProfiles`

Đề xuất thêm các cột:

```text
ScopeType varchar(50) null
ScopeId int null
ScopeCode varchar(100) null
ScopeName varchar(200) null
```

Nguồn dữ liệu authorization chỉ là:

```text
ScopeType
ScopeId
```

`ScopeCode`, `ScopeName`, `OrganizationUnitCode` và `OrganizationUnitName` chỉ là dữ liệu hiển thị/denormalized cache để tương thích UI/API/audit trong giai đoạn chuyển tiếp. Không dùng các trường name/code này để authorize hoặc query nghiệp vụ.

Nếu entity gốc đổi tên, cache hiển thị có thể được cập nhật sau; quyền truy cập vẫn không đổi vì dựa trên `ScopeType + ScopeId`.

### 5.2. Giá trị `ScopeType`

| ScopeType | Ý nghĩa | ScopeId trỏ tới | Ví dụ |
| --- | --- | --- | --- |
| `SYSTEM` | Toàn hệ thống | null | Ban giám hiệu, thanh tra toàn trường |
| `FACULTY` | Một khoa/viện | `"Faculties"."FacultyId"` | Phó hiệu trưởng phụ trách khoa hoặc trưởng khoa nếu bổ sung |
| `DEPARTMENT` | Một bộ môn | `"Departments"."DepartmentId"` | Trưởng bộ môn |
| `MAJOR` | Một ngành đào tạo | `"Majors"."MajorId"` | Role tương lai cho khảo sát CTĐT |
| `LECTURER` | Một giảng viên | `"Lecturers"."LecturerId"` | Giảng viên cơ hữu |
| `COURSE_SECTION` | Một lớp học phần cụ thể | `"CourseSections"."CourseSectionId"` | Trường hợp phân công rất hẹp |

Phase đầu nên triển khai chắc các scope:

- `SYSTEM`
- `DEPARTMENT`
- `LECTURER`

`FACULTY`, `MAJOR`, `COURSE_SECTION` có thể thêm cùng schema nhưng chỉ bật UI khi nghiệp vụ cần.

### 5.3. Vì sao không tạo FK trực tiếp một cột

`ScopeId` có thể trỏ tới nhiều bảng khác nhau tùy `ScopeType`, nên không đặt một FK trực tiếp từ `UserProfiles.ScopeId`. Thay vào đó validate ở service khi tạo/sửa profile:

```text
ScopeType = FACULTY     -> ScopeId phải tồn tại trong "Faculties"
ScopeType = DEPARTMENT  -> ScopeId phải tồn tại trong "Departments"
ScopeType = MAJOR       -> ScopeId phải tồn tại trong "Majors"
ScopeType = LECTURER    -> ScopeId phải tồn tại trong "Lecturers"
ScopeType = COURSE_SECTION -> ScopeId phải tồn tại trong "CourseSections"
ScopeType = SYSTEM      -> ScopeId phải null
```

Để query nhanh, thêm index:

```text
IX_UserProfiles_ScopeType_ScopeId
IX_UserProfiles_UserId_RoleId_ScopeType_ScopeId
```

Quyết định trước khi code:

- Chấp nhận đây là polymorphic reference bằng `ScopeType + ScopeId`, không có FK cứng ở DB.
- Đổi lại, mọi create/update profile phải validate scope bằng service.
- Nếu sau này cần DB enforce FK thật cho từng loại scope, hướng thay thế là tách thành các cột nullable như `FacultyScopeId`, `DepartmentScopeId`, `LecturerScopeId`. Phase hiện tại chưa chọn hướng đó để tránh làm schema phình sớm.

## 6. Quan hệ scope với dữ liệu khảo sát

Scope phải quy về được tập `CourseSectionId` được phép xem/thao tác.

```text
SYSTEM
  -> tất cả "CourseSections"

FACULTY
  -> "CourseSections"
  -> theo source of truth được chốt cho dữ liệu học phần

DEPARTMENT
  -> "CourseSections"
  -> theo source of truth được chốt cho dữ liệu học phần

MAJOR
  -> chưa áp mạnh cho khảo sát học phần nếu "CourseSections" chưa gắn được "Majors"

LECTURER
  -> "CourseSections"."LecturerId" = ScopeId

COURSE_SECTION
  -> "CourseSections"."CourseSectionId" = ScopeId
```

Điểm cần chốt khi triển khai:

- Với lớp học phần, nguồn scope chính nên là `"CourseSections"."LecturerId"` cho giảng viên.
- Với trưởng bộ môn, phải chốt một đường mapping chính thức từ `"CourseSections"` về `"Departments"`. Gợi ý ban đầu là `"CourseSections" -> "Courses" -> "Courses"."DepartmentId"`.
- Không để `IAccessScopeService` tự đoán theo nhiều đường như `"Courses"."DepartmentId"` hoặc `"Lecturers"."DepartmentId"` tùy dữ liệu có/không. Nếu cần fallback vì dữ liệu cũ thiếu, fallback phải là bước chuẩn hóa/backfill dữ liệu hoặc rule tạm được ghi rõ, test rõ, và có kế hoạch bỏ.
- Không dùng tên giảng viên chưa định danh (`UnidentifiedLecturerName`) để cấp quyền cho giảng viên đăng nhập. Chỉ dữ liệu có `LecturerId` mới thuộc scope giảng viên.
- Nếu cần ngành đào tạo cho khảo sát CTĐT, phải bổ sung quan hệ dữ liệu riêng thay vì ép qua `CourseSections`.

Nguyên tắc mapping:

```text
Scope xác định actor.
Mapping dữ liệu xác định record nào thuộc actor đó.
Mỗi entity nghiệp vụ phải có một đường mapping chính thức, ổn định.
```

Ví dụ cần chốt trong phase đầu:

| Bảng cần lọc | ScopeType | Mapping chính thức |
| --- | --- | --- |
| `CourseSections` | `LECTURER` | `"CourseSections"."LecturerId" = ScopeId` |
| `CourseSections` | `DEPARTMENT` | `"CourseSections"."CourseId" -> "Courses"."DepartmentId" = ScopeId` |
| `CourseSectionSurveys` | `LECTURER` | `"CourseSectionSurveys"."CourseSectionId" -> "CourseSections"."LecturerId" = ScopeId` |
| `CourseSectionSurveys` | `DEPARTMENT` | `"CourseSectionSurveys"."CourseSectionId" -> "CourseSections"."CourseId" -> "Courses"."DepartmentId" = ScopeId` |

Nếu `"Courses"."DepartmentId"` đang thiếu nhiều, cần xử lý chất lượng dữ liệu trước khi bật scope `DEPARTMENT` cho trưởng bộ môn.

## 7. Thiết kế API authorization context

Mở rộng `/api/auth/access` để trả thêm scope của active profile:

```json
{
  "authenticated": true,
  "roleCode": "LECTURER",
  "organizationUnitCode": "LECTURER:123",
  "organizationUnitName": "Nguyễn Văn A",
  "scope": {
    "type": "LECTURER",
    "id": 123,
    "code": "LECTURER:123",
    "name": "Nguyễn Văn A"
  },
  "permissions": ["PROGRESS_ACCESS", "REPORTS_ACCESS"]
}
```

Quy tắc:

- `scope` lấy từ active profile trong DB, không lấy từ request frontend.
- `organizationUnitCode/Name` có thể tiếp tục trả để tương thích, nhưng frontend mới nên đọc `scope`.
- Với `SYSTEM`, `scope.id = null`.
- Nếu profile thiếu scope nhưng role cần scope, backend phải xem là cấu hình sai và trả lỗi quản trị rõ ràng hoặc chặn truy cập dữ liệu scoped.
- `scope.code` và `scope.name` chỉ phục vụ hiển thị; backend không dùng chúng để lọc dữ liệu.
- `SYSTEM` chỉ có nghĩa tập dữ liệu được phép truy cập là toàn hệ thống. Đọc/sửa/xóa vẫn phải đi qua permission module và action policy.

## 8. Action policy ban đầu

Phase scope cần tách `Module access`, `Scope` và `Action`. Vì hệ thống chưa có bảng action riêng, có thể suy ra action policy mặc định từ role ở một nơi tập trung, sau đó mới nâng cấp thành DB nếu cần.

| Actor/Profile | Dashboard | Tiến độ | Báo cáo | Danh mục đào tạo | Khảo sát học phần |
| --- | --- | --- | --- | --- | --- |
| Ban giám hiệu | Xem | Có thể không cần | Xem toàn trường | Không hoặc xem | Không |
| Phó hiệu trưởng | Xem | Có thể không cần | Xem theo scope | Không hoặc xem | Không |
| Thanh tra | Xem | Xem theo scope | Xem theo scope | Xem | Không hoặc xem |
| Trưởng bộ môn | Xem | Xem theo bộ môn | Xem theo bộ môn | Xem, thêm, sửa, xóa theo chính sách | Tương tác theo bộ môn |
| Giảng viên | Xem | Xem lớp phụ trách | Xem lớp phụ trách | Xem danh mục, chỉ tương tác lớp phụ trách | Tương tác lớp phụ trách |

Trong phase này không cần tạo permission CRUD quá mịn. Nếu cần biểu diễn bằng code, gom thành policy nghiệp vụ:

```text
CanReadCatalog
CanManageCatalogWithinScope
CanReadCourseSurveyWithinScope
CanManageCourseSurveyWithinScope
CanReadReportsWithinScope
```

Các policy này luôn nhận `AccessContext`, không chỉ nhận role. Business service/page không tự viết:

```csharp
if (context.RoleCode == "DEPARTMENT_MANAGER")
```

Thay vào đó chỉ hỏi abstraction:

```text
AccessContext
  -> Module permissions
  -> Scope
  -> ActionPolicies

Business code
  -> access.Can(CanManageCatalogWithinScope)
  -> scopeService.ApplyToCourseSections(query, access)
```

Nếu action policy tạm thời được suy ra từ role, mapping đó nằm trong một file/service duy nhất, ví dụ `AccessPolicyResolver`, và phải có test.

## 9. Ma trận module, scope và hành vi

### 9.1. Bảng điều khiển

- User có profile hợp lệ đều vào dashboard.
- Các chỉ số phải lọc theo scope:
  - `SYSTEM`: toàn bộ.
  - `DEPARTMENT`: dữ liệu lớp học phần/học phần thuộc bộ môn.
  - `LECTURER`: dữ liệu lớp học phần do giảng viên phụ trách.
- Không hiển thị tổng toàn trường cho giảng viên nếu query chưa áp scope.
- Nếu dashboard hiện tại còn thay đổi, chỉ cần đảm bảo các nguồn dữ liệu hiện có đi qua scope helper; không thiết kế trước toàn bộ chỉ số tương lai.

### 9.2. Tiến độ thu phiếu

- Thanh tra, trưởng bộ môn, giảng viên đều có thể xem nếu có `PROGRESS_ACCESS`.
- Query phải áp scope trước khi tính:
  - số lớp học phần,
  - số phiếu đã thu,
  - tỷ lệ hoàn thành,
  - danh sách lớp chậm tiến độ.
- Giảng viên chỉ thấy các `CourseSectionSurveys` của `"CourseSections"."LecturerId" = ScopeId`.
- Trưởng bộ môn thấy các `CourseSectionSurveys` thuộc bộ môn.
- Nếu sau này thay đổi cách tính tiến độ, logic mới vẫn phải bắt đầu từ tập dữ liệu đã được scoped.

### 9.3. Thống kê báo cáo

- Ban giám hiệu: toàn trường.
- Phó hiệu trưởng: toàn trường hoặc scope phân công.
- Thanh tra: theo scope được cấu hình.
- Trưởng bộ môn: bộ môn.
- Giảng viên: lớp học phần mình phụ trách.
- Bộ lọc frontend không được cho chọn phạm vi ngoài scope. Nếu user sửa URL/query string để chọn ngoài scope, backend vẫn phải trả 403 hoặc kết quả rỗng có kiểm soát.
- Phase này không định nghĩa trước các loại báo cáo cụ thể. Việc cần làm là cung cấp `AccessContext` và scope helper để báo cáo hiện có hoặc báo cáo mới đều lọc dữ liệu trước khi aggregate.
- Không viết logic báo cáo cứng theo role như `roleCode == LECTURER` ở từng báo cáo. Báo cáo chỉ nên biết tập dữ liệu đầu vào đã được lọc theo scope.

### 9.4. Danh mục đào tạo

Danh mục có hai tầng:

```text
Read catalog
Manage catalog within allowed action/scope
```

Đề xuất ban đầu:

- Trưởng bộ môn được xem toàn bộ danh mục phục vụ tra cứu, và được thêm/sửa/xóa các phần nghiệp vụ được giao.
- Giảng viên được xem khoa, ngành, bộ môn, giảng viên, ngành đào tạo, học phần, lớp học phần.
- Giảng viên chỉ được tương tác với lớp học phần mình phụ trách, không được sửa khoa/ngành/bộ môn/giảng viên/học phần chung.
- Các thao tác sửa/xóa dữ liệu dùng chung như `Faculties`, `Departments`, `Majors`, `Courses`, `Lecturers` cần rất thận trọng vì ảnh hưởng nhiều scope; nếu chưa chốt, khóa CRUD cho giảng viên và chỉ mở cho trưởng bộ môn/admin.

### 9.5. Khảo sát học phần

- Trưởng bộ môn và giảng viên đều nhìn thấy nếu có `COURSE_CAMPAIGNS_ACCESS`.
- Trưởng bộ môn thao tác trong scope bộ môn.
- Giảng viên thao tác trong scope lớp học phần phụ trách.
- Khi tạo/cập nhật lịch khảo sát lớp học phần, backend phải validate lớp học phần thuộc scope của active profile.

### 9.6. Khảo sát chương trình đào tạo

- Chưa gán cho trưởng bộ môn/giảng viên trong phase này nếu chưa có actor phụ trách CTĐT.
- Dự kiến sau này cần scope theo `MAJOR` hoặc một role riêng như `PROGRAM_MANAGER`.
- Không ép khảo sát CTĐT vào scope `DEPARTMENT` nếu dữ liệu thực tế thuộc ngành đào tạo.

## 10. Việc cần làm

### Backend

1. Bổ sung model scope:
   - Thêm `ScopeType`, `ScopeId`, `ScopeCode`, `ScopeName` vào `UserProfile`.
   - Cấu hình EF length/index.
   - Tạo migration bằng EF, không viết raw SQL trong `Program.cs`.

2. Validate scope khi tạo/sửa profile:
   - Cập nhật `SaveAdminProfileCommand`.
   - Cập nhật `SaveProfileRequest`.
   - Không cho lưu `ScopeType` không hợp lệ.
   - Không cho lưu `ScopeId` không tồn tại với loại scope tương ứng.
   - Đồng bộ `OrganizationUnitCode/Name` từ scope đã chọn để tương thích tạm thời.

3. Thêm API lấy lựa chọn scope cho màn quản trị user:
   - `GET /api/admin/profile-scopes?type=DEPARTMENT`
   - hoặc một endpoint trả grouped options.
   - Options lấy từ `Faculties`, `Departments`, `Majors`, `Lecturers`, `CourseSections`.
   - Có search/paging cho `LECTURER` và `COURSE_SECTION` vì dữ liệu có thể lớn.

4. Tạo `AccessContext` phía backend:
   - `UserId`
   - `ActiveProfileId`
   - `RoleCode`
   - `Permissions`
   - `ScopeType`
   - `ScopeId`
   - `ScopeCode`
   - `ScopeName`
   - `ActionPolicies`
   - `ScopeCode/ScopeName` chỉ dùng hiển thị, không dùng để authorize.

5. Tạo service/helper lọc scope:
   - Ví dụ `IAccessScopeService`.
   - Có hàm áp scope cho `CourseSections`.
   - Có hàm kiểm tra một `CourseSectionId`, `CourseSectionSurveyId`, `LecturerId`, `DepartmentId` có thuộc scope không.
   - Mỗi hàm phải dùng mapping chính thức đã chốt, không tự fallback theo nhiều quan hệ.
   - Có test chứng minh `SYSTEM` mở tập dữ liệu nhưng không bypass action policy.

6. Áp scope vào report/progress/dashboard ở mức base:
   - Mọi query aggregate hiện có phải filter scope từ đầu.
   - Không tính toàn bộ rồi mới lọc ở frontend.
   - Không thiết kế thay các loại báo cáo tương lai; chỉ cung cấp helper và ví dụ áp scope chuẩn.
   - Test riêng giảng viên, trưởng bộ môn, system.

7. Áp scope vào khảo sát học phần:
   - Danh sách chiến dịch/lớp khảo sát lọc theo scope.
   - Mutations validate record thuộc scope trước khi sửa.
   - Trả 403 cho record ngoài scope.

8. Áp action policy cho danh mục:
   - Read catalog có thể rộng hơn manage catalog.
   - Mutations của lớp học phần kiểm tra scope.
   - Mutations của khoa/ngành/bộ môn/giảng viên/học phần dùng policy riêng, không mở mặc định cho giảng viên.
   - Business service chỉ gọi `AccessContext.ActionPolicies` hoặc policy resolver, không tự rải `roleCode` condition.

9. Audit:
   - Ghi `ActiveProfileId`, `ScopeType`, `ScopeId` trong audit metadata cho các thao tác scoped.
   - Khi profile đổi scope, revoke session của profile đó giống khi đổi role.

### Frontend

1. Cập nhật type:
   - `AuthAccess.scope`.
   - `AuthProfile.scope`.
   - `AdminProfileDto.scope`.

2. Cập nhật màn tạo/sửa hồ sơ làm việc:
   - Thay input tự do "Mã đơn vị/phạm vi" bằng select loại scope + combobox chọn scope.
   - Khi chọn scope, tự điền code/name.
   - Vẫn hiển thị `OrganizationUnitCode/Name` nếu cần đối chiếu, nhưng không cho nhập tùy tiện sau khi đã có scope chuẩn.

3. Cập nhật header/profile menu:
   - Hiển thị scope đang hoạt động.
   - Với `SYSTEM`, hiển thị "Toàn trường".
   - Với `LECTURER`, hiển thị tên giảng viên.

4. Cập nhật bộ lọc ở dashboard/progress/report:
   - Giới hạn options theo scope user.
   - Nếu scope hẹp, mặc định chọn scope đó và khóa bộ lọc vượt phạm vi.
   - Không ẩn thông tin "đang lọc theo scope" khiến user hiểu nhầm dữ liệu toàn trường.

5. Cập nhật danh mục đào tạo:
   - Phân biệt action xem và action quản lý.
   - Giảng viên chỉ hiện action tương tác với lớp học phần thuộc scope.
   - Các nút không được phép phải ẩn hoặc disabled có lý do, không gửi request để backend từ chối rồi mới báo lỗi chung chung.

6. Cập nhật khảo sát học phần:
   - Danh sách lớp/đợt khảo sát lấy từ API đã scoped.
   - Không cho chọn lớp học phần ngoài scope khi tạo/cập nhật lịch.

## 11. Migration dữ liệu hiện có

Vì hiện `OrganizationUnitCode/Name` đang là text tự do, cần migration mềm:

1. Thêm cột scope nullable trước.
2. Seeder/backfill gợi ý:
   - Profile role `ADMIN`, Ban giám hiệu, Thanh tra toàn trường: `ScopeType = SYSTEM`.
   - Profile role `DEPARTMENT_MANAGER`: nếu `OrganizationUnitCode` parse được ra `DepartmentId`, set `DEPARTMENT`.
   - Profile role `LECTURER`: map theo email user với `Lecturers.Email`, set `LECTURER`.
3. Các profile không map được thì để scope null và hiển thị cảnh báo trong màn quản trị.
4. Sau khi admin chuẩn hóa xong, bật validation bắt buộc scope với các role cần scope.
5. Chỉ sau khi dữ liệu ổn định mới cân nhắc bỏ nhập tự do `OrganizationUnitCode/Name`.

Không nên migration cứng khiến hệ thống lỗi đăng nhập nếu dữ liệu cũ chưa sạch.

## 12. Không làm trong phase đầu

- Không tạo engine phân quyền tổng quát quá rộng nếu chỉ cần scope vài bảng chính.
- Không tạo permission CRUD cho từng button.
- Không dùng frontend filter làm bảo mật chính.
- Không thiết kế trước toàn bộ nghiệp vụ thống kê báo cáo khi module này còn do người khác triển khai và có thể thay đổi.
- Không hard-code từng loại báo cáo vào scope phase; scope phase chỉ cung cấp context/helper/guard.
- Không dùng `ScopeCode`, `ScopeName`, `OrganizationUnitCode`, `OrganizationUnitName` để authorize hoặc join/query nghiệp vụ.
- Không để `IAccessScopeService` tự đoán scope bằng nhiều fallback ngầm.
- Không dùng `SYSTEM` để bypass permission module hoặc action policy.
- Không rải `if roleCode == ...` trong business service; action theo role nếu cần phải nằm trong resolver tập trung.
- Không cho giảng viên xem dữ liệu lớp học phần chưa gắn `LecturerId`.
- Không xử lý khảo sát chương trình đào tạo theo scope khi chưa chốt role phụ trách.
- Không hard-code "Ban giám hiệu chỉ có 1 user" vào schema.
- Không dùng `OrganizationUnitName` để query dữ liệu nghiệp vụ.
- Không sửa/xóa dữ liệu catalog ngoài scope chỉ vì user có `CATALOG_ACCESS`.

## 13. Tiêu chí nghiệm thu

- Tạo/sửa profile bắt buộc chọn scope chuẩn với các role cần scope.
- `/api/auth/access` trả scope của active profile.
- Giảng viên đăng nhập chỉ thấy dashboard/progress/report/course survey thuộc lớp học phần mình phụ trách.
- Trưởng bộ môn chỉ thấy dữ liệu thuộc bộ môn của profile.
- Thanh tra/Ban giám hiệu với `SYSTEM` thấy dữ liệu toàn trường.
- `SYSTEM` vẫn bị chặn mutation nếu action policy không cho phép.
- Frontend không hiển thị bộ lọc phạm vi ngoài scope.
- Backend trả 403 khi user truy cập hoặc mutate record ngoài scope bằng URL/API thủ công.
- Danh mục đào tạo cho giảng viên là read-mostly; chỉ lớp học phần thuộc scope mới có action tương tác nếu nghiệp vụ mở.
- Khi đổi scope của profile, session cũ của profile bị revoke hoặc access context được reload chắc chắn.
- Có test cho `SYSTEM`, `DEPARTMENT`, `LECTURER` trên ít nhất report/progress/course survey.
- Không còn query báo cáo/tiến độ nào trả dữ liệu toàn trường cho profile scope hẹp.
- Có tài liệu/hàm mẫu để người triển khai báo cáo mới biết phải áp scope trước khi aggregate dữ liệu.
- Có bảng mapping chính thức từ scope sang bảng nghiệp vụ, ít nhất cho `CourseSections` và `CourseSectionSurveys`.
- Không có query authorization nào phụ thuộc vào `ScopeName` hoặc `OrganizationUnitName`.
- Action policy được resolve tập trung; các service nghiệp vụ không tự kiểm tra role rải rác.

## 14. Thứ tự triển khai đề xuất

1. Thiết kế và migrate schema scope trong `UserProfiles`.
2. Cập nhật admin UI để chọn scope chuẩn khi tạo/sửa hồ sơ làm việc.
3. Mở rộng `/api/auth/access` và type frontend.
4. Chốt bảng mapping chính thức từ scope sang dữ liệu nghiệp vụ.
5. Tạo `AccessContext` + action policy resolver + scope query helper backend.
6. Áp scope cho dashboard/progress/report hiện có trước, vì đây là phần rủi ro lộ dữ liệu cao nhất.
7. Áp scope cho khảo sát học phần.
8. Áp action policy cho danh mục đào tạo.
9. Backfill dữ liệu thật và khóa validation bắt buộc scope theo role.
10. Viết test authorization/scope và smoke test UI theo từng actor.
