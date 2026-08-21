import React from 'react';
import { CalendarDays, ChevronDown, LoaderCircle } from 'lucide-react';
import { useSemester } from '../context/semesterContext';

export const HeaderSemesterPicker: React.FC = () => {
  const {
    academicYears,
    activeSemesterId,
    setActiveSemesterId,
    isLoading,
    error,
  } = useSemester();
  const hasSemesters = academicYears.some((year) => year.semesters.length > 0);
  const emptyLabel = isLoading
    ? 'Đang tải học kỳ...'
    : error
      ? 'Không tải được học kỳ'
      : 'Chưa có học kỳ';
  const isDisabled = isLoading || !hasSemesters;

  return (
    <div
      className={`sidebar-semester-picker${error ? ' has-error' : ''}`}
      title={error ?? 'Chọn học kỳ làm việc toàn hệ thống'}
    >
      <label htmlFor="global-semester-select" className="sidebar-semester-label">
        Học kỳ làm việc
      </label>
      <div className="sidebar-semester-inner">
        {isLoading ? (
          <LoaderCircle className="sidebar-semester-icon auth-spin" aria-hidden="true" />
        ) : (
          <CalendarDays className="sidebar-semester-icon" aria-hidden="true" />
        )}
        <select
          id="global-semester-select"
          className="sidebar-semester-select"
          value={hasSemesters ? activeSemesterId ?? '' : ''}
          disabled={isDisabled}
          onChange={(e) => {
            const val = e.target.value;
            setActiveSemesterId(val ? Number(val) : null);
          }}
        >
          {!hasSemesters && <option value="">{emptyLabel}</option>}
          {academicYears.map((year) => (
            <optgroup key={year.academicYearId} label={`Năm học ${year.academicYearName}`}>
              {year.semesters.map((semester) => (
                <option key={semester.semesterId} value={semester.semesterId}>
                  {year.academicYearName} - {semester.semesterName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="sidebar-semester-arrow" aria-hidden="true" />
      </div>
    </div>
  );
};
