Đúng. Nếu đã chốt **phân quyền theo module**, thì bản kế hoạch hiện tại cần sửa khá mạnh, đặc biệt là bỏ tư duy `VIEW_REPORTS_FACULTIES`, `VIEW_REPORTS_LECTURERS`, `SURVEY_MANAGE_OWN`... vì những cái đó lại quay về **phân quyền theo nội dung/phạm vi**.

Tôi đề xuất chốt kiến trúc như sau:

> **Permission quyết định user có được vào module hay không.**
> **Role quyết định tập module được phép truy cập.**
> **Scope/action bên trong module là lớp phân quyền khác, chỉ bổ sung khi nghiệp vụ thực sự cần.**

Với Phase 2 hiện tại, **chỉ làm module-level access**.

Dưới đây là bản kế hoạch tôi sẽ sửa lại.

---

# Bổ sung: Ẩn UI theo quyền trên toàn Sidebar — Phase 2

> Kế hoạch bổ sung cho `nang-cap-phan-quyen.md`
> Phase 1 — `Category` + `RolePermissionEditor` — đã hoàn thành.
>
> **Phase 2:** làm cho Frontend thực sự tôn trọng quyền truy cập module của user.

> [!IMPORTANT]
> `RolePermissions` hiện tại **không được coi là thiết kế cuối cùng**. Permission sẽ được thiết kế lại theo **module**, không theo nội dung báo cáo hay từng thao tác UI.

---

# 1. Nguyên tắc phân quyền được chốt

## 1.1 Permission = quyền truy cập module

Không thiết kế permission kiểu:

```text
VIEW_REPORTS_FACULTIES
VIEW_REPORTS_LECTURERS
VIEW_REPORTS_QUESTIONS
SURVEY_MANAGE_OWN
CAN_CREATE_COURSE
CAN_EDIT_COURSE
CAN_DELETE_COURSE
```

ở Phase này.

Thay vào đó:

```text
REPORTS_ACCESS
PROGRESS_ACCESS
CATALOG_ACCESS
COURSE_QUESTION_SETS_ACCESS
COURSE_CAMPAIGNS_ACCESS
PROGRAM_CAMPAIGNS_ACCESS
PROGRAM_CRITERIA_ACCESS
USER_ADMIN_ACCESS
```

Permission trả lời một câu hỏi đơn giản:

> **User này có được truy cập module này không?**

Ví dụ:

```text
DEPARTMENT_MANAGER
    ├── PROGRESS_ACCESS
    ├── REPORTS_ACCESS
    └── CATALOG_ACCESS? ❌
```

thì Sidebar sẽ quyết định:

```text
Dashboard              ✓
Tiến độ thu phiếu       ✓
Thống kê & Báo cáo      ✓
Khoa / Viện             ✗
Bộ môn                  ✗
...
```

---

# 2. Không phân quyền theo từng nội dung bên trong module

Ví dụ module:

```text
THỐNG KÊ & BÁO CÁO
```

chỉ có:

```text
REPORTS_ACCESS
```

Không tạo:

```text
REPORTS_FACULTIES_ACCESS
REPORTS_LECTURERS_ACCESS
REPORTS_QUESTIONS_ACCESS
```

Nếu một user có:

```text
REPORTS_ACCESS
```

thì họ được vào module **Thống kê & Báo cáo**.

Việc bên trong module hiển thị dữ liệu nào, phạm vi dữ liệu nào sẽ **không được giải quyết bằng permission mới ở Phase 2**.

Nếu sau này cần:

```text
Trưởng khoa → chỉ xem dữ liệu khoa mình
Thanh tra → xem toàn trường
Giảng viên → chỉ xem dữ liệu của bản thân
```

thì đó là **data scope / authorization policy**, không phải tạo thêm hàng loạt permission.

---

# 3. Permission model mới

Tôi đề xuất bảng permission cuối cùng cho Phase 2 như sau:

