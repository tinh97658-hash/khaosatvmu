import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { catalogApi } from '../services/catalogApi';
import type { AcademicYear } from '../types';
import {
  SemesterContext,
  type SemesterContextValue,
} from './semesterContext';

const STORAGE_KEY = 'vmu_active_semester_id';

export function SemesterProvider({ children }: { children: React.ReactNode }) {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [activeSemesterId, setActiveSemesterIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reloadAcademicYears = useCallback(async (): Promise<AcademicYear[]> => {
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
  }, []);

  // Nạp danh sách năm học & học kỳ lần đầu
  useEffect(() => {
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
  }, []);

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
