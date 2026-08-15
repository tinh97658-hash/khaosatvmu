# Kế hoạch triển khai đăng nhập Google OAuth - Production

## 1. Mục tiêu

Hệ thống cần:

- Cho phép người dùng đăng nhập bằng Gmail hoặc Google Account thuộc bất kỳ domain nào.
- Chỉ cho phép email đã được cấp quyền trong allowlist của ứng dụng.
- Không phụ thuộc Google Workspace hoặc quản trị viên tổ chức.
- Google chỉ xác minh danh tính, còn ứng dụng tự quản lý quyền truy cập.
- Dữ liệu người dùng, role, trạng thái và audit log do backend + PostgreSQL quản lý.
- Một Google account có thể có nhiều profile làm việc khác nhau.

Nguyên tắc:

- Google trả lời câu hỏi "Bạn là ai?".
- Backend trả lời câu hỏi "Bạn có được vào không?" và "Bạn được làm gì?".

## 2. Kiến trúc tổng thể

```text
Google Account
          |
          | OIDC
          v
ASP.NET Core Backend
          |
          | Validate claims + allowlist + active status
          v
PostgreSQL
  Users / UserProfiles / Roles / Permissions / RolePermissions / AuthAuditLogs
          |
          | HttpOnly session cookie
          v
Frontend
```

### Trách nhiệm

**Google**

- Xác thực danh tính.
- Cung cấp `sub`, `email`, `email_verified`, tên và avatar.
- Không quản lý role của ứng dụng.

**Backend + PostgreSQL**

- Kiểm tra allowlist.
- Kiểm tra trạng thái `IsActive`.
- Quản lý nhiều profile trên cùng một Google account.
- Quản lý role.
- Quản lý permission và scope.
- Enforce authorization.
- Quản lý session.
- Ghi audit log.

## 3. Quy tắc bắt buộc trước khi code

- Chỉ dùng một flow chính thức: Google OIDC + cookie session.
- Không lưu Google token trong `localStorage`.
- Tách rõ endpoint:
  - `/api/auth/login`: bắt đầu đăng nhập.
  - `/signin-google`: callback từ Google.
  - `/api/auth/me`: lấy session hiện tại.
  - `/api/auth/logout`: hủy session.
- Quyết định cuối phải dựa trên `sub` + allowlist + `IsActive`.
- `sub` là định danh Google ổn định sau khi link xong.
- Bootstrap admin phải có cơ chế tắt sau khi môi trường production đã khởi tạo.
- Backend phải là nơi enforce quyền, không dựa vào việc ẩn/hiện nút ở frontend.
- Nếu dùng cookie thì phải có chiến lược CSRF rõ ràng.
- Cần chuẩn hóa HTTP status và error code từ đầu.
- Session phải lưu `ActiveProfileId`, không chỉ lưu `RoleId`.

## 4. Luồng đăng nhập production

```text
Người dùng
   |
Frontend /login
   |
"Đăng nhập với Google"
   |
Backend /api/auth/login
   |
Google OIDC
   |
Google callback
   |
ASP.NET Core Backend
```

Backend thực hiện:

1. Validate chữ ký/token theo OIDC.
2. Validate issuer.
3. Validate audience.
4. Validate expiration.
5. Kiểm tra `email_verified`.
6. Lấy `sub`.
7. Tìm user theo `sub`.
8. Nếu chưa có `sub`, thử link theo email nhưng chỉ khi email đã nằm trong allowlist.
9. Kiểm tra `IsActive`.
10. Load các profile khả dụng của user.
11. Nếu không có profile nào thì từ chối.
12. Nếu chỉ có một profile thì tự động chọn.
13. Nếu có nhiều profile thì chuyển sang màn hình chọn profile.
14. Tạo session cookie `HttpOnly` với `ActiveProfileId`.
15. Ghi audit log.
16. Redirect về frontend.

## 5. Xác thực Google Account

Backend không giới hạn domain email và không yêu cầu claim `hd`. Mọi Google Account
có thể hoàn tất bước xác thực, nhưng quyền truy cập ứng dụng vẫn phụ thuộc allowlist.

