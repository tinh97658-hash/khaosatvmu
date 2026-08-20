# Cấu trúc phân quyền của hệ thống

Với hệ thống hiện tại, không cần xây dựng một cơ chế `Scope/Permission` quá phức tạp. Mô hình phù hợp hơn là tách việc phân quyền thành **hai lớp**:

1. **Phân quyền truy cập module**: xác định Role có được truy cập module/chức năng hay không.
2. **Phân quyền dữ liệu**: sau khi được phép truy cập module, dựa vào Role và thông tin nghiệp vụ của User để xác định User được xem và thao tác trên dữ liệu nào.

Có thể hình dung tổng quát:

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
Module Access
  ↓
Business Logic theo Role
  ↓
Data Scope
```

---

# 1. Luồng tổng quát

Ví dụ một User đăng nhập:

```text
Users
────────────────────
Id: 123
Email: abc@vimaru.edu.vn
```

User có thể có nhiều `UserProfile`:

```text
UserProfiles
──────────────────────────────
Id: 10
UserId: 123
RoleId: 2
ProfileName: Giảng viên
ProfileCode: LECTURER
```

Role tương ứng:

```text
Roles
────────────────
Id: 2
Code: LECTURER
Name: Giảng viên
```

Sau khi xác định được Role, hệ thống thực hiện **hai bước phân quyền**.

### Bước 1 — Kiểm tra quyền truy cập module

```text
Role
  ↓
RolePermissions
  ↓
Permissions
  ↓
Có quyền truy cập module?
```

Ví dụ:

```text
LECTURER
   ↓
COURSE_CAMPAIGNS_ACCESS
   ↓
✓ Được truy cập module "Khảo sát học phần"
```

### Bước 2 — Xác định phạm vi dữ liệu

Sau khi User được phép vào module:

```text
Role = LECTURER
        ↓
Business Logic
        ↓
Lecturer
        ↓
CourseSections
        ↓
CourseCampaigns
```

→ Chỉ lấy dữ liệu mà giảng viên đó được phép xem.

Như vậy:

> **Permission quyết định User có được vào module hay không; Role và Business Logic quyết định User được làm gì trên dữ liệu nào trong module đó.**

---

# 2. Ví dụ với Role = Lecturer

Giả sử User:

```text
User
────────────────────
Id: 123
Email: abc@vimaru.edu.vn
```

Profile:

```text
UserProfile
────────────────────
UserId: 123
RoleId: 2
ProfileName: Giảng viên
ProfileCode: LECTURER
```

Role:

```text
Role
────────────────────
Id: 2
Code: LECTURER
Name: Giảng viên
```

## Bước 1: Kiểm tra Module Permission

Ví dụ Role `LECTURER` được cấp:

```text
COURSE_CAMPAIGNS_ACCESS
COURSE_QUESTION_SETS_ACCESS
```

Khi đó User được phép truy cập:

```text
Khảo sát học phần             ✓
Bộ câu hỏi khảo sát học phần  ✓
```

Nhưng không được:

```text
Quản trị người dùng            ✗
Danh mục đào tạo               ✗
Tiến độ thu phiếu              ✗
```

---

## Bước 2: Xác định dữ liệu

Sau khi User truy cập:

```http
GET /course-campaigns
```

Backend tiếp tục xác định Role:

```text
Role == LECTURER
        ↓
Tìm Lecturer tương ứng với User
        ↓
Lấy LecturerId
        ↓
Lấy CourseSections của Lecturer
        ↓
Lấy CourseCampaigns tương ứng
```

Ví dụ:

```text
User
 │
 │ UserId
 ▼
Lecturer
 │
 ├── LecturerId
 ├── DepartmentId
 ├── FacultyId
 └── PositionId
        │
        └── CourseSections
                 │
                 └── CourseCampaigns
```

Kết quả:

> Giảng viên chỉ nhìn thấy các khảo sát học phần liên quan đến các lớp học phần mà mình phụ trách.

---

# 3. Role = Trưởng bộ môn

Giả sử:

```text
User
    ↓
UserProfile
    ↓
Role = HEAD_OF_DEPARTMENT
```

Role này cũng có:

```text
COURSE_CAMPAIGNS_ACCESS
```

nên **được phép truy cập module Khảo sát học phần**.

Tuy nhiên phạm vi dữ liệu khác với Giảng viên.

Backend có thể thực hiện:

```text
User
 ↓
