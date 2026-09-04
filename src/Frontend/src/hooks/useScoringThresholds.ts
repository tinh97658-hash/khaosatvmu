import { useEffect, useState } from 'react';
import { surveyApi } from '../services/surveyApi';
import {
  DEFAULT_SCORING_THRESHOLDS,
  type ScoringThresholds,
} from '../utils/reportThresholds';

/**
 * Cặp ngưỡng lọc lớp được tính điểm là cấu hình chung của cả hệ thống, nhiều
 * trang cùng cần. Cache ở mức module thay vì dựng Context: mỗi trang gọi hook là
 * xong, và khi một trang lưu ngưỡng mới thì mọi trang đang mở nhận ngay giá trị
 * mới mà không phải tải lại.
 */
let cached: ScoringThresholds | null = null;
let inflight: Promise<ScoringThresholds> | null = null;
const listeners = new Set<(value: ScoringThresholds) => void>();

/** Phát giá trị mới cho mọi màn hình đang mở. Gọi sau khi lưu thành công. */
export function publishScoringThresholds(value: ScoringThresholds): void {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

function loadOnce(): Promise<ScoringThresholds> {
  if (cached) return Promise.resolve(cached);
  inflight ??= surveyApi
    .scoringThresholds()
    .then((value) => {
      cached = value;
      return value;
    })
    // Không tải được thì dùng mặc định: thà hiển thị 50/80 còn hơn để trang trắng.
    .catch(() => DEFAULT_SCORING_THRESHOLDS)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Ngưỡng đang áp dụng. Trước khi tải xong thì trả mặc định của hệ thống, nên chỗ
 * gọi không phải xử lý trạng thái null.
 */
export function useScoringThresholds(): ScoringThresholds {
  const [thresholds, setThresholds] = useState<ScoringThresholds>(
    cached ?? DEFAULT_SCORING_THRESHOLDS
  );

  useEffect(() => {
    let cancelled = false;
    void loadOnce().then((value) => {
      if (!cancelled) setThresholds(value);
    });

    listeners.add(setThresholds);
    return () => {
      cancelled = true;
      listeners.delete(setThresholds);
    };
  }, []);

  return thresholds;
}
