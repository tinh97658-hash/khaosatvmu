# Kế hoạch cải thiện UI/UX trang Báo cáo

## Vấn đề đã xác định

- Trang cũ đặt dashboard toàn trường, bộ lọc, KPI, hai bảng xếp hạng và bảng chi tiết trong một luồng dọc duy nhất.
- Người dùng muốn tra cứu một lớp phải đi qua các khối phân tích không liên quan trước khi tới bảng thao tác chính.
- Dashboard hiển thị đồng thời bốn biểu đồ và một bảng, làm tăng chiều cao trang và khiến việc so sánh mất trọng tâm.
- KPI toàn trường và KPI theo bộ lọc xuất hiện nối tiếp nhau, dễ tạo cảm giác lặp thông tin.

## Nguyên tắc thiết kế

1. Tách nội dung theo ý định sử dụng, không theo loại component.
2. Đưa thao tác tra cứu tới ngay sau bộ lọc.
3. Chỉ hiển thị một nhóm phân tích chuyên sâu tại một thời điểm.
4. Giữ nguyên khả năng drill-down từ biểu đồ sang dữ liệu chi tiết.
5. Tab phải dùng được bằng bàn phím, có trạng thái được chọn rõ ràng và thích ứng màn hình nhỏ.

## Phạm vi triển khai

### Giai đoạn 1 — Hoàn thành

- Chia trang thành ba chế độ: **Tổng quan**, **Tra cứu chi tiết**, **Xếp hạng đơn vị**.
- Đặt bảng kết quả ngay sau bộ lọc và KPI trong chế độ tra cứu.
- Chia dashboard thành ba nhóm: **So sánh theo Khoa**, **Chất lượng phản hồi**, **Đơn vị chậm tiến độ**.
- Khi chọn Khoa/Bộ môn từ biểu đồ hoặc bảng tiến độ, tự chuyển sang chế độ tra cứu và áp dụng bộ lọc tương ứng.
- Bổ sung trạng thái `aria-selected`, focus rõ ràng và bố cục mobile cho các tab.
- Hiển thị đầy đủ tên Khoa/Viện trên biểu đồ bằng nhãn nhiều dòng và chiều cao thích ứng dữ liệu.
- Phân trang biểu đồ theo 10 Khoa/Viện mỗi trang để số lượng đơn vị lớn không làm tăng chiều dài toàn trang.
- Hiển thị toàn bộ Bộ môn trong bảng tiến độ, phân trang 10 dòng và sắp xếp tăng/giảm theo từng cột.
- Cho phép chọn bất kỳ học kỳ nào làm mốc so sánh; API và cache được tách theo từng cặp học kỳ.
- Nhóm tiến độ theo Bộ môn/Khoa sở hữu học phần; chỉ dùng đơn vị của giảng viên làm fallback khi học phần chưa được phân đơn vị.

### Giai đoạn 2 — Sau khi có phản hồi sử dụng

- Đo thời gian hoàn thành ba tác vụ chính: xem tình hình toàn trường, tìm một lớp, tìm đơn vị chậm tiến độ.
- Theo dõi tab được dùng nhiều nhất để cân nhắc màn hình mặc định theo vai trò người dùng.
- Cân nhắc lưu bộ lọc gần nhất nếu người dùng thường xuyên quay lại cùng một phạm vi dữ liệu.

## Tiêu chí nghiệm thu

- Người dùng mở được bộ lọc và bảng chi tiết chỉ bằng một lần chọn tab, không phải cuộn qua dashboard.
- Màn Tổng quan chỉ hiển thị tối đa một hàng nội dung phân tích chuyên sâu tại một thời điểm.
- Drill-down giữ đúng Khoa/Bộ môn đã chọn và đưa người dùng tới vùng bộ lọc.
- Không mất dữ liệu, cột bảng hoặc chức năng xem chi tiết hiện có.
- Frontend build thành công và không có lỗi TypeScript.
