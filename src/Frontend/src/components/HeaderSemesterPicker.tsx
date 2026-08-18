import React from 'react';
import { CalendarDays, ChevronDown, LoaderCircle } from 'lucide-react';
import { useSemester } from '../context/semesterContext';

export const HeaderSemesterPicker: React.FC = () => {
  const {
    academicYears,
    activeSemesterId,
    setActiveSemesterId,
    isLoading,
  } = useSemester();

  if (isLoading && academicYears.length === 0) {
    return (
      <div className="header-semester-picker is-loading" title="Đang tải học kỳ...">
        <LoaderCircle className="header-semester-icon auth-spin" aria-hidden="true" />
        <span className="header-semester-text">Đang tải...</span>
      </div>
    );
  }

  if (academicYears.length === 0) {
    return null;
  }

  return (
    <div className="header-semester-picker" title="Chọn học kỳ làm việc toàn hệ thống">
      <div className="header-semester-inner">
        <CalendarDays className="header-semester-icon" aria-hidden="true" />
        <label htmlFor="header-global-semester-select" className="sr-only">
          Học kỳ làm việc
        </label>
        <select
          id="header-global-semester-select"
          className="header-semester-select"
          value={activeSemesterId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setActiveSemesterId(val ? Number(val) : null);
          }}
        >
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
        <ChevronDown className="header-semester-arrow" aria-hidden="true" />
      </div>
    </div>
  );
};
