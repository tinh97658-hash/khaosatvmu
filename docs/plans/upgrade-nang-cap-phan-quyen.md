# Kế hoạch nâng cấp phân quyền theo module

## 1. Nhận xét sau khi đối soát hệ thống hiện tại

Hệ thống đã có nền tảng phân quyền: `User -> UserProfile -> Role -> RolePermission -> Permission`. API `/api/auth/access` đã trả về `roleCode`, `organizationUnitCode` và `permissions[]`. Màn hình `RolePermissionEditor` cũng đã chỉnh được quyền theo vai trò.

Tuy nhiên mô hình quyền hiện tại chưa khớp với nhu cầu ẩn/khóa module trên giao diện:

- Backend vẫn seed permission kiểu cũ trong `DatabaseSeeder.cs`: `ADMIN_ACCESS`, `SURVEY_MANAGE`, `VIEW_REPORTS`, `VIEW_REPORTS_OPERATIONAL`, `VIEW_REPORTS_LECTURERS`, `VIEW_REPORTS_FACULTIES`, `VIEW_REPORTS_QUESTIONS`.
- Policy backend hiện chỉ có các nhóm cũ trong `PermissionAuth.cs`: `AdminAccess`, `SurveyManage`, `SurveyManageInOrganization`, `ViewReports`.
- Sidebar frontend chỉ kiểm tra riêng `users-admin` bằng `ADMIN_ACCESS`; các module còn lại luôn hiển thị.
- `App.tsx` render route theo `currentTab` nhưng chưa dùng chung một bảng `module -> permission`.
- `App.tsx` gọi API catalog/survey ngay sau đăng nhập, kể cả khi user không có quyền vào các module đó, dễ sinh 403/toast lỗi không cần thiết.
- Quyền báo cáo đang bị tách theo nội dung (`VIEW_REPORTS_*`), trong khi yêu cầu Phase 2 là quyền truy cập module, không phải phân quyền từng loại báo cáo.
- Chưa nên cấp quyền module nghiệp vụ cho `LECTURER` nếu backend chưa có data scope theo `LecturerId`.
- Cần nói rõ hơn về `ActiveProfileId`: hệ thống hiện đã có `AuthSession.ActiveProfileId` và claim `active_profile_id`; đây mới là profile đang dùng trong authorization context, không phải `UserProfile.IsActive`.
- `RolePermissions.IsGranted` đang tồn tại trong schema, nhưng Phase 2 chưa nên triển khai explicit deny hoặc deny precedence.

Kết luận: trước khi code Phase 2 cần có **Phase 0 - Actor/Module Matrix** để chốt ai dùng hệ thống, vào module nào, phạm vi dữ liệu ra sao. Sau đó Phase 2 mới triển khai **module-level access**. Permission chỉ trả lời câu hỏi "user có được vào module này không?". Data scope và action/CRUD để phase sau.

## 2. Mục tiêu sau khi nâng cấp

Sau khi hoàn thành, quyền sẽ vận hành theo một nguồn sự thật duy nhất:

```text
RolePermission trong DB
  -> /api/auth/access.permissions[]
  -> canAccessModule()
  -> Sidebar / route guard / fetch guard
```

Kết quả mong muốn:

- User chỉ thấy module được cấp quyền.
- Nếu mở URL/hash module không có quyền, app tự chuyển về `overview`.
- Frontend không gọi API của module không có quyền.
- Backend policy dùng permission module mới, không còn phụ thuộc permission báo cáo chi tiết kiểu `VIEW_REPORTS_*`.
- `ADMIN` không cần hard-code bypass ở frontend; role này được cấp đủ permission trong DB.

## 3. Nguyên tắc thiết kế

- `Permission` = quyền truy cập module.
- `Role` = tập permission được cấp.
- `Scope` = user được xem dữ liệu của ai/đơn vị nào, không làm trong Phase 2.
- `Action/CRUD` = user được tạo/sửa/xóa hay chỉ xem, không làm trong Phase 2.
- `UserProfile.IsActive` = profile còn hiệu lực hay không.
- `ActiveProfileId` = profile đang được dùng trong authorization context hiện tại.
- `IsDefault` = profile được chọn mặc định khi user chưa có lựa chọn trước đó.
- `LastSelectedAt` = dữ liệu hỗ trợ UX để gợi ý profile được dùng gần nhất.
- Dashboard là màn hình mặc định cho mọi authenticated user, không cần lưu `DASHBOARD_ACCESS`.
- Vì nghiệp vụ phân quyền chưa chốt hoàn toàn, thiết kế phải ưu tiên cấu hình được thay vì hard-code theo role, profile hoặc phòng ban cụ thể.
- Seed data chỉ là cấu hình mặc định ban đầu; quyền thực tế phải chỉnh được qua `RolePermissionEditor` hoặc dữ liệu DB.
- Mọi mapping cố định trong code phải nằm ở một nơi duy nhất, dễ thay đổi khi đổi tên module, tách module hoặc gom module.

