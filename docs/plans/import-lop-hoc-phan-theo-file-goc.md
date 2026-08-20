# Import lớp học phần theo file gốc của đơn vị tiếp nhận

Trạng thái: **gần xong** — còn G4 (chạy thử bằng file thật). Cập nhật ô `[ ]` → `[x]` khi xong từng việc.

## 1. Bối cảnh

Đơn vị tiếp nhận production dùng sẵn một file Excel danh sách lớp học phần.
File import của hệ thống phải khớp đúng file đó, không bắt họ sửa file.

### Cột trong file gốc

| Cột Excel | Đích trong CSDL | Ghi chú |
| :--- | :--- | :--- |
| Mã HP | `Courses.CourseCode` | tra ngược; không có thì **tự tạo học phần** |
| Học phần | `Courses.CourseName` | dùng khi tự tạo |
| Nhóm | `CourseSections.SectionName` | |
| TCHT | `Courses.Credits` | dùng khi tự tạo |
| Sĩ số | `CourseSections.ClassSize` | |
| Bộ môn | `Departments.DepartmentName` | fallback khi Mã BM trống |
| Khoa | `Faculties.FacultyName` | |
| Giảng viên | `Lecturers.FullName` | |
| Email | `Lecturers.Email` | trống ⇒ nhánh "chưa xác định" |
| Mã BM | `Departments.DepartmentId` | **ưu tiên tra theo cột này** |

Bộ môn và khoa viện **không** tự tạo — thiếu thì dòng đó báo lỗi.

## 2. Quyết định đã chốt

- `CourseSections.LecturerId` đổi sang **nullable**.
- Thêm cột `CourseSections.UnidentifiedLecturerName` (nullable).
- **Không** đặt CHECK constraint dưới CSDL cho quy tắc "chỉ 1 trong 2 cột được điền";
  ràng buộc này kiểm tra ở tầng service.
- Tra bộ môn: ưu tiên `Mã BM`, trống thì fallback theo `Bộ môn` (tên).
- `Courses.CourseType` đổi sang **nullable** (bỏ `NOT NULL DEFAULT ''`). Tệp import
  lớp học phần không có cột bắt buộc/tự chọn, nên học phần tạo tự động để trống
  cột này cho quản trị vào trang Học phần điền sau. Cấu trúc cột của tệp import
  giữ nguyên đúng 10 cột như tệp gốc.
- File lỗi giảng viên thiếu email: giai đoạn này **chỉ xuất ra cho admin tải về ngay
  trong modal import**. Việc gửi tự động cho trưởng bộ môn để sau, xem
  [gui-file-loi-cho-truong-bo-mon.md](gui-file-loi-cho-truong-bo-mon.md).

## 3. Luồng xử lý một dòng import

```
1. Bắt buộc: Mã HP, Nhóm. Sĩ số nếu có phải là số nguyên >= 0.
2. Tra bộ môn:  Mã BM -> nếu trống thì theo tên Bộ môn.  Không thấy -> lỗi.
3. Tra khoa viện theo tên Khoa. Không thấy -> lỗi. (Cột Khoa trống thì bỏ qua.)
4. Tra học phần theo Mã HP:
     có     -> dùng CourseId
     không  -> TỰ TẠO Courses {CourseCode, CourseName, Credits, DepartmentId, FacultyId}
               (thiếu tên Học phần -> lỗi)
5. Tra giảng viên:
     Email có giá trị:
         tra Lecturers theo Email
           có     -> LecturerId
           không  -> TỰ TẠO Lecturers {FullName, Email, DepartmentId, FacultyId,
                                       PositionId = "Giảng viên"}
     Email trống:
         LecturerId = null
         UnidentifiedLecturerName = tên giảng viên trong file
         ghi vào danh sách xuất file lỗi
6. Lớp học phần trùng UNIQUE (CourseId, SemesterId, SectionName):
     bản ghi cũ có UnidentifiedLecturerName != null
       VÀ dòng mới tra ra được LecturerId
         -> CẬP NHẬT: LecturerId = mới, UnidentifiedLecturerName = null
     ngược lại
         -> bỏ qua, mã lỗi CATALOG_COURSE_SECTION_EXISTS
```

Bước 6 chính là đường quay lại: trưởng bộ môn điền email vào file rồi import lại,
hệ thống tự gắn đúng mã giảng viên và xoá tên ở cột chưa xác định.

Hai tình huống khi import lại đều chạy đúng nhờ bước 5:
giảng viên đã có trong CSDL thì tra ra theo email; chưa có thì được tạo mới.

## 4. Danh sách việc

### Nhóm A — CSDL

- [x] A1. `Domain/CatalogModels.cs`: `CourseSection.LecturerId` → `int?`,
      thêm `UnidentifiedLecturerName` (`string?`)
- [x] A2. `AppDbContext.cs`: FK `LecturerId` nullable, cấu hình cột mới
- [x] A3. Tạo migration `AddUnidentifiedLecturerToCourseSection` + apply

### Nhóm B — Sửa chỗ vỡ do LecturerId thành nullable

`.LecturerId` đang xuất hiện 49 chỗ trong 7 file. Phải rà từng chỗ.