Backend bắt buộc kiểm tra:

- `sub` tồn tại và được dùng làm external identity ổn định.
- `email` tồn tại.
- `email_verified = true`.
- User tương ứng đã tồn tại trong database và đang hoạt động.

## 6. Allowlist, user database và profile

Google xác thực thành công không đồng nghĩa với việc được truy cập.

Luồng:

```text
Google login
  |
User có trong database?
  |
IsActive = true?
  |
Cho đăng nhập
```

Nếu user chưa có `sub`:

- Chỉ được link một lần.
- Chỉ link khi email đã tồn tại trong allowlist.
- Không tự động tạo account mới chỉ vì Google đã xác thực email.

Sau khi user được xác thực, hệ thống phải load danh sách `UserProfiles`.

Luồng:

```text
Google login
  |
User xác thực hợp lệ
  |
Load UserProfiles
  |
0 profile -> 403
1 profile -> tự chọn
>1 profile -> yêu cầu chọn profile
```

## 7. Account linking lần đầu

Quy tắc:

- Chỉ link khi `GoogleSubject` còn `NULL`.
- Không overwrite `GoogleSubject` đã có giá trị.
- Không cho hai user cùng trỏ vào một `GoogleSubject`.
- Không link lại tùy tiện chỉ dựa trên email.

Ví dụ:

```text
User:
Email = user1@gmail.com
GoogleSubject = NULL
IsActive = true

UserProfile:
ProfileName = Giảng viên
Role = LECTURER
IsActive = true
```

Lần đăng nhập đầu:

```text
Google:
email = user1@gmail.com
sub   = 123456789
```

Backend:

```text
Không tìm thấy GoogleSubject = 123456789
  |
Tìm Email = user1@gmail.com
  |
Email tồn tại + IsActive
  |
GoogleSubject đang NULL
  |
Link GoogleSubject = 123456789
```

Từ lần sau ưu tiên lookup bằng `GoogleSubject`.

## 8. Database schema

### Users

```text
Id UUID PK
GoogleSubject VARCHAR NULL UNIQUE
Email VARCHAR NOT NULL UNIQUE
DisplayName VARCHAR NULL
AvatarUrl VARCHAR NULL
IsActive BOOLEAN NOT NULL
FirstLoginAt TIMESTAMP NULL
LastLoginAt TIMESTAMP NULL
CreatedAt TIMESTAMP NOT NULL
UpdatedAt TIMESTAMP NOT NULL
```

### UserProfiles

```text
Id UUID PK
UserId UUID NOT NULL
RoleId UUID NOT NULL
ProfileName VARCHAR NOT NULL
ProfileCode VARCHAR NOT NULL UNIQUE
OrganizationUnitCode VARCHAR NULL
OrganizationUnitName VARCHAR NULL
IsActive BOOLEAN NOT NULL
IsDefault BOOLEAN NOT NULL
LastSelectedAt TIMESTAMP NULL
CreatedAt TIMESTAMP NOT NULL
UpdatedAt TIMESTAMP NOT NULL
```

### Roles

```text
Id UUID PK
Code VARCHAR UNIQUE
Name VARCHAR
Description VARCHAR NULL
IsSystem BOOLEAN NOT NULL
```

### RolePermissions

```text
Id UUID PK
RoleId UUID NOT NULL
PermissionId UUID NOT NULL
IsGranted BOOLEAN NOT NULL
CreatedAt TIMESTAMP NOT NULL
```

Scope không nằm trong `RolePermissions`. Scope là phạm vi dữ liệu của profile, đã có sẵn ở `UserProfiles.OrganizationUnitCode`. Khi authorization:

```text
ActiveProfile
      ↓
Role → Permission
      +
OrganizationUnitCode → Resource Scope
```

Nếu tương lai một profile cần nhiều scope, lúc đó mới tách bảng `UserProfileScopes` riêng.

### Permissions