Không dùng `IsActive` để biểu diễn profile đang được chọn. Một user có thể có nhiều profile `IsActive = true`, nhưng tại một thời điểm chỉ có một `ActiveProfileId`.

Không tạo các permission như:

```text
VIEW_REPORTS_FACULTIES
VIEW_REPORTS_LECTURERS
VIEW_REPORTS_QUESTIONS
SURVEY_MANAGE_OWN
CAN_CREATE_COURSE
CAN_EDIT_COURSE
```

## 4. Thiết kế mở để dễ thay đổi nghiệp vụ

Do chưa có nghiệp vụ phân quyền chính xác, Phase 2 không nên thiết kế theo các giả định quá cụ thể như "role A chắc chắn được module B" hoặc "giảng viên luôn chỉ có quyền C". Các giả định này chỉ nên tồn tại dưới dạng seed/config ban đầu, không phải logic cố định trong code.

Các điểm cần giữ mở:

- Role có thể thêm/sửa/xóa quyền bằng DB/admin UI mà không sửa frontend.
- Một module có thể đổi permission yêu cầu tại `modulePermissions.ts` mà không sửa từng component.
- Sidebar, route guard và fetch guard dùng chung `canAccessModule()`, tránh mỗi nơi tự viết logic riêng.
- Backend policy nên dùng permission code ổn định, không kiểm tra trực tiếp `roleCode`, `profileCode` hoặc tên đơn vị.
- `OrganizationUnitCode`, `LecturerId` và các thông tin nghiệp vụ khác chỉ là dữ liệu đầu vào cho scope sau này; Phase 2 không khóa cứng cách hiểu các trường này.
- Không thiết kế permission quá mịn khi chưa có nghiệp vụ rõ, vì sau này rất dễ phải đổi hàng loạt quyền và dữ liệu seed.
- Khi cần scope/action trong tương lai, bổ sung lớp policy riêng bên dưới module access thay vì phá lại model `UserProfile -> Role -> Permission`.

Nguyên tắc chốt:

```text
Code chỉ biết cách kiểm tra permission.
DB/admin UI quyết định role nào có permission nào.
Scope/action sẽ là lớp mở rộng sau module access.
```

## 5. Phase 0 - Actor/Module Matrix

Trước khi code Phase 2, cần lập và duyệt ma trận nghiệp vụ tối thiểu:

| Actor/Profile | Module | Access | Scope dự kiến | Ghi chú |
| --- | --- | --- | --- | --- |
| `ADMIN` | Reports | Có | All | Gợi ý ban đầu |
| `ADMIN` | Catalog | Có | All | Gợi ý ban đầu |
| `SURVEY_ADMIN` | Course Campaigns | Có | All hoặc theo phân công | Cần nghiệp vụ xác nhận |
| `INSPECTOR` | Reports | Có | All | Nếu có actor này |
| `DEPARTMENT_MANAGER` | Reports | Có | Organization Unit | Cần định nghĩa đơn vị quản lý |
| `LECTURER` | Course Campaigns | Chưa chốt | Chưa chốt | Không cấp nếu chưa rõ scope |
| `GUEST_LECTURER` | Course Campaigns | Chưa chốt | Chưa chốt | Không cấp nếu chưa rõ scope |

Quy trình đúng:

```text
Actor/Profile
  -> Module Access
  -> Scope dự kiến
  -> Permission
  -> Role
```

Role và permission là kết quả của nghiệp vụ đã được duyệt, không phải thứ nghĩ ra trước rồi ép nghiệp vụ vào. Vì hệ thống hiện còn nhỏ, không xây framework authorization tổng quát trước khi có nhu cầu thật.

## 6. Permission module cần chốt