| Permission                    | Module                  |
| ----------------------------- | ----------------------- |
| `DASHBOARD_ACCESS`            | Bảng điều khiển         |
| `PROGRESS_ACCESS`             | Tiến độ thu phiếu       |
| `REPORTS_ACCESS`              | Thống kê & Báo cáo      |
| `CATALOG_ACCESS`              | Danh mục đào tạo        |
| `COURSE_QUESTION_SETS_ACCESS` | Bộ câu hỏi khảo sát     |
| `COURSE_CAMPAIGNS_ACCESS`     | Khảo sát học phần       |
| `PROGRAM_CAMPAIGNS_ACCESS`    | Đợt khảo sát CTĐT       |
| `PROGRAM_CRITERIA_ACCESS`     | Tiêu chí CTĐT           |
| `USER_ADMIN_ACCESS`           | Người dùng & phân quyền |

### Tuy nhiên

`DASHBOARD_ACCESS` có thể **không cần lưu trong DB**.

Dashboard là module cơ bản mà mọi authenticated user đều được truy cập.

Do đó permission thực tế trong DB có thể chỉ cần:

```text
PROGRESS_ACCESS
REPORTS_ACCESS
CATALOG_ACCESS
COURSE_QUESTION_SETS_ACCESS
COURSE_CAMPAIGNS_ACCESS
PROGRAM_CAMPAIGNS_ACCESS
PROGRAM_CRITERIA_ACCESS
USER_ADMIN_ACCESS
```

Đây là cách tôi khuyến nghị.

---

# 4. Mapping Sidebar → Permission

Hiện tại Sidebar có 12 module/tab.

## TỔNG QUAN

| Module             | Permission        |
| ------------------ | ----------------- |
| Bảng điều khiển    | Không cần         |
| Tiến độ thu phiếu  | `PROGRESS_ACCESS` |
| Thống kê & Báo cáo | `REPORTS_ACCESS`  |

## DANH MỤC ĐÀO TẠO

6 module này dùng chung một quyền vì chúng thuộc cùng một nghiệp vụ:

| Module        | Permission       |
| ------------- | ---------------- |
| Khoa / Viện   | `CATALOG_ACCESS` |
| Bộ môn        | `CATALOG_ACCESS` |
| Giảng viên    | `CATALOG_ACCESS` |
| Ngành đào tạo | `CATALOG_ACCESS` |
| Học phần      | `CATALOG_ACCESS` |
| Lớp học phần  | `CATALOG_ACCESS` |

## KHẢO SÁT HỌC PHẦN

| Module              | Permission                    |
| ------------------- | ----------------------------- |
| Bộ câu hỏi khảo sát | `COURSE_QUESTION_SETS_ACCESS` |
| Khảo sát học phần   | `COURSE_CAMPAIGNS_ACCESS`     |

## KHẢO SÁT CHƯƠNG TRÌNH

| Module            | Permission                 |
| ----------------- | -------------------------- |
| Đợt khảo sát CTĐT | `PROGRAM_CAMPAIGNS_ACCESS` |
| Tiêu chí CTĐT     | `PROGRAM_CRITERIA_ACCESS`  |

## QUẢN TRỊ

| Module                  | Permission          |
| ----------------------- | ------------------- |
| Người dùng & phân quyền | `USER_ADMIN_ACCESS` |

---

# 5. Vì sao không dùng `SURVEY_MANAGE`

Permission cũ:

```text
SURVEY_MANAGE
```

thực chất đang gom:

```text
Catalog
Question Sets
Course Campaigns
Program Campaigns
Program Criteria
```

vào một permission.

Điều này vẫn mang tính **business capability**, nhưng không phản ánh rõ quyền truy cập module.

Ví dụ:

```text
SURVEY_ADMIN
```

có thể quản lý tất cả.

Nhưng một role khác trong tương lai có thể cần:

```text
COURSE_CAMPAIGNS_ACCESS
```

mà không cần:

```text
CATALOG_ACCESS
PROGRAM_CAMPAIGNS_ACCESS
```

Với module-based permission, việc này rất dễ cấu hình trong `RolePermissionEditor`.

---

# 6. Role model

Sau khi chuyển sang module-based permission, role có thể thiết kế như sau.

