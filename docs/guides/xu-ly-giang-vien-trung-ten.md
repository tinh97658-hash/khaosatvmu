# Hướng dẫn xử lý giảng viên trùng tên

> Trạng thái: đang áp dụng  
> Cập nhật lần cuối: 21/08/2026  
> Phạm vi: import lớp học phần, danh mục giảng viên và báo cáo

## 1. Mục tiêu

Tài liệu này quy định cách hệ thống xử lý khi nhiều giảng viên có cùng họ tên,
đặc biệt trong trường hợp file Excel không có email hoặc mã giảng viên.

Mục tiêu quan trọng nhất là:

- Không gộp nhầm hai người khác nhau chỉ vì họ cùng tên.
- Không tạo thừa nhiều hồ sơ cho cùng một người.
- Mọi lớp có giảng viên phải được gắn với một `LecturerId` cụ thể để báo cáo
  không hiển thị sai thành `0 giảng viên`.
- Người quản trị có thể nhận ra giảng viên mà không phải ghi nhớ mã nội bộ.

## 2. Nguyên tắc nhận diện

### 2.1. Thông tin có thể xác định chính xác

| Thông tin | Ý nghĩa |
| :--- | :--- |
| Email | Thông tin nhận diện ưu tiên khi có; email giảng viên là duy nhất trong hệ thống. |
| `LecturerId` | Khóa kỹ thuật duy nhất trong database. Giao diện hiển thị thành `GV-xxxxxx`. |

### 2.2. Thông tin chỉ dùng để tìm ứng viên

Các thông tin sau **không đủ để kết luận hai dòng là cùng một người**:

- Họ và tên.
- Họ và tên + bộ môn.
- Họ và tên + khoa viện.
- Họ và tên + lớp từng dạy.

Tên và đơn vị chỉ giúp hệ thống tìm các hồ sơ có khả năng phù hợp để người quản
trị lựa chọn. Hệ thống không được tự động coi một ứng viên là người cũ chỉ vì
ứng viên đó là kết quả duy nhất.

## 3. Quy tắc khi import lớp học phần

### 3.1. Dòng có email

1. Nếu email đã có trong danh mục, dùng đúng `LecturerId` gắn với email đó.
2. Nếu email chưa có và có đúng một hồ sơ thiếu email trùng tên + đơn vị, hệ
   thống bổ sung email vào hồ sơ tạm đó; đây là đường hoàn thiện hồ sơ sau khi
   đơn vị phụ trách cung cấp email.
3. Nếu không có đúng một hồ sơ tạm phù hợp, hệ thống tạo hồ sơ giảng viên mới
   theo dữ liệu của dòng import.
4. Email sau khi được gắn là thông tin định danh ổn định cho các lần import sau.

Việc bổ sung email vào hồ sơ tạm chỉ nên thực hiện bằng file đã được đơn vị phụ
trách xác minh. Tên + đơn vị tự thân vẫn không chứng minh chắc chắn danh tính.

### 3.2. Dòng không có email

Hệ thống tạo khóa ứng viên từ:

```text
Họ tên đã chuẩn hóa + Bộ môn
```

Nếu chưa xác định được bộ môn thì mới dùng khoa viện. Khóa này chỉ dùng để tìm
ứng viên, không phải khóa định danh con người.

| Tình huống | Cách xử lý |
| :--- | :--- |
| Không có hồ sơ cùng tên và đơn vị trong database; tên chỉ xuất hiện một lần trong file | Tạo một hồ sơ giảng viên thiếu email và cấp mã nội bộ mới. |
| Có ít nhất một hồ sơ cùng tên và đơn vị trong database | Bắt buộc chọn dùng hồ sơ cũ hoặc tạo hồ sơ mới. |
| Tên xuất hiện ở nhiều dòng cùng đơn vị trong file | Bắt buộc xác nhận các lớp nào do cùng một người dạy. |
| Người nhập chưa biết đó là ai | Dừng import và hỏi đơn vị phụ trách; không chọn ngẫu nhiên. |

### 3.3. Các lựa chọn trên giao diện