| Permission | Module |
| --- | --- |
| `PROGRESS_ACCESS` | Tiến độ thu phiếu |
| `REPORTS_ACCESS` | Thống kê & Báo cáo |
| `CATALOG_ACCESS` | Danh mục đào tạo |
| `COURSE_QUESTION_SETS_ACCESS` | Bộ câu hỏi khảo sát học phần |
| `COURSE_CAMPAIGNS_ACCESS` | Khảo sát học phần |
| `PROGRAM_CAMPAIGNS_ACCESS` | Đợt khảo sát CTĐT |
| `PROGRAM_CRITERIA_ACCESS` | Tiêu chí CTĐT |
| `USER_ADMIN_ACCESS` | Người dùng & phân quyền |

Mapping frontend:

| Tab/module id | Permission |
| --- | --- |
| `overview` | Không cần |
| `progress` | `PROGRESS_ACCESS` |
| `reports` | `REPORTS_ACCESS` |
| `faculties`, `departments`, `lecturers`, `majors`, `courses`, `classes` | `CATALOG_ACCESS` |
| `course-question-sets` | `COURSE_QUESTION_SETS_ACCESS` |
| `course-campaigns` | `COURSE_CAMPAIGNS_ACCESS` |
| `program-campaigns` | `PROGRAM_CAMPAIGNS_ACCESS` |
| `program-criteria` | `PROGRAM_CRITERIA_ACCESS` |
| `users-admin` | `USER_ADMIN_ACCESS` |

## 7. Phân quyền mặc định theo role

Đây chỉ là cấu hình gợi ý để seed ban đầu. Không coi bảng này là nghiệp vụ cố định; khi nhà trường thay đổi phân công, chỉ cần sửa role-permission trong DB/admin UI.

| Role | Quyền được cấp mặc định trong Phase 2 |
| --- | --- |
| `ADMIN` | Tất cả permission module |
| `SURVEY_ADMIN` | `PROGRESS_ACCESS`, `REPORTS_ACCESS`, `CATALOG_ACCESS`, `COURSE_QUESTION_SETS_ACCESS`, `COURSE_CAMPAIGNS_ACCESS`, `PROGRAM_CAMPAIGNS_ACCESS`, `PROGRAM_CRITERIA_ACCESS` |
| `DEPARTMENT_MANAGER` | `PROGRESS_ACCESS`, `REPORTS_ACCESS` |
| `INSPECTOR` nếu bổ sung role này | `PROGRESS_ACCESS`, `REPORTS_ACCESS` |
| `LECTURER` | Chỉ dashboard trong Phase 2 nếu chưa duyệt module/scope cụ thể |
| `GUEST_LECTURER` nếu bổ sung role này | Chỉ dashboard trong Phase 2 nếu chưa duyệt module/scope cụ thể |

Ghi chú: nếu chưa xác định Lecturer thực sự cần truy cập module nào và scope tương ứng là gì, Phase 2 không cấp permission nghiệp vụ cho `LECTURER` hoặc `GUEST_LECTURER`. Không cấp `COURSE_CAMPAIGNS_ACCESS` chỉ vì "sau này có thể cần".

## 8. ActiveProfileId và authorization context

`ActiveProfileId` phải do backend xác định và xác minh. Frontend không được tự gửi `roleCode`, `profileCode` hoặc quyền rồi backend tin theo.

Luồng đăng nhập:

```text
Login
  -> Load User
  -> Load UserProfiles còn hiệu lực
  -> Chọn ActiveProfileId từ lựa chọn user / LastSelectedAt / IsDefault
  -> Tạo server auth session + claim active_profile_id
  -> Resolve permissions từ Role của ActiveProfileId
```

Luồng đổi profile:

```text
Current User
  -> Select Profile B
  -> Backend validate Profile B thuộc User hiện tại
  -> Backend validate Profile B IsActive = true
  -> Update authorization context / active_profile_id
  -> Reload permissions
  -> Reload UI/data theo profile mới
```

Mọi API authorization phải resolve lại user context từ principal/session hiện tại:

```text
UserId + ActiveProfileId
  -> User còn active
  -> UserProfile thuộc User và còn active
  -> Role
  -> RolePermissions
  -> Effective permissions
```

## 9. RolePermissions.IsGranted

Schema hiện tại có `RolePermissions.IsGranted`. Phase 2 chỉ dùng theo nghĩa đơn giản:

```text
IsGranted = true
  -> Granted

IsGranted = false
  -> Không được tính vào effective permissions
```