```text
Id UUID PK
Code VARCHAR NOT NULL UNIQUE
Name VARCHAR NOT NULL
Description VARCHAR NULL
CreatedAt TIMESTAMP NOT NULL
UpdatedAt TIMESTAMP NOT NULL
```

Role ban đầu:

- `ADMIN`
- `DEPARTMENT_MANAGER`
- `LECTURER`
- `MANAGER`
- `USER`

### AuthAuditLogs

```text
Id UUID PK
UserId UUID NULL
ProfileId UUID NULL
Email VARCHAR NULL
Event VARCHAR NOT NULL
IpAddress VARCHAR NULL
UserAgent VARCHAR NULL
Metadata JSON/JSONB NULL
CreatedAt TIMESTAMP NOT NULL
```

### AuthSessions

```text
Id UUID PK
UserId UUID NOT NULL FK -> Users.Id
ActiveProfileId UUID NOT NULL FK -> UserProfiles.Id
CreatedAt TIMESTAMP NOT NULL
ExpiresAt TIMESTAMP NOT NULL
RevokedAt TIMESTAMP NULL
RevokedReason VARCHAR NULL
```

Cookie chỉ lưu `session_id`, `UserId` và `ActiveProfileId` đã được ASP.NET Core Data Protection bảo vệ. Backend phải đối chiếu cả ba giá trị với `AuthSessions` trên mỗi request có cookie.

## 9. Authorization

Authentication và Authorization phải tách biệt.

Ví dụ:

```csharp
[Authorize]
```

Admin API:

```csharp
[Authorize(Policy = "PERMISSION_ADMIN_ACCESS")]
```

Frontend chỉ phục vụ UX, không được dùng để bảo vệ dữ liệu hay API.

Authorization phải dựa trên:

- `Authenticated User`
- `ActiveProfileId`
- `Role`
- `Permission`
- `Resource Scope`

Role chỉ là nguồn gốc quyền của profile hiện tại, không phải quyền tự động của toàn bộ tài khoản.

## 10. Bootstrap admin đầu tiên

Không dùng quy trình:

```text
Người đăng nhập đầu tiên -> ADMIN
```

Thay vào đó:

```env
BOOTSTRAP_ADMIN_EMAIL=your.name@vmu.edu.vn
```

Startup hoặc migration tạo:

```text
Email = your.name@vmu.edu.vn
IsActive = true
GoogleSubject = NULL
```

Sau khi production khởi tạo xong, cơ chế bootstrap phải được vô hiệu hóa hoặc khóa lại.
Bootstrap nên tạo luôn:

- User admin
- Profile mặc định cho admin
- Role `ADMIN`
- Permission map ban đầu

## 11. Session authentication

Sau khi Google xác thực thành công, backend tạo session của ứng dụng.

Khuyến nghị:

- `HttpOnly = true`
- `Secure = true`
- `SameSite = Lax`
- Có expiration rõ ràng
- Session phải lưu:
  - `UserId`
  - `ActiveProfileId`

Frontend không lưu các giá trị sau trong `localStorage`:

- Google Access Token
- Google ID Token
- Session secret
- Refresh Token

Frontend kiểm tra phiên bằng:

```text
GET /api/auth/me
```

Ví dụ response:

```json
{
  "authenticated": true,
  "user": {
    "email": "abc@vmu.edu.vn",
    "name": "Nguyễn Văn A"
  },
  "activeProfile": {
    "id": "profile-id",
    "name": "Giảng viên",
    "role": "LECTURER"
  },
  "availableProfiles": [
    {
      "id": "profile-id",
      "name": "Giảng viên",
      "role": "LECTURER"
    },
    {
      "id": "profile-id-2",
      "name": "Quản trị khảo sát",
      "role": "SURVEY_ADMIN"
    }
  ]
}
```

`user` là danh tính gốc, còn `activeProfile` là ngữ cảnh làm việc hiện tại.

## 12. Session revocation và user bị disable

Người dùng bị disable không được dùng session cũ để tiếp tục truy cập.

Quy tắc:

- Mỗi request quan trọng phải kiểm tra trạng thái user còn active.
- Mỗi request quan trọng phải kiểm tra `ActiveProfileId` còn hợp lệ.
- Logout phải hủy session server-side.
- Cookie phía client không đủ để xem là đã logout.
- Nếu dùng cache, cache chỉ là tối ưu, không thay cho kiểm tra backend.

## 13. Backend API

### Authentication

```text
GET  /api/auth/login
GET  /api/auth/me
GET  /api/auth/profiles
POST /api/auth/select-profile
POST /api/auth/switch-profile
POST /api/auth/logout
```

Khuyến nghị status:

- `200`: thành công
- `401`: chưa đăng nhập hoặc session hết hạn
- `403`: sai domain, user disabled hoặc không có quyền
- `409`: xung đột account linking

### User administration

```text
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/{userId}/status

GET    /api/admin/users/{userId}/profiles
POST   /api/admin/users/{userId}/profiles

PATCH  /api/admin/profiles/{profileId}
PATCH  /api/admin/profiles/{profileId}/role
PATCH  /api/admin/profiles/{profileId}/status
```

`User` quản lý identity/account; `Profile` quản lý vai trò/ngữ cảnh làm việc.

`/api/auth/switch-profile` phải xác nhận:

- `profile.UserId == currentUser.Id`
- `profile.IsActive == true`
- `user.IsActive == true`

## 14. Frontend

Login page chỉ làm nhiệm vụ:

- Hiển thị nút đăng nhập Google
- Gọi `/api/auth/login`
- Gọi `/api/auth/me`
- Xử lý protected routes
- Logout
- Hiển thị lỗi `401`, `403`, hết session, sai domain, account disabled
- Hiển thị danh sách profile nếu user có nhiều profile
- Gọi switch profile khi người dùng chọn profile khác

Frontend không quyết định user hợp lệ hay không.
Frontend không được tự tin vào `profileId` do chính nó tự giữ.

## 15. User administration

Admin ứng dụng có thể:

- Thêm user vào allowlist
- Enable user
- Disable user
- Thay đổi role
- Tạo và vô hiệu profile
- Xem thời gian login gần nhất
- Xem audit history

## 16. Offboarding

Khi người dùng không còn được phép sử dụng hệ thống:

```text
Users.IsActive = false
```

Sau đó:

```text
Google Login -> Google xác thực thành công -> Backend -> IsActive = false -> 403 ACCOUNT_DISABLED
```

## 17. Audit logging

Nên ghi:

- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `LOGIN_INVALID_DOMAIN`
- `LOGIN_USER_NOT_REGISTERED`
- `LOGIN_DISABLED_USER`
- `LOGOUT`
- `ROLE_CHANGED`
- `USER_CREATED`
- `USER_ENABLED`
- `USER_DISABLED`
- `PROFILE_CREATED`
- `PROFILE_DISABLED`
- `PROFILE_SWITCHED`

Không bao giờ ghi:

- Google ID Token
- Google Access Token
- Refresh Token
- Client Secret
- Session Cookie

## 18. Google Cloud OAuth

OAuth Client nên là:

- Type: Web Application

Development callback:

```text
http://localhost:5115/signin-google
```

Nếu chạy launch profile HTTPS thì đăng ký thêm callback tương ứng:

```text
https://localhost:7031/signin-google
```

Production:

```text
https://khaosat.example.vn/signin-google
```

Scopes tối thiểu:

- `openid`
- `email`
- `profile`

Không xin thêm Gmail, Drive, Calendar, Contacts nếu ứng dụng không dùng.

## 19. Secret management

Local Development dùng file `.env` riêng cho từng developer:

```env
Authentication__Google__ClientId=<client-id>
Authentication__Google__ClientSecret=<client-secret>
```

Yêu cầu:

- `.env.example` chỉ chứa tên biến và giá trị mẫu, không chứa secret thật
- Mỗi developer giữ `.env` riêng và nhận secret qua kênh bảo mật
- API chỉ nạp `.env` trong Development
- Environment variables thật ưu tiên hơn `.env`
- Không gửi Client Secret qua chat
- Không commit secret
- Không hard-code secret trong source
- Không đưa secret vào Docker image
- Production phải inject secret từ environment hoặc secret manager

