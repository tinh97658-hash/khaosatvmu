# Checklist cấu hình Google OAuth External trên local

Checklist này áp dụng cho backend local tại `http://localhost:5115` và frontend tại
`http://localhost:5173`. Ứng dụng chấp nhận mọi Google Account nhưng chỉ cho phép email
đã có trong allowlist và có profile đang hoạt động.

## 1. Chuẩn bị tài khoản

- Dùng một Gmail hoặc Google Account thật để kiểm thử.
- Thêm email đó vào allowlist của ứng dụng và tạo ít nhất một profile đang hoạt động.
- Không dùng tài khoản mẫu `abc@vmu.edu.vn` để kiểm thử Google thật.

## 2. Cấu hình Google Auth Platform

1. Chọn Google Cloud project dành cho Development.
2. Mở **Google Auth Platform > Branding** và khai báo tên ứng dụng, email hỗ trợ và
   email liên hệ nhà phát triển.
3. Trong **Audience**, chọn `External`.
4. Có thể giữ trạng thái `Testing` khi phát triển local.
5. Trong **Data Access**, chỉ giữ các scope:
   - `openid`
   - `email`
   - `profile`

Ứng dụng không cần Gmail, Drive, Calendar hoặc Contacts API.

## 3. OAuth client

1. Mở **Google Auth Platform > Clients**.
2. Chọn **Create client > Web application**.
3. Đặt tên, ví dụ `KhaoSatVMU Local Development`.
4. Để trống **Authorized JavaScript origins** vì frontend không gọi Google trực tiếp.
5. Thêm **Authorized redirect URI** chính xác:

   ```text
   http://localhost:5115/signin-google
   ```

6. Lưu Client ID và Client Secret ngay khi tạo.

## 4. Lưu secret trên máy phát triển

Chạy tại thư mục gốc repo. Không gửi Client Secret qua chat và không ghi vào
`appsettings*.json`.

```powershell
dotnet user-secrets set "Authentication:Google:ClientId" "<client-id>" --project src/Backend/API/API.csproj
dotnet user-secrets set "Authentication:Google:ClientSecret" "<client-secret>" --project src/Backend/API/API.csproj
dotnet user-secrets list --project src/Backend/API/API.csproj
```

## 5. Kiểm thử luồng thật

1. Khởi động lại backend sau khi lưu User Secrets.
2. Kiểm tra cấu hình không lộ credential:

   ```text
   GET http://localhost:5115/api/auth/config
   googleConfigured = true
   allowAnyGoogleAccount = true
   ```

3. Mở `http://localhost:5173` và chọn đăng nhập Google.
4. Đăng nhập bằng Google Account đã có trong allowlist.
5. Xác nhận:
   - Google callback quay lại `/signin-google` thành công.
   - Backend nhận đủ `sub`, `email` và `email_verified=true`.
   - Một profile được chọn tự động; nhiều profile chuyển tới màn hình chọn profile.
   - `/api/auth/me` và `/api/auth/access` trả đúng user, active profile và permission.

## 6. Kiểm thử từ chối

- Google Account chưa có trong allowlist phải nhận `403`.
- Tài khoản đã vô hiệu phải nhận `403` hoặc bị hủy session.
- Tài khoản không có profile đang hoạt động phải nhận `403`.
- Email đã link với một Google `sub` khác phải bị chặn account-link conflict.
- OAuth Client có redirect URI sai phải phát sinh `redirect_uri_mismatch` và được sửa ở
  Google Auth Platform, không sửa callback tùy tiện trong code.

## 7. Bằng chứng hoàn thành

- Google Cloud project ID và OAuth Client ID; không lưu Client Secret trong repo.
- Audience là `External`.
- Scope thực tế chỉ gồm `openid`, `email`, `profile`.
- Authorized redirect URI đúng.
- `/api/auth/config` trả `googleConfigured = true`.
- Google Account trong allowlist đăng nhập thành công.
- Google Account ngoài allowlist bị từ chối.
- Tài khoản có nhiều profile chọn và chuyển profile đúng quyền.