Phase 2 chưa triển khai explicit deny và chưa có deny precedence. Không thiết kế tình huống:

```text
Role A grant REPORTS
Role B deny REPORTS
```

vì authorization chỉ dựa trên role của active profile, không cộng nhiều role/profile. Nếu sau này không cần deny semantics, có thể cân nhắc đơn giản hóa model về:

```text
RolePermissions
  -> RoleId
  -> PermissionId
```

Khi đó có record là granted, không có record là không granted.

## 10. Việc cần làm

### Backend

0. Hoàn thành Phase 0:
   - Lập Actor/Module Matrix.
   - Chốt module access tối thiểu cho từng actor/profile.
   - Ghi rõ scope dự kiến, kể cả khi scope chưa làm trong Phase 2.
   - Không bắt đầu seed role-permission khi matrix chưa được duyệt.

1. Cập nhật `DatabaseSeeder.cs`:
   - Thêm 8 permission module mới.
   - Cấp quyền mặc định theo bảng role ở trên.
   - Không seed thêm các permission `VIEW_REPORTS_*` cho thiết kế mới.
   - Không viết logic nghiệp vụ cố định vào seeder; seeder chỉ đảm bảo dữ liệu nền tối thiểu.
   - Với `RolePermissions.IsGranted`, Phase 2 chỉ seed record `IsGranted = true`.

2. Cập nhật `PermissionAuth.cs`:
   - `USER_ADMIN_ACCESS`
   - `CATALOG_ACCESS`
   - `COURSE_QUESTION_SETS_ACCESS`
   - `COURSE_CAMPAIGNS_ACCESS`
   - `PROGRAM_CAMPAIGNS_ACCESS`
   - `PROGRAM_CRITERIA_ACCESS`
   - `PROGRESS_ACCESS`
   - `REPORTS_ACCESS`

3. Cập nhật endpoint authorization:
   - `/api/admin/*` dùng `USER_ADMIN_ACCESS`.
   - `/api/catalog/*` dùng `CATALOG_ACCESS`.
   - `/api/v1/reports/*` dùng `REPORTS_ACCESS`.
   - Các endpoint survey cần tách theo module thay vì gom toàn bộ vào `SURVEY_MANAGE`.

4. Giữ `/api/auth/access` như hiện tại vì đã trả đủ `permissions[]`.

5. Làm rõ `ActiveProfileId`:
   - Dùng claim `active_profile_id` / auth session làm source cho active profile hiện tại.
   - Khi switch profile, backend phải validate profile thuộc user hiện tại và `IsActive = true`.
   - Sau khi switch profile, reload permissions từ role của profile mới.

6. Chuẩn bị extension point cho scope/action sau này:
   - Giữ `OrganizationUnitCode` trong access context.
   - Nếu sau này cần `LecturerId` hoặc scope khác, bổ sung vào context/API hợp đồng rõ ràng.
   - Không nhồi scope/action vào permission code.

### Frontend

1. Tạo `src/Frontend/src/auth/modulePermissions.ts`:

```typescript
export const MODULE_REQUIRED_PERMISSION: Record<string, string | null> = {
  overview: null,
  progress: 'PROGRESS_ACCESS',
  reports: 'REPORTS_ACCESS',
  faculties: 'CATALOG_ACCESS',
  departments: 'CATALOG_ACCESS',
  lecturers: 'CATALOG_ACCESS',
  majors: 'CATALOG_ACCESS',
  courses: 'CATALOG_ACCESS',
  classes: 'CATALOG_ACCESS',
  'course-question-sets': 'COURSE_QUESTION_SETS_ACCESS',
  'course-campaigns': 'COURSE_CAMPAIGNS_ACCESS',
  'program-campaigns': 'PROGRAM_CAMPAIGNS_ACCESS',
  'program-criteria': 'PROGRAM_CRITERIA_ACCESS',
  'users-admin': 'USER_ADMIN_ACCESS',
};

export function canAccessModule(
  permissions: readonly string[] | undefined,
  moduleId: string,
): boolean {
  const required = MODULE_REQUIRED_PERMISSION[moduleId] ?? null;
  return required === null || permissions?.includes(required) === true;
}
```

2. Cập nhật `Sidebar.tsx`:
   - Nhận `permissions` thay vì `canManageUsers`.
   - Filter toàn bộ menu bằng `canAccessModule`.