- **Đã có: Nguyễn Văn Trùng · GV-000157**: dùng hồ sơ đã tồn tại.
- **Tạo hồ sơ mới, lấy lớp này làm mốc**: tạo một `LecturerId` mới.
- **Cùng giảng viên với dòng X**: các lớp được gắn chung hồ sơ với dòng mốc.
- **Là giảng viên khác**: tạo một hồ sơ mới dù họ tên giống dòng phía trên.

Nút Import bị khóa cho đến khi tất cả dòng mơ hồ được xác nhận.

### 3.4. Ví dụ

File có ba dòng sau, đều không có email:

| Dòng | Giảng viên | Bộ môn | Mã HP | Nhóm |
| ---: | :--- | :--- | :--- | :--- |
| 2 | Nguyễn Văn Trùng | 133 | TEST-GV-001 | KT01 |
| 3 | Nguyễn Văn Trùng | 133 | TEST-GV-001 | KT02 |
| 4 | Nguyễn Văn Trùng | 133 | TEST-GV-001 | KT03 |

Nếu KT01 và KT02 do cùng một người, KT03 do người khác:

1. Dòng 2: chọn **Tạo hồ sơ mới, lấy KT01 làm mốc**.
2. Dòng 3: chọn **Cùng giảng viên với dòng 2 · TEST-GV-001/KT01**.
3. Dòng 4: chọn **Là giảng viên khác, lấy KT03 làm mốc**.

Kết quả là hai hồ sơ giảng viên, không phải ba.

Sang học kỳ sau, nếu lại xuất hiện `Nguyễn Văn Trùng` thuộc bộ môn 133 nhưng
không có email, hệ thống vẫn bắt buộc người nhập chọn:

- Một mã `GV-xxxxxx` đã có; hoặc
- Tạo một hồ sơ mới.

Hệ thống không tự gắn vào người cũ ngay cả khi chỉ tìm thấy một ứng viên.

## 4. Bẫy lỗi bắt buộc

### 4.1. Frontend

- Hiển thị bước xác nhận cho một dòng không email nếu database có **từ một** hồ
  sơ cùng tên và đơn vị trở lên.
- Hiển thị bước xác nhận khi tên lặp lại trong cùng file.
- Hiển thị đầy đủ mã GV, email nếu có, bộ môn, mã học phần và nhóm lớp.
- Không cho bấm Import khi còn dòng chưa chọn.
- Không dùng nhãn `Giảng viên A/B/C` vì nhãn này không có ý nghĩa ở lần import sau.

### 4.2. Backend

Backend là lớp bảo vệ cuối cùng, kể cả khi người dùng sử dụng frontend cũ hoặc
gọi API trực tiếp:

- Không có email, đã có hồ sơ cùng tên và đơn vị nhưng thiếu lựa chọn: trả lỗi
  `CATALOG_LECTURER_AMBIGUOUS`.
- Có nhiều dòng cùng tên và đơn vị nhưng thiếu khóa nhóm: trả lỗi
  `CATALOG_LECTURER_AMBIGUOUS`.
- `ResolvedLecturerId` không tồn tại: trả lỗi `CATALOG_LECTURER_NOT_FOUND`.
- `ResolvedLecturerId` không khớp họ tên và đơn vị của dòng import: từ chối gắn.
- Không tạo lớp với giảng viên mơ hồ rồi âm thầm để `LecturerId = null`.

Hai trường do giao diện bổ sung vào yêu cầu API, **không phải cột trong Excel**:

```json
{
  "resolvedLecturerId": 157,
  "provisionalLecturerKey": null
}
```

hoặc khi tạo và dùng chung một hồ sơ mới:

```json
{
  "resolvedLecturerId": null,
  "provisionalLecturerKey": "row-anchor:2"
}
```

## 5. Nhận diện trong trang Quản lý giảng viên

Trang giảng viên hỗ trợ phân biệt các hồ sơ cùng tên bằng ba lớp thông tin:

1. Mã nội bộ `GV-xxxxxx` luôn hiển thị dưới họ tên.
2. Hồ sơ thiếu email có cảnh báo màu đỏ và được xếp lên đầu danh sách.
3. Mỗi dòng có nút **Lớp đã dạy**.

Nút **Lớp đã dạy** chỉ hiển thị:

- Tối đa 3 lớp được thêm gần nhất.
- Chỉ trong học kỳ đang được chọn trên hệ thống.
- Mã học phần, tên học phần, nhóm lớp và sĩ số.