## 20. Production domain

Khuyến nghị same-origin:

```text
https://khaosat.domain.vn/
```

Frontend:

```text
/
```

Backend:

```text
/api/*
```

Ví dụ:

```text
https://khaosat.domain.vn/login
https://khaosat.domain.vn/api/auth/me
https://khaosat.domain.vn/api/surveys
```

Reverse proxy:

```text
Nginx
  |-- /      -> Frontend
  |-- /api   -> Backend
```

## 21. Production security checklist

- [ ] HTTPS
- [ ] HttpOnly cookie
- [ ] Secure cookie
- [ ] SameSite phù hợp
- [ ] CSRF protection
- [ ] OIDC validation
- [ ] `email_verified` validation
- [ ] Allowlist
- [ ] `IsActive`
- [ ] Server-side authorization
- [ ] Role/policy validation
- [ ] Session expiration
- [ ] Disabled-user session revocation
- [ ] Rate limiting
- [ ] Security headers
- [ ] Structured logging
- [ ] Audit logging
- [ ] Không log token/secret
- [ ] Không commit secret
- [ ] PostgreSQL persistent volume
- [ ] Database backup
- [ ] Health checks
- [ ] Integration tests

## 22. Error codes

Backend nên trả machine-readable code:

```text
AUTH_GOOGLE_FAILED
AUTH_EMAIL_NOT_VERIFIED
AUTH_USER_NOT_REGISTERED
AUTH_ACCOUNT_DISABLED
AUTH_SESSION_EXPIRED
AUTH_FORBIDDEN
AUTH_ACCOUNT_LINK_CONFLICT
```

Frontend map các mã này sang thông báo tiếng Việt.

## 23. Testing matrix

| Test | Kết quả mong đợi |
| --- | --- |
| Gmail trong allowlist + User Active | Cho phép |
| Google Account domain khác trong allowlist | Cho phép |
| Google Account không có trong Users | Từ chối |
| User Disabled | Từ chối |
| USER gọi ADMIN API | 403 |
| ADMIN gọi ADMIN API | Cho phép |
| Cookie/session hết hạn | 401 |
| Google authentication fail | Từ chối an toàn |
| Logout | Session bị hủy |
| User bị disable khi đang login | Session/quyền truy cập bị vô hiệu |
| Role thay đổi | Backend enforce role mới |
| Google email thay đổi | Vẫn ưu tiên định danh bằng `sub` |
| PostgreSQL restart | Dữ liệu không mất |
| Backend restart | Hệ thống phục hồi |
| Client Secret sai | Authentication fail an toàn |
| Database unavailable | Không lộ stack trace/secret |
| Duplicate GoogleSubject | Bị chặn |
| Missing `email_verified` hoặc giá trị false | Bị chặn |
| Logout rồi dùng lại cookie | 401 |
| Disabled user sau khi login | 403 |
| User switch profile không thuộc mình | 403 |
| User switch sang profile Disabled | 403 |
| User Active nhưng ActiveProfile Disabled | 403 |
| User có ADMIN profile, nhưng ActiveProfile = LECTURER gọi ADMIN API | 403 |
| Switch LECTURER → ADMIN hợp lệ | Quyền ADMIN được áp dụng |
| Admin disable profile đang active | Request sau bị reject |
| Role profile thay đổi | Quyền mới được enforce |
| ProfileId giả / không tồn tại | 403 hoặc 404 phù hợp |
| User có Profile A = LECTURER (active) và Profile B = ADMIN, gọi `DELETE /api/admin/users/...` | 403 (sở hữu ADMIN profile không làm toàn bộ account thành ADMIN) |

## 24. Roadmap triển khai

### Phase 0 - OAuth feasibility test

- Tạo Google OAuth Client.
- Cấu hình Audience `External` và callback chính xác.
- Test login bằng Gmail hoặc Google Account thật.
- Xác nhận lấy được `sub`, `email`, `email_verified`.

### Phase 1 - Database