3. Cập nhật `App.tsx`:
   - Dùng `auth.access?.permissions ?? []`.
   - Guard `currentTab`; nếu không có quyền thì redirect về `overview`.
   - Chỉ render page khi `canAccessModule(permissions, currentTab)` hợp lệ.
   - Chỉ gọi API catalog/survey/report tương ứng khi user có quyền module.

4. Cập nhật logic `users-admin`:
   - Thay `ADMIN_ACCESS` bằng `USER_ADMIN_ACCESS`.

5. Tránh hard-code nghiệp vụ chưa chốt:
   - Không viết điều kiện theo `roleCode` trong sidebar/page.
   - Không viết điều kiện theo `profileCode` trong UI.
   - Không copy mapping module-permission sang nhiều file.
   - Khi đổi profile, reload `auth.access` và dữ liệu trang theo permissions mới.

## 11. Không làm trong Phase 2

- Không phân quyền từng button.
- Không phân quyền từng thao tác tạo/sửa/xóa.
- Không phân quyền từng loại báo cáo.
- Không scope dữ liệu theo Khoa/Bộ môn.
- Không scope dữ liệu theo giảng viên.
- Không thêm `SURVEY_MANAGE_OWN`.
- Không hard-code `roleCode === 'ADMIN'` để bypass frontend.
- Không hard-code nghiệp vụ tạm thời thành logic lâu dài.
- Không cộng quyền của tất cả profile; chỉ dùng quyền của active profile.
- Không dùng `IsActive` với nghĩa "profile đang được chọn".
- Không triển khai deny precedence cho `RolePermissions.IsGranted`.
- Không cấp permission nghiệp vụ cho `LECTURER`/`GUEST_LECTURER` nếu chưa có Actor/Module Matrix và scope rõ ràng.

## 12. Trạng thái trước và sau

Trước khi nâng cấp:

```text
Permission cũ lẫn module/content/action
Sidebar gần như luôn hiện đủ menu
App gọi nhiều API dù user không có quyền
Backend gom catalog/survey bằng SURVEY_MANAGE
Reports có nhiều VIEW_REPORTS_* không đúng mục tiêu Phase 2
ActiveProfileId chưa được mô tả rõ trong kế hoạch triển khai
Chưa có Actor/Module Matrix được duyệt trước khi seed role-permission
```

Sau khi nâng cấp:

```text
Permission chỉ đại diện quyền vào module
Sidebar ẩn đúng theo permissions[]
Route/hash bị chặn bằng cùng một canAccessModule()
API fetch được gate theo module
Backend policy dùng permission module mới
RolePermissionEditor trở thành nơi cấu hình module access
Khi nghiệp vụ đổi, ưu tiên đổi cấu hình role-permission thay vì sửa code
ActiveProfileId là authorization context duy nhất của phiên hiện tại
Role-permission được sinh ra từ Actor/Module Matrix đã duyệt
```

## 13. Tiêu chí nghiệm thu

- Có Actor/Module Matrix được duyệt trước khi triển khai seed role-permission.
- `ADMIN` thấy và vào được toàn bộ module.
- `SURVEY_ADMIN` thấy toàn bộ module nghiệp vụ, không thấy `users-admin`.
- `DEPARTMENT_MANAGER` chỉ thấy `overview`, `progress`, `reports`.
- `LECTURER` và `GUEST_LECTURER` chỉ thấy `overview` trong Phase 2 nếu chưa có module/scope được duyệt.
- User không có `CATALOG_ACCESS` không gọi `/api/catalog/*` từ frontend sau đăng nhập.
- User không có `REPORTS_ACCESS` không vào được tab `reports`.
- User không có `USER_ADMIN_ACCESS` không thấy và không vào được `users-admin`.
- `/api/auth/access` trả đúng danh sách permission sau khi đổi profile.
- Backend từ chối switch sang profile không thuộc user hiện tại hoặc `IsActive = false`.
- `IsActive`, `IsDefault`, `LastSelectedAt` không bị dùng thay cho `ActiveProfileId`.
- Phase 2 chỉ tính `RolePermissions.IsGranted = true`; không có deny precedence.
- Khi đổi quyền của một role trong `RolePermissionEditor`, sidebar/route/fetch phản ánh theo `permissions[]` mà không cần sửa code.
- Test authorization backend và smoke test frontend đều qua.