| Role                 | Dashboard | Progress | Reports | Catalog | Question Sets | Course Campaigns | Program Campaigns | Program Criteria | User Admin |
| -------------------- | --------: | -------: | ------: | ------: | ------------: | ---------------: | ----------------: | ---------------: | ---------: |
| `ADMIN`              |         ✓ |        ✓ |       ✓ |       ✓ |             ✓ |                ✓ |                 ✓ |                ✓ |          ✓ |
| `SURVEY_ADMIN`       |         ✓ |        ✓ |       ✓ |       ✓ |             ✓ |                ✓ |                 ✓ |                ✓ |          ✗ |
| `INSPECTOR`          |         ✓ |        ✓ |       ✓ |       ✗ |             ✗ |                ✗ |                 ✗ |                ✗ |          ✗ |
| `DEPARTMENT_MANAGER` |         ✓ |        ✓ |       ✓ |       ✗ |             ✗ |                ✗ |                 ✗ |                ✗ |          ✗ |
| `LECTURER`           |         ✓ |        ✗ |       ✗ |       ✗ |             ✗ |            **?** |                 ✗ |                ✗ |          ✗ |
| `GUEST_LECTURER`     |         ✓ |        ✗ |       ✗ |       ✗ |             ✗ |            **?** |                 ✗ |                ✗ |          ✗ |

### Quan trọng: `LECTURER`

Tôi **không khuyến nghị tiếp tục đưa `SURVEY_MANAGE_OWN` vào Phase 2**.

Lý do:

`COURSE_CAMPAIGNS_ACCESS` chỉ trả lời:

> Có được vào module Khảo sát học phần không?

Nó không trả lời:

> Được xem/sửa campaign của ai?

Đây là **scope dữ liệu**.

Ví dụ:

```text
LECTURER
    COURSE_CAMPAIGNS_ACCESS
           ↓
    Course Campaign module
           ↓
    chỉ lấy CourseSection mà
    LecturerId = currentUser.LecturerId
```

Nhưng backend hiện tại chưa có cơ chế đó.

Vì vậy:

> **Phase 2 không tự ý cấp `COURSE_CAMPAIGNS_ACCESS` cho Lecturer nếu backend chưa hỗ trợ scope.**

Phần này nên đưa sang Phase 3.

---

# 7. Role không còn quyết định trực tiếp UI

Luồng chính sẽ là:

```text
User
  ↓
UserProfile
  ↓
Role
  ↓
RolePermission
  ↓
Permission
  ↓
Frontend AuthContext
  ↓
permissions[]
  ↓
canAccessModule()
  ↓
Sidebar
```

Ví dụ:

```text
User: Nguyễn Văn A
        ↓
Role: DEPARTMENT_MANAGER
        ↓
Permissions:
    PROGRESS_ACCESS
    REPORTS_ACCESS
        ↓
Sidebar:
    Dashboard             ✓
    Tiến độ thu phiếu      ✓
    Thống kê & Báo cáo     ✓
    Catalog                ✗
    Course Campaign        ✗
    Program Campaign       ✗
    User Admin             ✗
```

Đây là luồng rất dễ hiểu.

---

# 8. Thay `tabPermissions.ts` thành `modulePermissions.ts`

Tôi khuyến nghị đổi tên file để thể hiện đúng kiến trúc.

### `[NEW]`

```text
src/Frontend/src/auth/modulePermissions.ts
```

Nội dung:

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
```

Sau đó:

```typescript
export function canAccessModule(
  permissions: readonly string[] | undefined,
  moduleId: string,
): boolean {
  const required = MODULE_REQUIRED_PERMISSION[moduleId] ?? null;

  if (required === null) {
    return true;
  }

  if (!permissions) {
    return false;
  }

  return (
    permissions.includes('USER_ADMIN_ACCESS') &&
    required === 'USER_ADMIN_ACCESS'
  ) || permissions.includes(required);
}
```

Tuy nhiên tôi còn khuyến nghị đơn giản hơn:

```typescript
export function canAccessModule(
  permissions: readonly string[] | undefined,
  moduleId: string,
): boolean {
  const required = MODULE_REQUIRED_PERMISSION[moduleId] ?? null;

  if (required === null) {
    return true;
  }

  if (!permissions) {
    return false;
  }

  return permissions.includes(required);
}
```

**Không nên hard-code `ADMIN_ACCESS` bypass ở đây** nếu DB đã được thiết kế đúng.

Thay vào đó, `ADMIN` phải thực sự có toàn bộ permission.

Như vậy:

> **Permission là source of truth.**

Không có ngoại lệ kiểu:

```typescript
if (role === 'ADMIN') ...
```

---

# 9. Sidebar

`Sidebar.tsx` chỉ cần biết:

```typescript
permissions
```

và:

```typescript
const visibleMenuGroups = menuGroups
  .map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAccessModule(permissions, item.id),
    ),
  }))
  .filter((group) => group.items.length > 0);