- Tạo `Users`
- Tạo `UserProfiles`
- Tạo `Roles`
- Tạo `Permissions`
- Tạo `RolePermissions`
- Tạo `AuthAuditLogs`
- Migration
- Seed roles
- Seed profile mặc định
- Seed/bootstrap admin
- Unique constraints và indexes

### Phase 2 - Google authentication

- Tích hợp Google OIDC trong ASP.NET Core
- Validate claims
- Validate `email_verified`
- Account linking
- Lưu `GoogleSubject`

### Phase 3 - Application access control

- Allowlist
- `IsActive`
- `UserProfiles`
- Roles
- Permissions
- Scope
- `[Authorize]`
- Admin policies

### Phase 4 - Session

- HttpOnly cookie
- Secure cookie
- SameSite
- Expiration
- Logout
- Disabled-user validation
- Session revocation strategy

### Phase 5 - Frontend

- Login page
- Google login button
- `/api/auth/me`
- `/api/auth/profiles`
- profile selector
- switch profile flow
- Auth state
- Protected routes
- Logout
- Xử lý `401`, `403`, hết session, sai domain, account disabled

### Phase 6 - User administration

- Danh sách users
- Add user
- Enable/disable user
- Tạo/sửa/vô hiệu profile
- Gán role cho profile
- Last login
- Audit history

### Phase 7 - Production hardening

- HTTPS
- Reverse proxy
- CSRF
- CORS nếu cần
- Rate limiting
- Security headers
- Secret management
- Structured logging
- Audit logging
- Database backup
- Health checks
- Integration tests

## 25. Definition of Done

Authentication chỉ được coi là hoàn thành khi:

- [x] Google OAuth login hoạt động với Audience `External`
- [ ] Gmail trong allowlist đăng nhập được
- [ ] Google Account thuộc domain khác trong allowlist đăng nhập được
- [ ] Google Account ngoài allowlist bị từ chối
- [ ] Backend kiểm tra `email_verified`
- [ ] `sub` được dùng làm định danh external ổn định
- [ ] Allowlist hoạt động
- [ ] User disabled không đăng nhập/sử dụng được hệ thống
- [ ] UserProfiles được quản lý trong PostgreSQL
- [ ] ActiveProfileId được lưu trong session
- [ ] Authorization được enforce tại backend theo profile
- [ ] HttpOnly, Secure cookie
- [ ] Không lưu Google token trong localStorage
- [ ] Logout hoạt động
- [ ] Session expiration hoạt động
- [ ] Session/quyền của disabled user bị vô hiệu phù hợp
- [ ] Audit log hoạt động
- [ ] Secret không nằm trong source/Git/Docker image
- [ ] HTTPS production
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Database backup
- [ ] Health checks
- [ ] Integration tests cho authentication/authorization
- [x] OAuth feasibility với Google Account thật đã được xác nhận
- [ ] User có nhiều profile có thể chọn và switch đúng

## Kết luận

Phương án triển khai:

**Google OIDC External + allowlist + Google `sub` + PostgreSQL Users/UserProfiles/Roles/RolePermissions + HttpOnly cookie + server-side authorization.**

Kiến trúc này không yêu cầu Google Workspace Admin. Google xác thực danh tính cho mọi
Google Account, còn hệ thống tự quản lý allowlist, profile, role và permission.

### Phase 1a - Seed order chuẩn

- Migrate các bảng theo thứ tự: `Users` -> `Roles` -> `Permissions` -> `UserProfiles` -> `RolePermissions` -> `AuthAuditLogs`.
- Seed `Roles` trước.
- Seed `Permissions` tiếp theo.
- Seed `RolePermissions` sau cùng.
- Seed một `UserProfile` mặc định cho bootstrap admin.
- Không cho bootstrap admin dùng trực tiếp `Role` nếu chưa có `UserProfile` tương ứng.

### Constraints and indexes

