/**
 * Ngưỡng dùng chung cho mọi màn hình đọc số khảo sát. PHẢI trùng với
 * `ReportThresholds` bên backend (src/Backend/Application/Surveys/ReportThresholds.cs)
 * — hai bên lệch nhau thì cùng một lớp sẽ được gắn nhãn "Hoàn thành" ở trang này
 * mà lại bị bỏ khỏi điểm ở trang kia, không ai hiểu nổi tại sao.
 */

/**
 * Tỷ lệ PHIẾU HỢP LỆ trên sĩ số để một lớp được coi là thu đủ. Vừa là mốc gắn nhãn
 * "Hoàn thành" trên bảng tiến độ, vừa là điều kiện để lớp được tính vào điểm.
 */
export const COMPLETED_COMPLETION_RATE = 50;

/** Dưới mốc này thì lớp bị coi là chậm tiến độ. Giữa hai mốc là "đang thu". */
export const LAGGING_COMPLETION_RATE = 20;

/** Tỷ lệ hoàn thành của một lớp: phiếu hợp lệ chia sĩ số, theo phần trăm. */
export const completionRateOf = (validResponseCount: number, classSize: number): number =>
  classSize > 0 ? (validResponseCount / classSize) * 100 : 0;

/**
 * Lớp đã thu đủ phiếu để điểm của nó dùng được hay chưa. Vế thứ hai là lưới an
 * toàn cho lớp nộp đủ nhưng phần lớn phiếu bị bộ lọc loại: cả lớp đã làm rồi thì
 * không còn ai để thu thêm.
 */
export const hasEnoughResponsesToScore = (
  classSize: number,
  totalResponseCount: number,
  validResponseCount: number,
): boolean => {
  if (classSize <= 0) return false;
  if (totalResponseCount >= classSize) return true;
  return completionRateOf(validResponseCount, classSize) >= COMPLETED_COMPLETION_RATE;
};
