/**
 * Màu sắc dùng chung cho bảng tổng quan toàn trường.
 * Tái sử dụng token của module báo cáo (reports.css) và quy ước thang điểm hiện có.
 */

/** Màu theo điểm trung bình (thang 5): ≥4.5 xanh lá, ≥4.0 xanh dương, còn lại cam. */
export const scoreColor = (score: number): string =>
  score >= 4.5 ? '#137b3b' : score >= 4.0 ? '#0788b8' : '#b86216';

/** Màu theo tỷ lệ hoàn thành: ≥80% xanh lá, ≥40% xanh dương, còn lại cam. */
export const completionColor = (rate: number): string =>
  rate >= 80 ? '#137b3b' : rate >= 40 ? '#0788b8' : '#b86216';

/** Màu cho từng nhóm điểm trong phân bố (band 5..2). */
export const bandColor = (band: number): string => {
  switch (band) {
    case 5: return '#137b3b'; // Xuất sắc
    case 4: return '#0788b8'; // Tốt
    case 3: return '#b86216'; // Trung bình
    default: return '#b52d2d'; // Cần cải thiện
  }
};

/** Nhãn nhóm điểm (dự phòng khi API không gửi label). */
export const bandLabel = (band: number): string => {
  switch (band) {
    case 5: return 'Xuất sắc';
    case 4: return 'Tốt';
    case 3: return 'Trung bình';
    default: return 'Cần cải thiện';
  }
};

/** Định dạng số theo locale vi-VN. */
export const formatNumber = (value: number): string => value.toLocaleString('vi-VN');
