import { createContext, useContext } from 'react';
import type { AcademicYear, Semester } from '../types';

export interface SemesterContextValue {
  academicYears: AcademicYear[];
  activeSemesterId: number | null;
  activeSemester: Semester | null;
  activeYear: AcademicYear | null;
  activeSemesterLabel: string;
  setActiveSemesterId: (id: number | null) => void;
  reloadAcademicYears: () => Promise<AcademicYear[]>;
  isLoading: boolean;
  error: string | null;
}

export const SemesterContext = createContext<SemesterContextValue | undefined>(undefined);

export const useSemester = (): SemesterContextValue => {
  const context = useContext(SemesterContext);
  if (!context) {
    throw new Error('useSemester must be used within a SemesterProvider');
  }
  return context;
};
