import { useEffect, useRef } from 'react';

/**
 * Nhịp làm mới mặc định. Sinh viên nộp phiếu rải rác nên không cần nhanh hơn,
 * còn thưa hơn thì người quản lý lại tưởng số liệu đứng yên.
 */
export const defaultRefreshIntervalMs = 15000;

/** Báo cáo là truy vấn tổng hợp nặng hơn nên đi nhịp thưa hơn. */
export const reportRefreshIntervalMs = 30000;

interface AutoRefreshOptions {
  /** Tắt vòng lặp khi màn hình chưa chọn dữ liệu hoặc đang mở màn khác. */
  enabled?: boolean;
  intervalMs?: number;
}

/**
 * Gọi lại `refresh` theo nhịp để bảng số liệu tự cập nhật, thay cho việc người
 * dùng phải tải lại cả trang.
 *
 * `refresh` phải là đường nạp "ngầm": không bật cờ loading và không ghi đè lỗi,
 * nếu không mỗi nhịp sẽ nháy spinner hoặc thay bảng đang xem bằng thông báo lỗi
 * chỉ vì một lần mạng chập chờn.
 */
export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  { enabled = true, intervalMs = defaultRefreshIntervalMs }: AutoRefreshOptions = {}
) {
  // Giữ hàm mới nhất trong ref để vòng lặp không phải dựng lại mỗi lần
  // component render với một closure khác.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | undefined;

    const safeRefresh = async () => {
      try {
        await refreshRef.current();
      } catch {
        // Nuốt lỗi: đây là lần nạp ngầm, dữ liệu cũ trên màn hình vẫn dùng được.
      }
    };

    // Chuỗi setTimeout thay cho setInterval: chỉ hẹn lần sau khi lần trước đã
    // xong, nên mạng chậm không làm các request chồng lên nhau.
    const tick = async () => {
      if (document.visibilityState === 'visible') await safeRefresh();
      if (!cancelled) timer = window.setTimeout(() => void tick(), intervalMs);
    };
    timer = window.setTimeout(() => void tick(), intervalMs);

    // Quay lại tab sau một lúc thì cập nhật ngay, không bắt chờ hết nhịp.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void safeRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, intervalMs]);
}