- `Users.GoogleSubject` unique, nullable.
- `Users.Email` unique, not null.
- `UserProfiles.ProfileCode` unique, not null.
- `UserProfiles.UserId` foreign key to `Users.Id`.
- `UserProfiles.RoleId` foreign key to `Roles.Id`.
- `RolePermissions.RoleId` foreign key to `Roles.Id`.
- `RolePermissions.PermissionId` foreign key to `Permissions.Id`.
- `AuthAuditLogs.UserId` and `AuthAuditLogs.ProfileId` nullable foreign keys.
- Index `UserProfiles(UserId, IsActive)`.
- Index `RolePermissions(RoleId)`.
- Index `AuthAuditLogs(UserId, CreatedAt)`.
- Prevent duplicate active default profile per user.

### Implementation status - Phase 1

- Added `AppDbContext` with the complete auth schema and constraints.
- Created `InitialAuthSchema` EF migration.
- Switched `IAuthService` from in-memory storage to EF Core/PostgreSQL.
- Database migration and seed are executed through EF Core only.
- Added idempotent EF seed for system roles, permissions, role-permissions and dev multi-profile user.
- Applied the initial migration and verified dev login, profile selection and `/api/auth/me` against PostgreSQL.

### Implementation status - Phase 2

- Added Google OIDC authorization-code flow with PKCE and HttpOnly cookies.
- Added validation for Google `sub`, `email_verified`, allowlist and account linking.
- Added separate initial profile selection and authenticated profile switching flows.
- Kept OAuth secrets outside source through local Development secrets and production secret injection.
- Limited sample user seeding to Development only.

### Implementation status - Phase 3

- Added server-side permission policies based on the active profile role.
- Enforced organization scope through `UserProfiles.OrganizationUnitCode`.
- Removed the redundant `RolePermissions.ScopeCode` through EF migration.
- Added `/api/auth/access` for the current authorization context.
- Verified `401`, `403`, permission grants and organization-scope isolation against PostgreSQL.

### Implementation status - Phase 4

- Added PostgreSQL-backed `AuthSessions` with fixed 8-hour expiration.
- Added per-request session, user and active-profile validation.
- Added server-side logout revocation and support for revoking all user sessions.
- Added CSRF tokens for profile selection, profile switching and logout.
- Verified valid profile switching and rejected replay of a revoked cookie.

### Implementation status - Phase 5

- Added frontend auth state sourced from `/api/auth/me` and `/api/auth/access`.
- Added Google login, Development login and protected dashboard states.
- Added initial profile selection, header profile switching and CSRF logout.
- Added Vietnamese auth error mapping and expired-session handling.
- Verified desktop/mobile login layouts and the full auth flow through the Vite proxy.

### Implementation status - Phase 6

- Added `ADMIN_ACCESS` APIs for user allowlist, account status, profiles, roles and audit history.
- Added EF validation, audit events and session revocation for account/profile permission changes.
- Added the user, profile and audit administration workspace on the frontend.
- Limited the administration menu and backend actions to the active admin profile.
- Verified CRUD flow, CSRF enforcement, audit records and non-admin `403` responses against PostgreSQL.

### External Google OAuth verification preparation

- Added Development-only `.env` loading and a shared `.env.example` contract.
- Standardized the local callback as `http://localhost:5115/signin-google`.
- Added the Google Auth Platform External-audience and real-login verification checklist.
- Removed the Workspace domain and administrator-policy dependency.
- Real Google login was verified successfully on local with credentials loaded from `.env`.

### Implementation status - External Google Account access

- Removed the `hd` and email-domain restrictions from backend authentication.
- Kept verified email, stable Google `sub`, allowlist and active-profile enforcement.
- Allowed administrators to add Google Account emails from any domain.
- Updated frontend messages and configuration for External Google OAuth.
- Verified an `@gmail.com` allowlist entry against PostgreSQL and completed an interactive Google login on local.

### Implementation status - Shared local environment

- Added Development-only `.env` loading with OS environment variables taking precedence.
- Added a committed `.env.example` contract for all developers.
- Kept each developer's real `.env` and OAuth credentials outside Git.
- Verified the API starts successfully from the root `.env` configuration.

### Implementation status - Real Google OAuth verification

