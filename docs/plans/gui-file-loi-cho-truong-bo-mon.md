# Gửi file báo lỗi giảng viên cho trưởng bộ môn

Trạng thái: **hoãn**. Chờ làm xong phần phân quyền tài khoản.

## 1. Vì sao hoãn

Khi import lớp học phần theo file gốc, dòng nào có giảng viên **thiếu email**
thì không xác định được giảng viên đó là ai (email là cột `NOT NULL UNIQUE`,
đóng vai trò khoá định danh). Hệ thống vẫn tạo lớp học phần đó nhưng
để `LecturerId = NULL` và ghi tên vào `UnidentifiedLecturerName`.

Yêu cầu ban đầu là gom các giảng viên thiếu thông tin đó lại, **chia theo bộ môn**,
rồi gửi cho **trưởng bộ môn** của đúng bộ môn đó để họ bổ sung email.

Việc gửi tự động phụ thuộc hai thứ chưa có:

1. Phân quyền tài khoản đầy đủ — để biết ai là trưởng bộ môn nào và giới hạn
   dữ liệu họ được nhìn thấy.
2. Hạ tầng gửi email — dự án hiện **không có** SMTP, MailKit hay SendGrid.

## 2. Giai đoạn hiện tại đang làm thay thế

Modal import xuất thẳng file `.xlsx` cho admin tải về, mỗi bộ môn một sheet.
Admin tự chuyển file cho trưởng bộ môn qua kênh sẵn có.

Trưởng bộ môn điền email vào file lớp học phần rồi gửi lại để import lần nữa;
logic import tự gắn đúng `LecturerId` và xoá `UnidentifiedLecturerName`.

## 3. Phương án khi làm đầy đủ

### 3.1. Xác định người nhận

Trưởng bộ môn = giảng viên có `PositionId` trỏ tới chức vụ **"Trưởng Bộ môn"**
và `DepartmentId` trùng bộ môn đang xét.

Cần xử lý các trường hợp lệch:

- Bộ môn chưa có ai giữ chức trưởng bộ môn → chuyển lên trưởng khoa,
  không có nữa thì về admin.
- Một bộ môn có nhiều người cùng chức trưởng bộ môn → gửi cho tất cả.
- Trưởng bộ môn cũng chính là người đang thiếu email → chuyển lên trưởng khoa.

### 3.2. Bảng theo dõi

Cần một bảng lưu các bản ghi chờ bổ sung, thay vì chỉ trả về một lần rồi mất:

```
PendingLecturers
  PendingLecturerId   PK
  FullName            text NOT NULL
  DepartmentId        FK -> Departments, nullable
  FacultyId           FK -> Faculties, nullable
  CourseSectionId     FK -> CourseSections, nullable
  Status              text      -- Pending | Sent | Resolved
  CreatedAt           timestamptz
  ResolvedAt          timestamptz nullable
  ResolvedLecturerId  FK -> Lecturers, nullable
```

Có bảng này thì mới làm được: danh sách tồn đọng, nhắc lại,
và thống kê bộ môn nào chậm cập nhật.

### 3.3. Màn hình trong ứng dụng

Trang "Giảng viên chưa xác định":

- Trưởng bộ môn đăng nhập chỉ thấy bản ghi thuộc bộ môn mình.
- Admin thấy tất cả, lọc theo bộ môn / khoa.
- Điền email ngay trên web, lưu xong hệ thống tự tạo giảng viên,
  gắn `LecturerId` vào lớp học phần và xoá `UnidentifiedLecturerName`.
- Vẫn giữ nút tải file Excel cho ai quen làm trên Excel.

Đây là phần đáng làm nhất: nó khép kín vòng cập nhật mà không cần email.

### 3.4. Gửi email (tuỳ chọn, làm sau cùng)

Nếu vẫn muốn gửi email chủ động:

- Thêm `MailKit`, cấu hình SMTP qua biến môi trường
  (`Smtp__Host`, `Smtp__Port`, `Smtp__User`, `Smtp__Password`),
  **không** commit thông tin đăng nhập.
- Sinh file Excel theo từng bộ môn ở backend, đính kèm vào email.
- Cần bảng log gửi + cơ chế thử lại khi lỗi mạng, tránh gửi trùng.
- Cân nhắc dùng Google Workspace API thay SMTP vì hệ thống đã đăng nhập
  bằng Google (`Authentication__Google__ClientId`).

## 4. Thứ tự nên làm

1. Bảng `PendingLecturers` + ghi dữ liệu vào đó ngay khi import.
2. Trang "Giảng viên chưa xác định" cho admin.
3. Phân quyền giới hạn theo bộ môn cho trưởng bộ môn.
4. Thông báo trong ứng dụng.
5. Gửi email kèm file (nếu vẫn cần).

Xem thêm [import-lop-hoc-phan-theo-file-goc.md](import-lop-hoc-phan-theo-file-goc.md).