Thiết kế này không phụ thuộc vào lịch sử lâu dài. Nếu dữ liệu các học kỳ cũ được
xóa dần, chức năng vẫn hoạt động với dữ liệu của học kỳ hiện tại.

## 6. Xử lý khi phát hiện hồ sơ bị tạo sai

### 6.1. Hai hồ sơ thực chất là cùng một người

Không xóa ngay hồ sơ đang được lớp tham chiếu. Thực hiện theo thứ tự:

1. Xác định hồ sơ sẽ được giữ lại.
2. Chuyển các lớp đang gắn với hồ sơ sai sang hồ sơ được giữ lại.
3. Kiểm tra báo cáo theo giảng viên và số lớp.
4. Chỉ xóa hồ sơ thừa khi không còn lớp nào tham chiếu.

### 6.2. Một hồ sơ đang bị dùng cho hai người khác nhau

1. Tạo hồ sơ mới cho người bị gộp nhầm.
2. Dùng mã GV và ba lớp trong học kỳ hiện tại để xác định các lớp cần chuyển.
3. Cập nhật `LecturerId` của các lớp đó sang hồ sơ mới.
4. Kiểm tra lại báo cáo của cả hai giảng viên.

## 7. Import trực tiếp danh mục giảng viên

Khi import file danh mục giảng viên:

- Dòng có email được kiểm tra trùng email trong database và trong file.
- Dòng không có email được tạo với một mã nội bộ riêng.
- Hai dòng không email giống hệt nhau vẫn có thể là hai người khác nhau, nên
  không được tự động gộp theo tên.
- Không nên import lại nguyên file cũ nhiều lần nếu các dòng thiếu email chưa
  được đối chiếu, vì không có mã nguồn ổn định để chứng minh đó là hồ sơ cũ.

## 8. Những việc tuyệt đối không làm

- Không coi họ tên là khóa duy nhất.
- Không tự gộp vì cùng tên và cùng bộ môn.
- Không tự tạo thêm hồ sơ mỗi học kỳ khi chưa kiểm tra ứng viên cũ.
- Không sửa họ tên thành `Nguyễn Văn Trùng A/B/C` để phân biệt.
- Không xóa hồ sơ khi vẫn còn lớp học phần tham chiếu.
- Không lựa chọn ngẫu nhiên chỉ để hoàn thành import.

## 9. Checklist kiểm thử

- [ ] Một dòng không email, chưa có người cùng tên: tạo đúng một giảng viên mới.
- [ ] Một dòng không email, có đúng một người cùng tên: bắt buộc xác nhận.
- [ ] Một dòng không email, có nhiều người cùng tên: hiển thị đủ ứng viên.
- [ ] Nhiều dòng cùng tên, cùng một người: dùng chung một `LecturerId`.
- [ ] Nhiều dòng cùng tên, khác người: tạo các `LecturerId` khác nhau.
- [ ] Chọn mã GV không khớp tên/đơn vị qua API: backend từ chối.
- [ ] Chưa chọn hết các dòng mơ hồ: nút Import bị khóa.
- [ ] Trang giảng viên xếp hồ sơ thiếu email lên đầu.
- [ ] Nút Lớp đã dạy chỉ trả tối đa 3 lớp của học kỳ đang chọn.
- [ ] Giảng viên không có lớp trong học kỳ: hiển thị trạng thái rỗng rõ ràng.
- [ ] Báo cáo đếm đúng số giảng viên và không xuất hiện lớp có `0 giảng viên`
      do lỗi nhận diện.

## 10. Vị trí triển khai chính

- `src/Frontend/src/components/CourseSectionImportDialog.tsx`: giao diện xác nhận.
- `src/Frontend/src/pages/LecturersPage.tsx`: cảnh báo thiếu email và nút Lớp đã dạy.
- `src/Backend/Infrastructure/Catalog/EfCatalogService.cs`: quy tắc ghép/tạo và bẫy lỗi.
- `src/Backend/API/Catalog/CatalogEndpoints.cs`: API import và API ba lớp gần nhất.
- `src/Backend/Application/Catalog/CatalogContracts.cs`: hợp đồng dữ liệu.
- `src/Backend/Infrastructure/Persistence/AuditInterceptor.cs`: nhật ký thay đổi dùng ID thật.