```

Sidebar **không cần biết role**.

Không cần:

```typescript
if (role === 'ADMIN')
if (role === 'SURVEY_ADMIN')
if (role === 'INSPECTOR')
```

Đây là điểm rất quan trọng.

---

# 10. App.tsx

`App.tsx` cũng dùng cùng một source:

```typescript
const permissions = auth.access?.permissions ?? [];
```

Redirect:

```typescript
useEffect(() => {
  if (!canAccessModule(permissions, currentTab)) {
    setCurrentTab('overview');
  }
}, [permissions, currentTab]);
```

Như vậy:

```text
Sidebar
   ↓
canAccessModule()

App routing
   ↓
canAccessModule()
```

cùng sử dụng:

```text
MODULE_REQUIRED_PERMISSION
```

Không có hai bảng mapping khác nhau.

---

# 11. Fetch API

Đây là phần rất quan trọng.

Không nên chỉ:

```text
ẩn Sidebar
```

mà vẫn:

```text
App mount
   ↓
fetch tất cả API
   ↓
403
```

Mỗi nhóm API phải được gate theo **module tương ứng**.

Ví dụ:

```typescript
const canAccessCatalog =
  canAccessModule(permissions, 'faculties');

const canAccessCourseCampaigns =
  canAccessModule(permissions, 'course-campaigns');

const canAccessReports =
  canAccessModule(permissions, 'reports');