- [x] B1. `EfReportService.cs` (22 chỗ) — báo cáo join theo giảng viên;
      lớp không có giảng viên phải bị loại khỏi báo cáo giảng viên,
      nhưng vẫn tính vào báo cáo tổng quan / khoa / bộ môn
- [x] B2. `EfSurveyService.cs` (4 chỗ)
- [x] B3. `EfCatalogService.cs` (15 chỗ) — ngoài phần import
- [x] B4. `DeleteLecturerAsync`: điều kiện `LecturerInUse` phải chịu được null

### Nhóm C — Hợp đồng dữ liệu (Application + API)

- [x] C1. `CourseSectionDto`: `LecturerId` → `int?`, thêm `UnidentifiedLecturerName`
- [x] C2. `SaveCourseSectionCommand`: `LecturerId` → `int?`,
      thêm `UnidentifiedLecturerName` (để sửa tay trên giao diện vẫn chạy)
- [x] C3. `ImportCourseSectionRowCommand`: đổi sang bộ trường của file gốc
      (CourseCode, CourseName, SectionName, Credits, ClassSize,
      DepartmentName, DepartmentCode, FacultyName, LecturerFullName, LecturerEmail)
- [x] C4. DTO kết quả mới `CourseSectionImportDto`:
      kế thừa số liệu của `CatalogImportDto`, thêm
      `CreatedCourseCount`, `CreatedLecturerCount`, `UpdatedSectionCount`,
      và `IReadOnlyList<UnidentifiedLecturerDto>`
- [x] C5. `UnidentifiedLecturerDto(RowNumber, FullName, DepartmentId, DepartmentName,
      FacultyName, CourseCode, SectionName)`
- [x] C6. Mã lỗi mới: `CourseNameRequiredForAutoCreate`, `DepartmentCodeInvalid`
- [x] C7. `CatalogEndpoints.cs`: cập nhật `ImportCourseSectionRowRequest`,
      `SaveCourseSectionRequest`, ánh xạ và mã trạng thái HTTP

### Nhóm D — Logic import (`EfCatalogService.ImportCourseSectionsAsync`)

- [x] D1. Nạp sẵn map: course theo mã, department theo id và theo tên,
      faculty theo tên, lecturer theo email, position "Giảng viên"
- [x] D2. Tự tạo học phần khi chưa có
- [x] D3. Tự tạo giảng viên khi có email mà chưa có trong CSDL
- [x] D4. Nhánh thiếu email: `LecturerId = null` + điền `UnidentifiedLecturerName`
- [x] D5. Cập nhật lớp học phần cũ khi dòng mới đã đủ thông tin giảng viên
- [x] D6. Gom danh sách giảng viên thiếu email trả về cho frontend
- [x] D7. Học phần / giảng viên tự tạo trong cùng một lần import phải dùng lại được
      cho các dòng sau (không tạo trùng)

### Nhóm E — Frontend: file Excel

- [x] E1. `courseSectionImportExcel.ts`: bộ header mới đúng theo file gốc,
      chấp nhận cả biến thể tên cột
- [x] E2. Tệp mẫu tải về dựng đúng 10 cột của file gốc
- [x] E3. Hàm `downloadUnidentifiedLecturerFile()`: xuất `.xlsx`,
      **mỗi bộ môn một sheet**, cột: Họ và tên, Email (để trống cho người ta điền),
      Bộ môn, Mã BM, Khoa, Mã HP, Nhóm

### Nhóm F — Frontend: giao diện

- [x] F1. `CourseSectionImportDialog.tsx`: bảng xem trước theo cột mới
- [x] F2. Sau khi import: hiện số học phần tự tạo, số giảng viên tự tạo,
      số lớp được cập nhật
- [x] F3. Nút "Tải file giảng viên thiếu email" khi danh sách khác rỗng
- [x] F4. `ClassesPage.tsx`: cột Giảng viên hiển thị tên giảng viên có mã,
      hoặc tên ở cột chưa xác định
- [x] F5. Dòng có giảng viên chưa xác định phải **bôi đỏ + gắn ký hiệu cảnh báo**
- [x] F6. Modal sửa lớp học phần: cho phép giảng viên để trống,
      hiển thị tên chưa xác định nếu có
- [x] F7. CSS cho dòng cảnh báo

### Nhóm G — Kiểm thử và tài liệu

- [x] G1. `dotnet build` sạch, `npx tsc -b` sạch, `npx oxlint` sạch
- [x] G2. `dotnet test` toàn bộ pass (sửa test vỡ do đổi chữ ký)
- [x] G3. Tạo `docs/plans/gui-file-loi-cho-truong-bo-mon.md` ghi lại phần hoãn
- [ ] G4. Chạy thử import bằng file thật, đối chiếu số liệu dưới CSDL

## 5. Việc cố ý không làm ở giai đoạn này

- Gửi email / thông báo tự động tới trưởng bộ môn.
- Phân quyền để trưởng bộ môn chỉ thấy giảng viên bộ môn mình.
- Màn hình riêng cho trưởng bộ môn cập nhật email giảng viên.

Ba việc trên phụ thuộc phần phân quyền tài khoản, làm sau.