Lecturer
 ↓
DepartmentId
 ↓
CourseSections thuộc Department
 ↓
CourseCampaigns
```

Ví dụ:

```text
Nguyễn Văn A

LecturerId = 100
DepartmentId = 5
FacultyId = 2
```

Department:

```text
DepartmentId = 5
DepartmentName = Kỹ thuật phần mềm
FacultyId = 2
```

Khi đó:

```text
Role = HEAD_OF_DEPARTMENT
DepartmentId = 5
```

Backend hiểu:

> Nguyễn Văn A là Trưởng bộ môn Kỹ thuật phần mềm → được thao tác trên dữ liệu thuộc Bộ môn Kỹ thuật phần mềm.

Ví dụ:

```sql
SELECT *
FROM CourseSections
WHERE DepartmentId = @departmentId;
```

---

# 4. Role = Trưởng khoa

Tương tự:

```text
User
 ↓
UserProfile
 ↓
Role = DEAN
 ↓
Lecturer
 ↓
FacultyId
```

Sau đó lấy dữ liệu thuộc Faculty:

```sql
SELECT *
FROM CourseSections
WHERE FacultyId = @facultyId;
```

Hoặc nếu cần lấy các Department thuộc Faculty:

```sql
SELECT *
FROM Departments
WHERE FacultyId = @facultyId;
```

Như vậy:

```text
LECTURER
    → LecturerId
    → Dữ liệu của chính mình

HEAD_OF_DEPARTMENT
    → DepartmentId
    → Dữ liệu của Department

DEAN
    → FacultyId
    → Dữ liệu của Faculty

ADMIN
    → Toàn bộ dữ liệu
```

---

# 5. `Permission` trong hệ thống này có vai trò gì?

`Permission` **không đại diện cho quyền CRUD chi tiết trên dữ liệu**.

Permission của hệ thống hiện tại nên được hiểu là:

> **Quyền truy cập một module/chức năng của hệ thống.**

Ví dụ:

```text
COURSE_QUESTION_SETS_ACCESS
PROGRAM_CAMPAIGNS_ACCESS
PROGRESS_ACCESS
CATALOG_ACCESS
USER_ADMIN_ACCESS
COURSE_CAMPAIGNS_ACCESS
PROGRAM_CRITERIA_ACCESS
REPORTS_ACCESS
```

Có thể phân nhóm:

```text
Khảo sát học phần
    ├── COURSE_QUESTION_SETS_ACCESS
    └── COURSE_CAMPAIGNS_ACCESS

Khảo sát chương trình
    ├── PROGRAM_CAMPAIGNS_ACCESS
    └── PROGRAM_CRITERIA_ACCESS

Tổng quan
    └── PROGRESS_ACCESS

Danh mục đào tạo
    └── CATALOG_ACCESS

Quản trị hệ thống
    └── USER_ADMIN_ACCESS

Báo cáo
    └── REPORTS_ACCESS
```

---

# 6. `RolePermission`

`RolePermission` là bảng trung gian xác định:

> **Role nào được truy cập module nào.**

Ví dụ:

```text
LECTURER
    │
    ├── COURSE_CAMPAIGNS_ACCESS
    └── COURSE_QUESTION_SETS_ACCESS
```

```text
HEAD_OF_DEPARTMENT
    │
    ├── COURSE_CAMPAIGNS_ACCESS
    ├── COURSE_QUESTION_SETS_ACCESS
    ├── PROGRESS_ACCESS
    └── REPORTS_ACCESS
```

```text
DEAN
    │
    ├── COURSE_CAMPAIGNS_ACCESS
    ├── PROGRAM_CAMPAIGNS_ACCESS
    ├── PROGRESS_ACCESS
    └── REPORTS_ACCESS
```

```text
ADMIN
    │
    └── Các Permission cần thiết của hệ thống
```

Do đó:

```text
Role
  ↓
RolePermission
  ↓
Permission
  ↓
Module
```

chỉ trả lời:

> **Có được truy cập module này không?**

Không trả lời:

> **Được xem dữ liệu nào trong module?**

---

# 7. Hai lớp phân quyền cần được tách biệt

Đây là nguyên tắc quan trọng nhất của hệ thống.

## Lớp 1 — Module Authorization

```text
Role
 ↓
