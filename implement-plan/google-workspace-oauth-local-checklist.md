# Checklist cấu hình Google Workspace OAuth trên local

Checklist này áp dụng cho backend local tại `http://localhost:5115` và frontend tại
`http://localhost:5173`.

## 1. Chuẩn bị tài khoản

- Dùng một tài khoản thật thuộc `@vmu.edu.vn`.
- Thêm email đó vào allowlist của ứng dụng và tạo ít nhất một profile đang hoạt động.
- Không dùng tài khoản mẫu `abc@vmu.edu.vn` để kiểm thử Google thật.
- Xác định người có quyền Google Workspace `Security settings administrator` để kiểm tra
  chính sách OAuth nếu đăng nhập bị chặn.

## 2. Tạo Google Cloud project Development

1. Tạo hoặc chọn một Google Cloud project dành riêng cho Development.
2. Nếu có quyền, đặt project dưới Google Cloud Organization của VMU.
3. Mở **Google Auth Platform > Branding** và khai báo tên ứng dụng, email hỗ trợ và
   email liên hệ nhà phát triển.
4. Trong **Audience**, chọn `Internal` nếu project thuộc Organization VMU.
5. Nếu không có lựa chọn `Internal`, dùng `External / Testing` và thêm chính xác tài
   khoản Workspace kiểm thử vào danh sách test users.
6. Trong **Data Access**, chỉ giữ các scope:
   - `openid`
   - `email`
   - `profile`

Ứng dụng hiện không cần Gmail, Drive, Calendar hoặc Contacts API.

## 3. Tạo OAuth client

1. Mở **Google Auth Platform > Clients**.
2. Chọn **Create client > Web application**.
3. Đặt tên, ví dụ `KhaoSatVMU Local Development`.
4. Thêm Authorized redirect URI chính xác:

   ```text
   http://localhost:5115/signin-google
   ```

5. Không cần Authorized JavaScript origin vì frontend không gọi Google OAuth trực tiếp.
6. Lưu Client ID và Client Secret ngay khi tạo. Google chỉ hiển thị secret tại thời
   điểm tạo client.

## 4. Lưu secret trên máy phát triển

Chạy tại thư mục gốc repo. Không gửi Client Secret qua chat và không ghi vào
`appsettings*.json`.

```powershell
dotnet user-secrets set "Authentication:Google:ClientId" "<client-id>" --project src/Backend/API/API.csproj
dotnet user-secrets set "Authentication:Google:ClientSecret" "<client-secret>" --project src/Backend/API/API.csproj
dotnet user-secrets list --project src/Backend/API/API.csproj
```

`Authentication:Google:AllowedDomain` đã được đặt là `vmu.edu.vn` trong
`appsettings.json`.

## 5. Kiểm tra chính sách Google Workspace Admin

Nếu Google báo ứng dụng bị chặn, Workspace Admin thực hiện:

1. Mở **Admin console > Security > Access and data control > API controls**.
2. Mở **Manage App Access** và tìm/thêm ứng dụng bằng OAuth Client ID.
3. Áp dụng trước cho organizational unit hoặc nhóm kiểm thử.
4. Ưu tiên `Specific Google data` với đúng các scope identity cơ bản nếu giao diện cho
   phép; nếu chính sách tenant vẫn chặn đăng nhập, tạm đặt `Trusted` cho nhóm kiểm thử.
5. Trong **Settings > Unconfigured app settings**, kiểm tra tenant có cho phép ứng dụng
   chỉ yêu cầu thông tin cơ bản để Sign in with Google hay không.
6. Nếu project là Internal, kiểm tra tùy chọn cho phép/trust internal apps.
7. Với Workspace for Education, kiểm tra thêm chính sách theo nhóm tuổi và
   organizational unit của tài khoản thử nghiệm.

Thay đổi chính sách có thể cần thời gian để có hiệu lực. Ghi lại Client ID, OU áp dụng,
mức access và thời điểm thay đổi để đối chiếu khi kiểm thử.

## 6. Kiểm thử luồng thật

1. Khởi động lại backend sau khi lưu User Secrets.
2. Kiểm tra cấu hình, response không được lộ secret:

   ```text
   GET http://localhost:5115/api/auth/config
   googleConfigured = true
   ```

3. Mở `http://localhost:5173` và chọn đăng nhập Google.
4. Đăng nhập bằng tài khoản Workspace đã có trong allowlist.
5. Xác nhận:
   - Google callback quay lại `/signin-google` thành công.
   - Backend nhận đủ `sub`, `email`, `email_verified` và `hd=vmu.edu.vn`.
   - Một profile được chọn tự động; nhiều profile chuyển tới màn hình chọn profile.
   - `/api/auth/me` và `/api/auth/access` trả đúng user, active profile và permission.

## 7. Kiểm thử từ chối

- Gmail cá nhân phải bị từ chối.
- Workspace domain khác phải bị từ chối.
- Tài khoản `@vmu.edu.vn` chưa có trong allowlist phải nhận `403`.
- Tài khoản hoặc profile đã vô hiệu phải nhận `403` hoặc bị hủy session.
- OAuth Client có redirect URI sai phải phát sinh `redirect_uri_mismatch` và được sửa ở
  Google Auth Platform, không sửa callback tùy tiện trong code.

## 8. Bằng chứng hoàn thành

Chỉ đánh dấu xác nhận Google Workspace hoàn tất khi lưu được:

- Google Cloud project ID và OAuth Client ID, không lưu Client Secret.
- Audience (`Internal` hoặc `External / Testing`).
- Danh sách scope thực tế.
- Authorized redirect URI.
- Kết quả `googleConfigured = true`.
- Kết quả đăng nhập thành công bằng tài khoản Workspace thật.
- Kết quả từ chối Gmail cá nhân và tài khoản không có trong allowlist.
- Xác nhận của Workspace Admin về App access control hoặc bằng chứng không cần ngoại lệ.
