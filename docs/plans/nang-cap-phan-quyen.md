# Nâng cấp Phân Quyền theo kiểu Discord

## ⛔ Yêu cầu bắt buộc trước khi triển khai

> [!CAUTION]
> **Phải hoàn thành bước này trước khi chạm vào bất kỳ file nào trong dự án.**
> Bỏ qua bước này sẽ dẫn đến code không nhất quán với design system và convention của project.

### Đọc và tuân thủ Rules của project

**File phải đọc thực tế trước khi bắt đầu:**

- [`.rulesforai`](file:///d:/project1/khaosatvmu/rules/.rulesforai) — Rules chính thức của project

> [!IMPORTANT]
> **Không được bắt đầu implementation chỉ dựa trên phần tóm tắt Rules trong plan này.** Phải mở và đọc toàn bộ file `.rulesforai` trước. Nếu `.rulesforai` tham chiếu tới Rules/Skills/Guidelines khác, phải tiếp tục đọc các tài liệu được tham chiếu nếu chúng áp dụng cho task này.

**Các nhóm rule trọng yếu trong task này (tóm tắt để tham chiếu nhanh — không thay thế việc đọc file gốc):**

| Nhóm | Điểm cốt lõi |
|---|---|
| **Ponytail Decision Ladder** | Reuse trước (component/type/CSS đã có), chỉ thêm mới khi thực sự cần |
| **Frontend Stack** | Kiểm tra `package.json` trước khi dùng thư viện; reuse CSS variables, components, types |
| **Visual Direction** | Institutional: trắng/xám nhạt, border mỏng, **không gradient/glass/shadow nặng**; primary `#0788B8`; **border-radius `0–4px`** (pill chỉ cho count/status/toggle) |
| **Density & Hierarchy** | Spacing scale `4/8/12/16/24px`; body/table text `12–14px` |
| **Controls & Forms** | Toggle/checkbox cho binary; icon button `32–36px`; **keyboard-accessible (Tab → focus, Space → toggle)** |
| **Interaction States** | Phải có đầy đủ: loading, success, empty, **error, retry** — mọi async view |
| **Accessibility** | Semantic HTML; keyboard nav; WCAG AA contrast; focus visible `2px outline` |
| **Frontend Engineering** | CSS variables; **không `any` (dùng `unknown` + error narrowing)**; không inline style lặp; API qua typed service |
| **Safety Rules** | DB changes qua EF migrations; không raw SQL trong `Program.cs`; không edit file ngoài scope |
| **Required Verification** | Build + lint; inspect desktop + mobile; check browser console |

**Checklist trước khi bắt tay code:**
- [ ] Đã đọc toàn bộ `.rulesforai` (file gốc, không phải bảng tóm tắt trên)
- [ ] Đã kiểm tra CSS variables trong `index.css` / `auth-admin.css`
- [ ] Đã kiểm tra component có sẵn (`Modal`, icons Lucide) trước khi tạo mới
- [ ] Đã kiểm tra types trong `types/index.ts` trước khi thêm type mới
- [ ] Đã search toàn project tất cả call sites của `PermissionDto` và `RolePermissionStatusDto` (xem Bước 5)
- [ ] Đã xác nhận PUT endpoint contract hiện tại (`PUT /api/admin/roles/{roleId}/permissions`) (xem Precondition Bước 10)

---

## Schema thực tế từ DB đang chạy

> [!NOTE]
> Dữ liệu dưới đây được query trực tiếp từ container `khaosatvmu_db` (PostgreSQL 15-alpine, port 5432), không dựa vào tài liệu hay code.

### Bảng `Permissions` — cột hiện tại

| Cột | Kiểu | Nullable | Ghi chú |
|---|---|---|---|
| `Id` | `uuid` | NOT NULL | PK |
| `Code` | `varchar(150)` | NOT NULL | UNIQUE index |
| `Name` | `varchar(200)` | NOT NULL | |
| `Description` | `varchar(1000)` | NULL | |

**Không có cột `Category`** — đây là điểm cần thêm.

**Indexes hiện có**: `PK_Permissions("Id")` + `IX_Permissions_Code("Code" UNIQUE)`

### Bảng `Roles` — dữ liệu hiện có

| Code | Name | IsSystem | IsDeleted |
|---|---|---|---|
| `ADMIN` | Administrator | ✅ | ❌ |
| `DEPARTMENT_MANAGER` | Department manager | ✅ | ❌ |
| `LECTURER` | Lecturer | ✅ | ❌ |
| `SURVEY_ADMIN` | Survey administrator | ✅ | ❌ |

### Bảng `Permissions` — dữ liệu hiện có (7 records)

| Code | Name |
|---|---|
| `ADMIN_ACCESS` | Admin access |
| `SURVEY_MANAGE` | Manage surveys |
| `VIEW_REPORTS` | View reports |
| `VIEW_REPORTS_FACULTIES` | View faculty statistics |
| `VIEW_REPORTS_LECTURERS` | View lecturer evaluations |
| `VIEW_REPORTS_OPERATIONAL` | View operational progress |
| `VIEW_REPORTS_QUESTIONS` | View question analysis |

### Bảng `RolePermissions` — phân quyền hiện tại (16 records)

| Role | Permissions được cấp |
|---|---|
| `ADMIN` | Tất cả 7 permissions |
| `DEPARTMENT_MANAGER` | `VIEW_REPORTS`, `VIEW_REPORTS_FACULTIES`, `VIEW_REPORTS_LECTURERS` |
| `LECTURER` | **Không có permission nào** |
| `SURVEY_ADMIN` | 6/7 — tất cả trừ `ADMIN_ACCESS` |

### Migration history

Migration cuối: `20260817165014_AddSoftDeleteAndChangeAuditLog` (EF Core `9.0.10`)

---

## Bối cảnh kiến trúc phân quyền (đã xác nhận đúng, không thay đổi)

> [!NOTE]
> Domain hiện tại (`AuthModels.cs`) đã đúng theo mô hình dưới đây. Task này **chỉ chạm vào `Permission.Category`**, không sửa `UserProfile`/`Role`/authorization flow.

```
User (Google Auth)
 └── UserProfile (N profile / user — mỗi profile là một "ngữ cảnh làm việc")
        │  RoleId, ProfileName, OrganizationUnitCode...
        ▼
      Role  (ADMIN / LECTURER / DEPARTMENT_MANAGER / SURVEY_ADMIN)
        ▼
   RolePermission (RoleId, PermissionId, IsGranted)
        ▼
     Permission (Code, Name, Description, Category ← task này thêm)
```

- **`UserProfile` = ngữ cảnh làm việc** (một user có thể có nhiều profile, mỗi profile gắn 1 `Role`). `AuthSession.ActiveProfileId` xác định profile đang hoạt động.
- **Authorization luôn đi qua `Active UserProfile → Role → RolePermission → Permission`** — đã được `PermissionAuthorizationHandler` (`API/Auth/PermissionAuth.cs`) implement đúng, task này **không đổi logic đó**.
- **`Category` không phải là một tầng phân quyền.** Nó chỉ là *grouping metadata* của `Permission`, phục vụ hiển thị UI (nhóm theo module trong màn "Phân quyền kiểu Discord"). Nó không tham gia vào quyết định "được phép làm gì" — quyết định đó vẫn chỉ dựa trên `RolePermission.IsGranted`.
- **Không tạo bảng `PermissionCategories` riêng** ở giai đoạn này: `Category` chưa có behavior/data riêng (không cần `SortOrder`, `Icon`, `IsEnabled`, CRUD riêng...). Tách bảng chỉ hợp lý khi `Category` (hoặc khái niệm `Module` sau này) có nhu cầu quản trị độc lập — hiện tại 7 permissions / 3 nhóm cố định thì thêm bảng là over-engineering.

---

## Quyết định đã chốt

- ✅ **Grouping**: Thêm cột `Category varchar(100) NOT NULL` trực tiếp vào bảng `Permissions` (không tách bảng `PermissionCategories`) — EF migration tự populate ngay trong `Up()`, không phụ thuộc Seeder/restart.
- ✅ **Category Order**: Sử dụng dictionary ordering cố định ở Backend (`Quản trị hệ thống` = 1, `Khảo sát` = 2, `Báo cáo` = 3, Các nhóm mới = 99). Đảm bảo thứ tự hiển thị UI cố định chuẩn xác mà không cần mở rộng schema thêm cột `SortOrder`.
- ✅ **CRUD Role**: Không — màn này chỉ edit permissions của 4 roles hiện có.
- ✅ **Phạm vi task**: Chỉ sửa `Permission` (thêm `Category`) + UI hiển thị theo nhóm. Không đụng đến `UserProfile`, `Role`, authorization handler, hay thêm khái niệm `Module`/scope theo `Department`/`Faculty` — đó là hướng phát triển dài hạn, ngoài phạm vi plan này.

**Mapping & Sort Order cho Category:**

| Code | Category | Order Weight |
|---|---|---|
| `ADMIN_ACCESS` | Quản trị hệ thống | 1 |
| `SURVEY_MANAGE` | Khảo sát | 2 |
| `VIEW_REPORTS` | Báo cáo | 3 |
| `VIEW_REPORTS_FACULTIES` | Báo cáo | 3 |
| `VIEW_REPORTS_LECTURERS` | Báo cáo | 3 |
| `VIEW_REPORTS_OPERATIONAL` | Báo cáo | 3 |
| `VIEW_REPORTS_QUESTIONS` | Báo cáo | 3 |
| *Category mới bất kỳ* | *Tên bất kỳ* | 99 (sắp xếp theo Name qua `ThenBy(x => x.Name)`) |

---

## Proposed Changes

### Bước 1 – Domain Model

#### [MODIFY] [AuthModels.cs](file:///d:/project1/khaosatvmu/src/Backend/Domain/AuthModels.cs)

Class `Permission` hiện có 4 property (`Id`, `Code`, `Name`, `Description`). Thêm `Category`:

```diff
 public sealed class Permission
 {
     public Guid Id { get; set; }
     public string Code { get; set; } = string.Empty;
     public string Name { get; set; } = string.Empty;
     public string? Description { get; set; }
+    /// <summary>Nhóm module hiển thị trong màn phân quyền. Ví dụ: "Quản trị hệ thống", "Khảo sát", "Báo cáo".</summary>
+    public string Category { get; set; } = string.Empty;
 }
```

---

### Bước 2 – AppDbContext

#### [MODIFY] [AppDbContext.cs](file:///d:/project1/khaosatvmu/src/Backend/Infrastructure/Persistence/AppDbContext.cs)

Block `modelBuilder.Entity<Permission>` hiện ở dòng 91–99:

```diff
 modelBuilder.Entity<Permission>(entity =>
 {
     entity.ToTable("Permissions");
     entity.HasKey(x => x.Id);
     entity.Property(x => x.Code).HasMaxLength(150).IsRequired();
     entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
     entity.Property(x => x.Description).HasMaxLength(1000);
+    entity.Property(x => x.Category).HasMaxLength(100).IsRequired();
     entity.HasIndex(x => x.Code).IsUnique();
 });
```

> [!NOTE]
> Không thêm index cho `Category` — 7 permissions, sequential scan đủ nhanh.

---

### Bước 3 – EF Migration

Chạy lệnh:

```powershell
dotnet ef migrations add AddPermissionCategory `
  --project src/Backend/Infrastructure `
  --startup-project src/Backend/API `
  --output-dir Persistence/Migrations
```

**Sau khi EF tự sinh migration, chỉnh sửa thêm `migrationBuilder.Sql(...)` vào phần `Up()`** để populate Category ngay trong migration:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>(
        name: "Category",
        table: "Permissions",
        type: "character varying(100)",
        maxLength: 100,
        nullable: false,
        defaultValue: "");  // defaultValue: "" bắt buộc vì DB đã có 7 rows

    // Populate Category ngay trong migration — DB luôn ở trạng thái chuẩn sau khi migrate
    migrationBuilder.Sql("""
        UPDATE "Permissions"
        SET "Category" = CASE "Code"
            WHEN 'ADMIN_ACCESS'             THEN 'Quản trị hệ thống'
            WHEN 'SURVEY_MANAGE'            THEN 'Khảo sát'
            WHEN 'VIEW_REPORTS'             THEN 'Báo cáo'
            WHEN 'VIEW_REPORTS_OPERATIONAL' THEN 'Báo cáo'
            WHEN 'VIEW_REPORTS_LECTURERS'   THEN 'Báo cáo'
            WHEN 'VIEW_REPORTS_FACULTIES'   THEN 'Báo cáo'
            WHEN 'VIEW_REPORTS_QUESTIONS'   THEN 'Báo cáo'
            ELSE ''
        END
    """);
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropColumn(name: "Category", table: "Permissions");
}
```

> [!IMPORTANT]
> Migration tự populate để DB **không bao giờ ở trạng thái tạm thời sai** (Category = "") sau khi migrate, dù server chưa restart hay Seeder chưa chạy.

---

### Bước 4 – Seed Data

#### [MODIFY] [DatabaseSeeder.cs](file:///d:/project1/khaosatvmu/src/Backend/Infrastructure/Persistence/DatabaseSeeder.cs)

Thêm `Category` vào tuple definitions của `EnsurePermissionsAsync`.

> [!NOTE]
> **Vai trò của Seeder**: `Category` của existing permissions được quản lý và bảo toàn bởi EF Migration; `DatabaseSeeder` chịu trách nhiệm gán `Category` cho các permission mới được thêm trong tương lai.

```diff
 var definitions = new[]
 {
-    (Code: "ADMIN_ACCESS",             Name: "Admin access",              Description: "Access administrative actions"),
-    (Code: "SURVEY_MANAGE",            Name: "Manage surveys",            Description: "Create and manage surveys"),
-    (Code: "VIEW_REPORTS",             Name: "View reports",              Description: "Access the reports and statistics section"),
-    (Code: "VIEW_REPORTS_OPERATIONAL", Name: "View operational progress", Description: "View operational survey collection progress report"),
-    (Code: "VIEW_REPORTS_LECTURERS",   Name: "View lecturer evaluations", Description: "View lecturer performance evaluation reports"),
-    (Code: "VIEW_REPORTS_FACULTIES",   Name: "View faculty statistics",   Description: "View faculty and department statistics reports"),
-    (Code: "VIEW_REPORTS_QUESTIONS",   Name: "View question analysis",    Description: "View survey question and criteria analysis reports"),
+    (Code: "ADMIN_ACCESS",             Name: "Admin access",              Description: "Access administrative actions",                            Category: "Quản trị hệ thống"),
+    (Code: "SURVEY_MANAGE",            Name: "Manage surveys",            Description: "Create and manage surveys",                               Category: "Khảo sát"),
+    (Code: "VIEW_REPORTS",             Name: "View reports",              Description: "Access the reports and statistics section",               Category: "Báo cáo"),
+    (Code: "VIEW_REPORTS_OPERATIONAL", Name: "View operational progress", Description: "View operational survey collection progress report",      Category: "Báo cáo"),
+    (Code: "VIEW_REPORTS_LECTURERS",   Name: "View lecturer evaluations", Description: "View lecturer performance evaluation reports",            Category: "Báo cáo"),
+    (Code: "VIEW_REPORTS_FACULTIES",   Name: "View faculty statistics",   Description: "View faculty and department statistics reports",          Category: "Báo cáo"),
+    (Code: "VIEW_REPORTS_QUESTIONS",   Name: "View question analysis",    Description: "View survey question and criteria analysis reports",      Category: "Báo cáo"),
 };
```

Trong vòng lặp upsert: gán `Category` khi insert mới:

```diff
 if (permission is null)
 {
     permission = new Permission
     {
         Id = Guid.NewGuid(),
         Code = definition.Code,
         Name = definition.Name,
         Description = definition.Description,
+        Category = definition.Category,
     };
     db.Permissions.Add(permission);
 }
```

---

### Bước 5 – Application Contracts

> [!IMPORTANT]
> **Trước khi sửa file này**, search toàn bộ project (Backend + Frontend) tất cả nơi khởi tạo `RolePermissionStatusDto` và `PermissionDto`, cập nhật tất cả call sites. Dùng lệnh:
> ```powershell
> grep -rn "RolePermissionStatusDto\|PermissionDto" src/Backend --include="*.cs"
> ```

#### [MODIFY] [UserAdministrationContracts.cs](file:///d:/project1/khaosatvmu/src/Backend/Application/UserAdministration/UserAdministrationContracts.cs)

**1. Cập nhật `PermissionDto`** (thêm `Category`):
```diff
 public sealed record PermissionDto(
     Guid Id,
     string Code,
     string Name,
-    string? Description);
+    string? Description,
+    string Category);
```

**2. Cập nhật `RolePermissionStatusDto`** (thêm `Category`):
```diff
 public sealed record RolePermissionStatusDto(
     Guid PermissionId,
     string PermissionCode,
     string PermissionName,
-    bool IsGranted);
+    string Category,
+    bool IsGranted);
```

**3. Thêm method mới vào `IUserAdministrationService`**:
```diff
 Task<IReadOnlyList<RolePermissionMatrixDto>> GetRolePermissionMatrixAsync(CancellationToken cancellationToken = default);
+
+/// <summary>Lấy permissions của một role cụ thể. Trả về null nếu roleId không tồn tại.</summary>
+Task<RolePermissionMatrixDto?> GetRolePermissionsAsync(
+    Guid roleId,
+    CancellationToken cancellationToken = default);
```

---

### Bước 6 – Infrastructure Service

#### [MODIFY] [EfUserAdministrationService.cs](file:///d:/project1/khaosatvmu/src/Backend/Infrastructure/UserAdministration/EfUserAdministrationService.cs)

**Dùng Category Order Dictionary cố định** để sort thứ tự hiển thị cố định: `Quản trị hệ thống` (1) → `Khảo sát` (2) → `Báo cáo` (3) → Các nhóm mới phát sinh (99, tự động sắp xếp theo Name qua `ThenBy(x => x.Name)`):

```csharp
private static readonly Dictionary<string, int> CategoryOrderMap = new(StringComparer.OrdinalIgnoreCase)
{
    ["Quản trị hệ thống"] = 1,
    ["Khảo sát"] = 2,
    ["Báo cáo"] = 3
};

private static int GetCategoryOrder(string category) =>
    CategoryOrderMap.TryGetValue(category, out var order) ? order : 99;
```

**Thay đổi 1** — `GetPermissionsAsync` (~dòng 384), thêm `Category` vào projection:
```diff
-.Select(x => new PermissionDto(x.Id, x.Code, x.Name, x.Description))
+.Select(x => new PermissionDto(x.Id, x.Code, x.Name, x.Description, x.Category))
```

**Thay đổi 2** — `GetRolePermissionMatrixAsync` (~dòng 394–419):
```csharp
var allPermissions = (await db.Permissions
    .AsNoTracking()
    .ToListAsync(cancellationToken))
    .OrderBy(x => GetCategoryOrder(x.Category))
    .ThenBy(x => x.Name)
    .ToList();

return roles.Select(role => new RolePermissionMatrixDto(
    role.Id,
    role.Code,
    role.Name,
    allPermissions.Select(permission => new RolePermissionStatusDto(
        permission.Id,
        permission.Code,
        permission.Name,
        permission.Category,
        grantedSet.Contains((role.Id, permission.Id))
    )).ToList()
)).ToList();
```

**Thay đổi 3** — Implement `GetRolePermissionsAsync`:
```csharp
public async Task<RolePermissionMatrixDto?> GetRolePermissionsAsync(
    Guid roleId,
    CancellationToken cancellationToken = default)
{
    var role = await db.Roles
        .AsNoTracking()
        .SingleOrDefaultAsync(x => x.Id == roleId, cancellationToken);

    if (role is null) return null;

    var allPermissions = (await db.Permissions
        .AsNoTracking()
        .ToListAsync(cancellationToken))
        .OrderBy(x => GetCategoryOrder(x.Category))
        .ThenBy(x => x.Name)
        .ToList();

    var grantedIds = await db.RolePermissions
        .AsNoTracking()
        .Where(x => x.RoleId == roleId && x.IsGranted)
        .Select(x => x.PermissionId)
        .ToHashSetAsync(cancellationToken);

    return new RolePermissionMatrixDto(
        role.Id,
        role.Code,
        role.Name,
        allPermissions
            .Select(p => new RolePermissionStatusDto(
                p.Id, p.Code, p.Name, p.Category,
                grantedIds.Contains(p.Id)))
            .ToList()
    );
}
```

---

### Bước 7 – API Endpoint

#### [MODIFY] [UserAdministrationEndpoints.cs](file:///d:/project1/khaosatvmu/src/Backend/API/UserAdministration/UserAdministrationEndpoints.cs)

Thêm route sau `group.MapGet("/role-permissions", ...)`:

```csharp
group.MapGet("/roles/{roleId:guid}/permissions", async (
    Guid roleId,
    IUserAdministrationService service,
    CancellationToken cancellationToken) =>
{
    var result = await service.GetRolePermissionsAsync(roleId, cancellationToken);
    return result is null ? Results.NotFound() : Results.Ok(result);
});
```

---

### Bước 8 – Frontend Types

#### [MODIFY] [index.ts](file:///d:/project1/khaosatvmu/src/Frontend/src/types/index.ts)

```diff
 export interface PermissionDto {
   id: string;
   code: string;
   name: string;
   description: string | null;
+  category: string;
 }

 export interface RolePermissionStatus {
   permissionId: string;
   permissionCode: string;
   permissionName: string;
+  category: string;
   isGranted: boolean;
 }
```

---

### Bước 9 – Frontend API Service

#### [MODIFY] [adminApi.ts](file:///d:/project1/khaosatvmu/src/Frontend/src/services/adminApi.ts)

```diff
   rolePermissions: () =>
     apiRequest<RolePermissionMatrix[]>('/api/admin/role-permissions'),
+  rolePermissionsByRoleId: (roleId: string) =>
+    apiRequest<RolePermissionMatrix>(`/api/admin/roles/${roleId}/permissions`),
```

---

### Bước 10 – Component `RolePermissionEditor`

> [!IMPORTANT]
> **Precondition**: Xác nhận PUT contract hiện tại trong `adminApi.ts` (`updateRolePermissions(roleId, grants)`) gửi payload `{ grants: [{ permissionId, isGranted }] }` phù hợp với Backend `UpdateRolePermissionsRequest`. Không tạo contract shape mới.

#### [NEW] `src/components/RolePermissionEditor.tsx`

**Props:**
```typescript
interface RolePermissionEditorProps {
  roles: AdminRole[];
}
```

**State nội bộ:**

| State | Type | Khởi tạo | Mô tả |
|---|---|---|---|
| `selectedRoleId` | `string \| null` | `roles[0]?.id \|\| null` | Role đang hiển thị |
| `roleData` | `RolePermissionMatrix \| null` | `null` | Permissions đã fetch |
| `dirtyMap` | `Record<string, boolean>` | `{}` | Toggle chưa lưu |
| `loadingRole` | `boolean` | `false` | Skeleton khi fetch role mới |
| `saving` | `boolean` | `false` | Đang gọi PUT |
| `fetchError` | `string \| null` | `null` | Lỗi khi fetch permissions |
| `saveError` | `string \| null` | `null` | Lỗi khi save — **giữ dirtyMap nguyên** |
| `pendingRoleId` | `string \| null` | `null` | Role chờ switch khi có dirty |
| `searchQuery` | `string` | `''` | Filter text |

**Chống Race Condition / Out-of-Order Fetch Response:**
Dùng `activeRequestIdRef` (counter useRef) để bỏ qua response cũ nếu user click chuyển role liên tục. Tuân thủ nghiêm ngặt **ngăn cấm `any`**, sử dụng `unknown` + error narrowing:
```typescript
const requestIdRef = useRef(0);

const fetchRolePermissions = async (roleId: string) => {
  const currentReqId = ++requestIdRef.current;
  setLoadingRole(true);
  setFetchError(null);
  try {
    const data = await adminApi.rolePermissionsByRoleId(roleId);
    if (currentReqId !== requestIdRef.current) return; // Stale request, ignore
    setRoleData(data);
  } catch (err: unknown) {
    if (currentReqId !== requestIdRef.current) return;
    const message = err instanceof Error ? err.message : 'Không thể tải danh sách quyền';
    setFetchError(message);
  } finally {
    if (currentReqId === requestIdRef.current) setLoadingRole(false);
  }
};
```

**Quy định chặt chẽ về Flow "Lưu & chuyển" (Save & Switch):**

```
Click Role B (khi đang ở Role A có dirtyMap)
          ↓
  Hiện Modal Xác Nhận ([Lưu & chuyển] / [Bỏ qua thay đổi] / [Hủy])
          ↓
  User chọn "Lưu & chuyển"
          ↓
  Gọi API PUT /api/admin/roles/RoleA/permissions
          ↓
   ┌──────┴──────┐
Success        Fail
   ↓             ↓
- Clear dirty  - KHÔNG SWITCH ROLE (giữ nguyên Role A)
- Close Modal  - GIỮ NGUYÊN dirtyMap
- Switch Role B- Hiện inline saveError & nút [Thử lại]
- Fetch Role B - Giữ modal/panel ở Role A
```

---

### Bước 11 – CSS

#### [MODIFY] [auth-admin.css](file:///d:/project1/khaosatvmu/src/Frontend/src/styles/auth-admin.css)

> [!IMPORTANT]
> Reuse token CSS có sẵn (`--ops-primary`, `--ops-border`, `--ops-muted`). `border-radius: 4px` trên `.perm-role-item`.

| Class | Spec | Ghi chú |
|---|---|---|
| `.perm-editor` | `display: flex; height: calc(100vh - 220px); min-height: 500px` | |
| `.perm-sidebar` | `width: 240px; flex-shrink: 0; border-right: 1px solid var(--ops-border); overflow-y: auto; padding: 8px` | |
| `.perm-role-item` | `padding: 8px 12px; border-radius: 4px; cursor: pointer; transition: background 150ms` | **4px** |
| `.perm-toggle input` | `position: absolute; opacity: 0; width: 1px; height: 1px; margin: -1px; clip: rect(0,0,0,0)` | **Visually hidden** |
| `.perm-toggle input:focus-visible + label .perm-toggle-track` | `outline: 2px solid var(--ops-primary); outline-offset: 2px` | **Focus visible** — WCAG AA |
| `.perm-skeleton-row` | `height: 48px; background: var(--ops-muted-surface, #F7F9FA); border-radius: 4px; margin-bottom: 8px; animation: perm-pulse 1.4s ease-in-out infinite` | **Pulse Opacity Animation (Không gradient)** |

---

### Bước 12 – UsersAdminPage Cleanup

#### [MODIFY] [UsersAdminPage.tsx](file:///d:/project1/khaosatvmu/src/Frontend/src/pages/UsersAdminPage.tsx)

Sử dụng `<RolePermissionEditor roles={roles} />` thay thế phần ma trận cũ.

---

## Verification Plan

### Bước 3 — sau migration (SQL Verification)
```sql
-- 1. Kiểm tra không còn row nào có Category rỗng
SELECT COUNT(*) FROM "Permissions" WHERE "Category" = '';
-- Kỳ vọng: 0

-- 2. Kiểm tra dữ liệu Category của 7 permissions
SELECT "Code", "Category" FROM "Permissions" ORDER BY "Code";
-- Kỳ vọng: 7 rows có Category đúng ("Quản trị hệ thống" / "Khảo sát" / "Báo cáo")
```

### Bước 6 — API
- `GET /api/admin/roles/9f32b8c4-19d4-40f1-b870-488a53a75bea/permissions` → 200, permissions theo thứ tự `Quản trị hệ thống` → `Khảo sát` → `Báo cáo`.
- `GET /api/admin/role-permissions` (endpoint cũ) → vẫn 200.

### Bước 10–12 — Frontend & Keyboard Verification
1. Tab "Phân quyền Module" → sidebar 4 roles.
2. `Administrator` active → 3 groups xếp theo đúng thứ tự: **Quản trị hệ thống** → **Khảo sát** → **Báo cáo**.
3. **Keyboard Nav**: `Tab` di chuyển focus vào toggle switch → nhấn `Space` để toggle ON/OFF → outline focus 2px hiển thị rõ nét.
4. **Save Fail Guard**: Thử lưu khi ngắt mạng → báo lỗi inline, **role không bị switch, dirtyMap giữ nguyên**.
5. **Switch Role Guard**: Toggle permission → click role khác → modal confirm hiện ra.
6. **Mobile (390px)**: Sidebar chuyển thành `<select>` dropdown, layout responsive chuẩn.
7. Build check: `npm run build` không lỗi TypeScript.