RolePermission
 ↓
Permission
 ↓
Module
```

Trả lời:

> User có được truy cập module này không?

Ví dụ:

```text
LECTURER
   ↓
COURSE_CAMPAIGNS_ACCESS
   ↓
✓ Có thể vào module Khảo sát học phần
```

---

## Lớp 2 — Data Authorization

```text
Role
 ↓
Business Logic
 ↓
Organization / Lecturer
 ↓
Data
```

Trả lời:

> Sau khi vào module, User được xem và thao tác trên dữ liệu nào?

Ví dụ:

```text
LECTURER
    ↓
LecturerId
    ↓
CourseSections của Lecturer
```

Trong khi:

```text
HEAD_OF_DEPARTMENT
    ↓
DepartmentId
    ↓
CourseSections của Department
```

Và:

```text
DEAN
    ↓
FacultyId
    ↓
CourseSections của Faculty
```

Hai lớp này **không nên gộp vào cùng một cơ chế**.

---

# 8. Không nên viết Role Check trực tiếp khắp Controller

Về mặt ý tưởng, có thể viết:

```csharp
if (role == "LECTURER")
{
    // Lấy dữ liệu giảng viên
}
else if (role == "HEAD_OF_DEPARTMENT")
{
    // Lấy dữ liệu bộ môn
}
else if (role == "DEAN")
{
    // Lấy dữ liệu khoa
}
else if (role == "ADMIN")
{
    // Lấy toàn bộ dữ liệu
}
```

Nhưng không nên lặp cách này ở mọi Controller.

Nên tổ chức:

```text
Controller
    ↓
Service
    ↓
Role-specific Business Logic
    ↓
Repository / Query
```

Ví dụ:

```csharp
public async Task<IEnumerable<CourseSection>> GetCourseSections(
    UserContext user)
{
    switch (user.RoleCode)
    {
        case "LECTURER":
            return await GetLecturerCourseSections(user);

        case "HEAD_OF_DEPARTMENT":
            return await GetDepartmentCourseSections(user);

        case "DEAN":
            return await GetFacultyCourseSections(user);

        case "ADMIN":
            return await GetAllCourseSections(user);

        default:
            throw new UnauthorizedAccessException();
    }
}
```

Như vậy Controller không cần biết chi tiết về Lecturer, Department hay Faculty.

---

# 9. Cấu trúc database tổng thể

Có thể hình dung:

```text
                         ┌──────────────┐
                         │ Permissions  │
                         │              │
                         │ MODULE_ACCESS│
                         └──────▲───────┘
                                │
                                │
                         ┌──────┴───────┐
                         │RolePermissions│
                         └──────▲───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Roles     │
                         └──────▲───────┘
                                │
                                │
┌──────────┐              ┌─────┴──────┐
│  Users   │─────────────►│UserProfiles│
└────┬─────┘              └─────┬──────┘
     │                          │
     │                          └── RoleId
     │
     │ UserId
     ▼
┌──────────────┐
│  Lecturers   │
└──────┬───────┘
       │
       ├──────────────► Positions
       │
       ├──────────────► Departments
       │                      │
       │                      ▼
       │                  Faculties
       │
       └──────────────► CourseSections
                              │
                              ▼
                       CourseCampaigns
```

---

# 10. Luồng request hoàn chỉnh

Ví dụ:

```http
GET /api/course-campaigns
```

Backend xử lý:

```text
JWT
 ↓
UserId
 ↓
User
 ↓
Active UserProfile
 ↓
Role
 ↓
RolePermission
 ↓
Permission
 ↓
COURSE_CAMPAIGNS_ACCESS?
```

Nếu **không có Permission**:

```text
403 Forbidden
```

Nếu **có Permission**:

```text
        ↓
Business Logic
        ↓
Kiểm tra Role
        ↓
┌───────────────┬────────────────────┐
│ LECTURER      │ Lecturer.UserId    │
│               │ → dữ liệu của mình │
├───────────────┼────────────────────┤
│ HEAD_DEPT     │ DepartmentId       │
│               │ → dữ liệu bộ môn   │
├───────────────┼────────────────────┤
│ DEAN          │ FacultyId          │
│               │ → dữ liệu khoa     │
├───────────────┼────────────────────┤
│ ADMIN         │ Không giới hạn     │
└───────────────┴────────────────────┘
        ↓