```

Sau đó:

```typescript
if (!canAccessCatalog) {
  return;
}
```

hoặc:

```typescript
if (!canAccessCourseCampaigns) {
  return;
}
```

### Nhưng phải verify route backend trước

Không được giả định:

```text
REPORTS_ACCESS → mọi /api/reports/*
CATALOG_ACCESS → mọi /api/catalog/*
```

mà phải kiểm tra authorization thực tế.

---

# 12. Reports

Đây là thay đổi quan trọng nhất so với kế hoạch cũ.

**Không còn:**

```text
VIEW_REPORTS
VIEW_REPORTS_FACULTIES
VIEW_REPORTS_LECTURERS
VIEW_REPORTS_QUESTIONS
VIEW_REPORTS_OPERATIONAL
```

nữa.

Chỉ:

```text
REPORTS_ACCESS
```

và:

```text
PROGRESS_ACCESS
```

Ví dụ:

```text
Thống kê & Báo cáo
       ↓
REPORTS_ACCESS
       ↓
ReportsOverviewPage
       ↓
    các loại báo cáo
```

Nếu sau này cần:

```text
DEPARTMENT_MANAGER
→ chỉ xem báo cáo Khoa mình
```

thì không tạo:

```text
REPORTS_FACULTIES_ACCESS
```

mà backend xử lý:

```text
currentUser
    ↓
OrganizationUnitCode
    ↓
lọc dữ liệu báo cáo
```

Đây chính là **scope**, không phải module permission.

---

# 13. `SURVEY_MANAGE_OWN` cũng bỏ khỏi Phase 2

Phần này trong kế hoạch cũ nên xóa:

```text
SURVEY_MANAGE_OWN
```

Thay bằng:

```text
COURSE_CAMPAIGNS_ACCESS
```

Nhưng chỉ cấp cho Lecturer khi backend đã hỗ trợ:

```text
UserProfile
    ↓
LecturerId
    ↓
CourseSection.LecturerId
    ↓
lọc CourseCampaign
```

Nếu chưa có:

> Lecturer vẫn chưa được mở module `course-campaigns`.

Điều này giúp Phase 2 không bị biến thành một dự án backend authorization mới.

---

# 14. Phase 2 thực sự làm gì?

Sau khi sửa, phạm vi Phase 2 rất rõ:

### Làm

```text
Permission model theo module
        ↓
Seed permission mới
        ↓
RolePermission cập nhật
        ↓
RolePermissionEditor hiển thị permission module
        ↓
AuthContext lấy permissions
        ↓
Sidebar filter
        ↓
App route guard
        ↓
App fetch guard
        ↓
Reports không còn content-level permission
```

### Không làm

```text
❌ Phân quyền từng button
❌ Phân quyền từng loại báo cáo
❌ Phân quyền từng loại dữ liệu
❌ Scope theo Khoa/Bộ môn
❌ Scope theo Lecturer
❌ CRUD permission riêng
❌ ADMIN bypass hard-code
❌ Thay đổi authorization backend
```

Ngoại trừ những thay đổi backend **bắt buộc để permission module mới khớp route hiện tại**, nếu cần.

---

# 15. Verification mới

Kiểm thử theo **module**, không kiểm thử theo từng nội dung.

### ADMIN

```text
Dashboard             ✓
Progress              ✓
Reports               ✓
Catalog               ✓
Question Sets         ✓
Course Campaigns      ✓
Program Campaigns     ✓
Program Criteria      ✓
User Admin            ✓
```

### SURVEY_ADMIN

```text
Dashboard             ✓
Progress              ✓
Reports               ✓
Catalog               ✓
Question Sets         ✓
Course Campaigns      ✓
Program Campaigns     ✓
Program Criteria      ✓
User Admin            ✗
```

### INSPECTOR

```text
Dashboard             ✓
Progress              ✓
Reports               ✓

Catalog               ✗
Question Sets         ✗
Course Campaigns      ✗
Program Campaigns     ✗
Program Criteria      ✗
User Admin            ✗
```

### DEPARTMENT_MANAGER

```text
Dashboard             ✓
Progress              ✓
Reports               ✓

Catalog               ✗
Question Sets         ✗
Course Campaigns      ✗
Program Campaigns     ✗
Program Criteria      ✗
User Admin            ✗
```

Scope dữ liệu của Reports:

```text
DEPARTMENT_MANAGER
        ↓
REPORTS_ACCESS ✓
        ↓
backend lọc OrganizationUnitCode
```

Không tạo permission riêng cho việc đó.

### LECTURER

Phase 2:

```text
Dashboard ✓
```

`COURSE_CAMPAIGNS_ACCESS` chỉ bật sau khi backend hỗ trợ ownership/scope.

---

# 16. Kiến trúc cuối cùng nên chốt

Tôi khuyên chốt hẳn mô hình này:

```text
                 ┌──────────────┐
                 │     User     │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │  UserProfile │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │     Role     │
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │RolePermission│
                 └──────┬───────┘
                        ↓
                 ┌──────────────┐
                 │  Permission  │
                 └──────┬───────┘
                        ↓
              ┌─────────────────────┐
              │   Module Access     │
              └──────────┬──────────┘
                         ↓
        ┌────────────────────────────────┐
        │ Sidebar / Routing / API Fetch  │
        └────────────────┬───────────────┘
                         ↓
                     Module
                         ↓
              ┌─────────────────────┐
              │ Data Scope / Action │
              │    (future phase)  │
              └─────────────────────┘
```

**Đây là điểm tôi nghĩ nên chốt:**
**Permission = "được vào module nào".**
**Role = "được vào những module nào".**
**Scope = "trong module đó được xem dữ liệu nào".**
**Action/CRUD = "trong module đó được làm gì".**

Ba lớp này không nên trộn vào nhau.

Với hệ thống hiện tại của bạn, **Phase 2 chỉ xử lý lớp đầu tiên: Module Access**. Như vậy thiết kế sẽ đơn giản hơn rất nhiều, `RolePermissionEditor` cũng trực quan hơn, và sau này muốn bổ sung scope cho `DEPARTMENT_MANAGER`, `LECTURER`, `INSPECTOR` sẽ không phải đập lại permission model.
Đây là sơ đồ cây tôi khuyên bạn **chốt làm kiến trúc phân quyền** cho hệ thống hiện tại:

```text
HỆ THỐNG PHÂN QUYỀN
│
├── 1. USER
│   │
│   ├── User
│   │   ├── Id
│   │   ├── Email
│   │   └── ...
│   │
│   └── UserProfile
│       ├── UserId
│       ├── RoleId
│       ├── OrganizationUnitCode
│       └── ... (thông tin nghiệp vụ)
│
├── 2. ROLE
│   │
│   ├── ADMIN
│   │   │   └── Toàn quyền hệ thống
│   │   │
│   │   ├── DASHBOARD
│   │   ├── PROGRESS
│   │   ├── REPORTS
│   │   ├── CATALOG
│   │   ├── COURSE_QUESTION_SETS
│   │   ├── COURSE_CAMPAIGNS
│   │   ├── PROGRAM_CAMPAIGNS
│   │   ├── PROGRAM_CRITERIA
│   │   └── USER_ADMIN
│   │
│   ├── SURVEY_ADMIN
│   │   │   └── Vận hành khảo sát toàn trường
│   │   │
│   │   ├── DASHBOARD
│   │   ├── PROGRESS
│   │   ├── REPORTS
│   │   ├── CATALOG
│   │   ├── COURSE_QUESTION_SETS
│   │   ├── COURSE_CAMPAIGNS
│   │   ├── PROGRAM_CAMPAIGNS
│   │   └── PROGRAM_CRITERIA
│   │
│   ├── INSPECTOR
│   │   │   └── Thanh tra / giám sát độc lập
│   │   │
│   │   ├── DASHBOARD
│   │   ├── PROGRESS
│   │   └── REPORTS
│   │
│   ├── DEPARTMENT_MANAGER
│   │   │   └── Quản lý Khoa / Bộ môn
│   │   │
│   │   ├── DASHBOARD
│   │   ├── PROGRESS
│   │   └── REPORTS
│   │       └── Scope theo OrganizationUnitCode
│   │
│   ├── LECTURER
│   │   │   └── Giảng viên cơ hữu
│   │   │
│   │   └── DASHBOARD
│   │
│   └── GUEST_LECTURER
│       │   └── Giảng viên thỉnh giảng
│       │
│       └── DASHBOARD
│
├── 3. PERMISSION
│   │
│   ├── PROGRESS_ACCESS
│   │   └── Truy cập module "Tiến độ thu phiếu"
│   │
│   ├── REPORTS_ACCESS
│   │   └── Truy cập module "Thống kê & Báo cáo"
│   │
│   ├── CATALOG_ACCESS
│   │   └── Truy cập module "Danh mục đào tạo"
│   │
│   ├── COURSE_QUESTION_SETS_ACCESS
│   │   └── Truy cập module "Bộ câu hỏi khảo sát"
│   │
│   ├── COURSE_CAMPAIGNS_ACCESS
│   │   └── Truy cập module "Khảo sát học phần"
│   │
│   ├── PROGRAM_CAMPAIGNS_ACCESS
│   │   └── Truy cập module "Đợt khảo sát CTĐT"
│   │
│   ├── PROGRAM_CRITERIA_ACCESS
│   │   └── Truy cập module "Tiêu chí CTĐT"
│   │
│   └── USER_ADMIN_ACCESS
│       └── Truy cập module "Người dùng & phân quyền"
│
├── 4. ROLE_PERMISSION
│   │
│   ├── ADMIN
│   │   ├── PROGRESS_ACCESS
│   │   ├── REPORTS_ACCESS
│   │   ├── CATALOG_ACCESS
│   │   ├── COURSE_QUESTION_SETS_ACCESS
│   │   ├── COURSE_CAMPAIGNS_ACCESS
│   │   ├── PROGRAM_CAMPAIGNS_ACCESS
│   │   ├── PROGRAM_CRITERIA_ACCESS
│   │   └── USER_ADMIN_ACCESS
│   │
│   ├── SURVEY_ADMIN
│   │   ├── PROGRESS_ACCESS
│   │   ├── REPORTS_ACCESS
│   │   ├── CATALOG_ACCESS
│   │   ├── COURSE_QUESTION_SETS_ACCESS
│   │   ├── COURSE_CAMPAIGNS_ACCESS
│   │   ├── PROGRAM_CAMPAIGNS_ACCESS
│   │   └── PROGRAM_CRITERIA_ACCESS
│   │
│   ├── INSPECTOR
│   │   ├── PROGRESS_ACCESS
│   │   └── REPORTS_ACCESS
│   │
│   ├── DEPARTMENT_MANAGER
│   │   ├── PROGRESS_ACCESS
│   │   └── REPORTS_ACCESS
│   │
│   ├── LECTURER
│   │   └── (không có module nghiệp vụ ở Phase 2)
│   │
│   └── GUEST_LECTURER
│       └── (không có module nghiệp vụ ở Phase 2)
│
└── 5. MODULE
    │
    ├── TỔNG QUAN
    │   │
    │   ├── Bảng điều khiển
    │   │   └── Không cần permission
    │   │
    │   ├── Tiến độ thu phiếu
    │   │   └── PROGRESS_ACCESS
    │   │
    │   └── Thống kê & Báo cáo
    │       └── REPORTS_ACCESS
    │
    ├── DANH MỤC ĐÀO TẠO
    │   │
    │   └── CATALOG_ACCESS
    │       │
    │       ├── Khoa / Viện
    │       ├── Bộ môn
    │       ├── Giảng viên
    │       ├── Ngành đào tạo
    │       ├── Học phần
    │       └── Lớp học phần
    │
    ├── KHẢO SÁT HỌC PHẦN
    │   │
    │   ├── Bộ câu hỏi khảo sát
    │   │   └── COURSE_QUESTION_SETS_ACCESS
    │   │
    │   └── Khảo sát học phần
    │       └── COURSE_CAMPAIGNS_ACCESS
    │
    ├── KHẢO SÁT CHƯƠNG TRÌNH
    │   │
    │   ├── Đợt khảo sát CTĐT
    │   │   └── PROGRAM_CAMPAIGNS_ACCESS
    │   │
    │   └── Tiêu chí CTĐT
    │       └── PROGRAM_CRITERIA_ACCESS
    │
    └── QUẢN TRỊ
        │
        └── Người dùng & phân quyền
            └── USER_ADMIN_ACCESS
```

## Và quan trọng nhất: 4 lớp này phải tách biệt

```text
                    USER
                      │
                      ▼
                    ROLE
                      │
                      ▼
              ROLE_PERMISSION
                      │
                      ▼
                 PERMISSION
                      │
                      ▼
                   MODULE
                      │
                      ▼
              ┌───────────────┐
              │               │
              ▼               ▼
           SCOPE            ACTION
        Dữ liệu nào?       Làm gì?
```

### Ví dụ `DEPARTMENT_MANAGER`

```text
DEPARTMENT_MANAGER
        │
        ├── PROGRESS_ACCESS
        │       └── Có thể vào "Tiến độ thu phiếu"
        │
        └── REPORTS_ACCESS
                │
                └── Có thể vào "Thống kê & Báo cáo"
                        │
                        └── SCOPE
                            └── OrganizationUnitCode
                                └── Chỉ dữ liệu Khoa/Bộ môn phụ trách
```

### Ví dụ `LECTURER` sau này

```text
LECTURER
    │
    └── COURSE_CAMPAIGNS_ACCESS
            │
            └── MODULE
                └── Khảo sát học phần
                        │
                        └── SCOPE
                            └── LecturerId = CurrentUser.LecturerId
                                │
                                ├── Xem campaign của mình
                                ├── Tạo campaign cho lớp mình
                                └── Không thấy campaign người khác
```

### Ví dụ `INSPECTOR`

```text
INSPECTOR
    │
    ├── PROGRESS_ACCESS
    │
    └── REPORTS_ACCESS
            │
            └── SCOPE
                └── Toàn trường
```

---

### Chốt kiến trúc

**Permission không trả lời "được xem loại nội dung nào".**

Nó chỉ trả lời:

> **"Có được truy cập module này không?"**

Còn:

> **"Được xem dữ liệu của ai/đơn vị nào?"**

→ **Scope**

Và:

> **"Được xem, tạo, sửa, xóa hay chỉ đọc?"**

→ **Action/CRUD authorization**

Đây là kiến trúc sạch nhất cho hệ thống hiện tại, và đặc biệt tránh việc bảng `Permission` ngày càng phình ra thành hàng chục/hàng trăm permission kiểu `VIEW_REPORTS_XXX`.