- Configured an External Google OAuth client through local `.env` credentials.
- Successfully completed an interactive Google Account login on local.
- Kept negative access cases and multi-profile switching as separate verification items.

### Implementation status - Frontend sidebar refresh

- Rebuilt the sidebar as a compact, light, data-first navigation surface.
- Replaced emoji navigation with typed Lucide icons and concise Vietnamese labels.
- Added active, count, focus, mobile drawer, overlay and Escape-key states.
- Verified the sidebar visually on desktop and mobile viewports.

### Implementation status - Frontend application shell refresh

- Rebuilt the header with compact breadcrumbs, profile controls and Lucide actions.
- Standardized the light application shell, spacing and responsive header behavior.
- Added focused keyboard states and mobile content constraints.
- Kept final visual verification pending until the parallel page updates are complete.

### Implementation status - Frontend catalog and access refresh

- Standardized catalog pages as compact searchable data tables with responsive overflow.
- Added accessible form dialogs, validation and named deletion confirmations.
- Rebuilt login, profile selection and user administration states without changing API contracts.
- Verified the integrated frontend build and lint checks.

### Implementation status - Frontend survey operations refresh

- Rebuilt campaign, criteria, progress, QR and student survey workflows in the shared data-first style.
- Replaced browser alerts with inline feedback and named confirmation dialogs.
- Added working CSV exports for campaign links and filtered survey progress.
- Passed desktop/mobile visual QA with no page overflow or console errors.

### Implementation status - Frontend toast notifications

- Added a shared Sonner toaster styled for the compact VMU operations interface.
- Migrated catalog, survey, QR and administration success feedback to typed toasts.
- Kept field validation inline and destructive confirmation in named dialogs.
- Verified no native browser `alert()` or `confirm()` remains in the frontend source.

### Implementation status - Frontend profile switcher

- Replaced the native profile select with an accessible custom combobox.
- Added profile names, role context, selected state and responsive dropdown behavior.
- Added keyboard navigation, outside-click dismissal and busy state handling.
- Routed profile-switch and logout feedback through the shared toast system.

### Implementation status - Frontend seamless workspace

- Removed outer content gaps so workspace pages connect directly to the header and sidebar.
- Removed duplicate page titles while retaining action bars, tabs and section headings.
- Adjusted mobile toast placement and campaign filter sizing to avoid overlap.
- Verified zero shell gaps, no horizontal overflow and no console errors on desktop and mobile.

### Implementation status - Frontend toolbar alignment

- Moved progress export into the search and status-filter toolbar.
- Moved campaign, criteria and user actions to the right side of their tab bars.
- Positioned table pagination at the bottom of pages when result sets are short.
- Verified the updated toolbars and pagination on desktop and mobile.

### Implementation status - VMU brand asset

- Moved the supplied VMU logo into the frontend public assets.
- Replaced text placeholders in the sidebar and authentication screens with the real logo.
- Reused the same logo as the browser favicon.
- Verified successful loading and rendering without console errors.

### Implementation status - Bulk user import

- Added a dedicated `ADMIN_ACCESS` API for importing up to 500 users per request.
- Added `.xlsx` parsing, file validation, data preview and row-level results on the frontend.
- Batched database checks and writes without changing the database schema.
- Verified CSRF, duplicate/invalid row handling and desktop/mobile dialog states.

### Implementation status - Mandatory profile session selection

- Required every fresh Google or development login to select a profile before an active session is issued.
- Replaced the header profile combobox with a user menu containing change-session and logout actions.
- Added a shared profile dialog with a blurred workspace backdrop for initial selection and profile switching.
- Verified pending-profile access, pre-selection `401`, responsive layouts and production builds without a schema change.

### Implementation status - Local database compose

- Removed pgAdmin from the shared Docker Compose stack; the default stack now runs only PostgreSQL.
- Removed the tracked pgAdmin server file and ignored local copies for developers who still use pgAdmin.

### Implementation status - Local database synchronization

- Applied all eight pending EF Core migrations to the local PostgreSQL database.
- Confirmed the migration history is current, including the survey template and survey run schemas.