Query Database
        ↓
Return Data
```

---

# 11. Không nên dùng Email làm khóa liên kết lâu dài

Trong thiết kế hiện tại nếu đang có:

```text
Users.Email
      ↕
Lecturers.Email
```

thì cách này **có thể chạy**, nhưng không nên dùng Email làm khóa liên kết chính.

Nên chuyển thành:

```text
Users
────────────────
Id PK
Email
...
```

và:

```text
Lecturers
────────────────
LecturerId PK
UserId FK UNIQUE
DepartmentId FK
FacultyId FK
PositionId FK
...
```

Quan hệ:

```text
Users.Id
   │
   │ 1
   │
   │ 0..1
   ▼
Lecturers.UserId
```

Ví dụ:

```sql
SELECT cs.*
FROM CourseSections cs
JOIN Lecturers l
    ON cs.LecturerId = l.LecturerId
WHERE l.UserId = @userId;
```

Thay vì:

```sql
JOIN Lecturers l
    ON u.Email = l.Email
```

### Lý do

Email có thể thay đổi:

```text
abc@vimaru.edu.vn
        ↓
newemail@vimaru.edu.vn
```

Trong khi:

```text
UserId = 123
```

không thay đổi.

Vì vậy:

> **Email nên được coi là thuộc tính nhận dạng/đăng nhập, không nên là khóa quan hệ giữa các bảng nghiệp vụ.**

---

# 12. Mô hình một User có nhiều chức vụ

Cấu trúc này cũng giải quyết bài toán một người có nhiều chức vụ.

Ví dụ:

```text
Users

Id = 123
Email = abc@vimaru.edu.vn
```

Có:

```text
UserProfiles

UserId | Role
-------|--------------------
123    | LECTURER
123    | HEAD_OF_DEPARTMENT
```

Khi User chọn Profile:

```text
ProfileId = 10
Role = LECTURER
```

thì:

```text
UserId
   ↓
Lecturer.UserId
   ↓
LecturerId
   ↓
CourseSections
```

Nếu User chuyển sang:

```text
ProfileId = 11
Role = HEAD_OF_DEPARTMENT
```

thì:

```text
UserId
   ↓
Lecturer.UserId
   ↓
DepartmentId
   ↓
Dữ liệu của Department
```

Điểm quan trọng:

> **Không tạo User mới cho mỗi chức vụ.**

Một người chỉ có **một User**, nhưng có thể có **nhiều UserProfile**.

---

# 13. Mô hình cuối cùng

Có thể cô đọng toàn bộ cơ chế thành:

```text
                    AUTHENTICATION
                         │
                         ▼
                       User
                         │
                         ▼
                    UserProfile
                         │
                         ▼
                       Role
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       RolePermission          Business Logic
              │                     │
              ▼                     ▼
          Permission          Lecturer / Department
              │                / Faculty / ...
              ▼                     │
        Module Access               ▼
                               Data Scope
```

Hay đơn giản hơn:

```text
User
 ↓
UserProfile
 ↓
Role
 ├──────────────► Permission
 │                    ↓
 │              Module Access
 │
 └──────────────► Business Logic
                       ↓
                   Data Scope
```

### Nguyên tắc cốt lõi

> **Role xác định User đang đóng vai trò gì.**

> **Permission xác định Role được truy cập module nào.**

> **Business Logic xác định Role được xem/thao tác dữ liệu nào trong module đó.**

Ví dụ:

```text
Nguyễn Văn A
      ↓
Profile: Giảng viên
      ↓
Role: LECTURER
      │
      ├── Permission:
      │      COURSE_CAMPAIGNS_ACCESS ✓
      │
      │      → Được vào module Khảo sát học phần
      │
      └── Business Logic:
             Lecturer.UserId = User.Id
                    ↓
             CourseSections
                    ↓
             CourseCampaigns
                    ↓
             Chỉ dữ liệu của A
```

Đây là mô hình **đủ đơn giản để triển khai**, nhưng vẫn tách biệt rõ **authentication → module authorization → business/data authorization**, và phù hợp với cấu trúc `Users`, `UserProfiles`, `Roles`, `Permissions`, `RolePermissions` cùng các bảng nghiệp vụ như `Lecturers`, `Departments`, `Faculties`, `CourseSections` của hệ thống bạn.:::
