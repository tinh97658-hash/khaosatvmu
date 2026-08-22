import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/authContext';
import { catalogApi } from '../services/catalogApi';
import type { AcademicYear } from '../types';
import {
  SemesterContext,
  type SemesterContextValue,
} from './semesterContext';

const STORAGE_KEY = 'vmu_active_semester_id';

export function SemesterProvider({ children }: { children: React.ReactNode }) {
  // Provider này bọc CẢ ứng dụng, kể cả màn làm bài công khai và màn đăng nhập.
  // /api/catalog/academic-years lại đòi đăng nhập, nên gọi lúc chưa đăng nhập là
  // ăn 401: sinh viên mở link khảo sát ra là thấy lỗi đỏ trong console, còn context
  // thì mang sẵn thông báo "Không thể tải danh sách năm học & học kỳ".
  const { status: authStatus } = useAuth();
  const isAuthenticated = authStatus === 'authenticated';
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeSemesterId, setActiveSemesterIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reloadAcademicYears = useCallback(async (): Promise<AcademicYear[]> => {
    if (!isAuthenticated) return [];
    try {
      setIsLoading(true);
      const years = await catalogApi.academicYears();
      setAcademicYears(years);
      setError(null);
      return years;
    } catch {
      setError('Không thể tải danh sách năm học & học kỳ');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Nạp danh sách năm học & học kỳ lần đầu. Chờ đăng nhập xong mới gọi, và gọi lại
  // khi vừa đăng nhập xong — các luồng đăng nhập không tải lại trang thì phải có
  // lần chạy thứ hai này mới có dữ liệu.
  useEffect(() => {
    if (!isAuthenticated) {
      // Đăng xuất thì bỏ dữ liệu cũ đi, đừng để trạng thái nạp treo mãi.
      setAcademicYears([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        setIsLoading(true);
        const years = await catalogApi.academicYears();
        if (cancelled) return;
        setAcademicYears(years);
        setError(null);

        // Kiểm tra và khởi tạo activeSemesterId hợp lệ
        const allSemesters = years.flatMap((y) => y.semesters);
        if (allSemesters.length > 0) {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          const storedId = stored ? Number(stored) : null;
          const exists = storedId !== null && allSemesters.some((s) => s.semesterId === storedId);

          if (exists) {
            setActiveSemesterIdState(storedId);
          } else {
            // Mặc định chọn học kỳ đầu tiên của năm học mới nhất
            const defaultSemesterId = allSemesters[0].semesterId;
            setActiveSemesterIdState(defaultSemesterId);
            window.localStorage.setItem(STORAGE_KEY, String(defaultSemesterId));
          }
        }
      } catch {
        if (!cancelled) {
          setError('Không thể tải danh sách năm học & học kỳ');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const setActiveSemesterId = useCallback((id: number | null) => {
    setActiveSemesterIdState(id);
    if (id !== null && !Number.isNaN(id)) {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const activeSemester = useMemo(() => {
    if (activeSemesterId === null) return null;
    return (
      academicYears
        .flatMap((y) => y.semesters)
        .find((s) => s.semesterId === activeSemesterId) ?? null
    );
  }, [academicYears, activeSemesterId]);

  const activeYear = useMemo(() => {
    if (activeSemesterId === null) return null;
    return (
      academicYears.find((y) =>
        y.semesters.some((s) => s.semesterId === activeSemesterId)
      ) ?? null
    );
  }, [academicYears, activeSemesterId]);

  const activeSemesterLabel = useMemo(() => {
    if (!activeSemester || !activeYear) return 'Chưa chọn học kỳ';
    return `${activeYear.academicYearName} - ${activeSemester.semesterName}`;
  }, [activeSemester, activeYear]);

  const value = useMemo<SemesterContextValue>(
    () => ({
      academicYears,
      activeSemesterId,
      activeSemester,
      activeYear,
      activeSemesterLabel,
      setActiveSemesterId,
      reloadAcademicYears,
      isLoading,
      error,
    }),
    [
      academicYears,
      activeSemesterId,
      activeSemester,
      activeYear,
      activeSemesterLabel,
      setActiveSemesterId,
      reloadAcademicYears,
      isLoading,
      error,
    ]
  );

  return <SemesterContext.Provider value={value}>{children}</SemesterContext.Provider>;
}
