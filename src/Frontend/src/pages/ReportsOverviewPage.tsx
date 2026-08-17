import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileText,
  GraduationCap,
  LoaderCircle,
  ShieldAlert,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/authContext';
import { Modal } from '../components/Modal';
import { reportRefreshIntervalMs, useAutoRefresh } from '../hooks/useAutoRefresh';
import { catalogApi } from '../services/catalogApi';
import { reportApi } from '../services/reportApi';
import { surveyApi } from '../services/surveyApi';
import type {
  AcademicYear,
  FacultyDepartmentReport,
  LecturerPerformanceReport,
  OperationalProgressReport,
  SemesterSurvey,
  SurveyQuestionSummaryReport,
} from '../types';
import '../styles/survey-operations.css';

const COLOR_PALETTE = ['#0788b8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

export const ReportsOverviewPage: React.FC = () => {
  const { access } = useAuth();

  // Permission helpers
  const hasPermission = (code: string) =>
    !access || access.permissions.includes('ADMIN_ACCESS') || access.permissions.includes(code);

  const canViewReports = hasPermission('VIEW_REPORTS');
  const canViewOp = hasPermission('VIEW_REPORTS_OPERATIONAL');
  const canViewLec = hasPermission('VIEW_REPORTS_LECTURERS');
  const canViewFac = hasPermission('VIEW_REPORTS_FACULTIES');
  const canViewQ = hasPermission('VIEW_REPORTS_QUESTIONS');

  // Active tab state
  const [activeTab, setActiveTab] = useState<'operational' | 'lecturers' | 'faculties' | 'questions'>('operational');

  // Set default tab based on permission
  useEffect(() => {
    if (!canViewOp && canViewLec) setActiveTab('lecturers');
    else if (!canViewOp && !canViewLec && canViewFac) setActiveTab('faculties');
    else if (!canViewOp && !canViewLec && !canViewFac && canViewQ) setActiveTab('questions');
  }, [canViewOp, canViewLec, canViewFac, canViewQ]);

  // Filters state
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | undefined>(undefined);

  // Operational state
  const [opReport, setOpReport] = useState<OperationalProgressReport | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opSearch, setOpSearch] = useState('');

  // Lecturer report state
  const [lecturerReports, setLecturerReports] = useState<LecturerPerformanceReport[]>([]);
  const [lecLoading, setLecLoading] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState<LecturerPerformanceReport | null>(null);
  const [lecSearch, setLecSearch] = useState('');

  // Faculty report state
  const [facultyReports, setFacultyReports] = useState<FacultyDepartmentReport[]>([]);
  const [facLoading, setFacLoading] = useState(false);

  // Question Analysis state
  const [semesterSurveys, setSemesterSurveys] = useState<SemesterSurvey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | undefined>(undefined);
  const [qReport, setQReport] = useState<SurveyQuestionSummaryReport | null>(null);
  const [qLoading, setQLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  // Load initial academic years
  useEffect(() => {
    async function loadYears() {
      try {
        const years = await catalogApi.academicYears();
        setAcademicYears(years);
        if (years.length > 0 && years[0].semesters.length > 0) {
          setSelectedSemesterId(years[0].semesters[0].semesterId);
        }
      } catch (err) {
        console.error('Failed to load academic years', err);
      }
    }
    void loadYears();
  }, []);

  // Mỗi hàm nạp nhận cờ `silent` để vòng tự làm mới dùng lại được: khi làm mới
  // ngầm thì không bật spinner và không đè thông báo lỗi lên báo cáo đang xem.
  const loadOperational = useCallback(
    async (silent = false) => {
      if (!selectedSemesterId || !canViewOp) return;
      if (!silent) setOpLoading(true);
      try {
        setOpReport(await reportApi.operationalProgress(selectedSemesterId));
        setLoadError(null);
      } catch (err) {
        console.error(err);
        if (!silent) setLoadError('Không thể tải báo cáo tiến độ vận hành.');
      } finally {
        if (!silent) setOpLoading(false);
      }
    },
    [selectedSemesterId, canViewOp]
  );

  const loadLecturers = useCallback(
    async (silent = false) => {
      if (!canViewLec) return;
      if (!silent) setLecLoading(true);
      try {
        setLecturerReports(await reportApi.lecturers({ semesterId: selectedSemesterId }));
        setLoadError(null);
      } catch (err) {
        console.error(err);
        if (!silent) setLoadError('Không thể tải báo cáo đánh giá giảng viên.');
      } finally {
        if (!silent) setLecLoading(false);
      }
    },
    [selectedSemesterId, canViewLec]
  );

  const loadFaculties = useCallback(
    async (silent = false) => {
      if (!canViewFac) return;
      if (!silent) setFacLoading(true);
      try {
        setFacultyReports(await reportApi.faculties(selectedSemesterId));
        setLoadError(null);
      } catch (err) {
        console.error(err);
        if (!silent) setLoadError('Không thể tải báo cáo thống kê Khoa/Bộ môn.');
      } finally {
        if (!silent) setFacLoading(false);
      }
    },
    [selectedSemesterId, canViewFac]
  );

  const loadQuestions = useCallback(
    async (silent = false) => {
      if (!selectedSurveyId || !canViewQ) return;
      if (!silent) setQLoading(true);
      try {
        setQReport(await reportApi.questionAnalysis(selectedSurveyId));
        setLoadError(null);
      } catch (err) {
        console.error(err);
        if (!silent) setLoadError('Không thể tải báo cáo phân tích tiêu chí.');
      } finally {
        if (!silent) setQLoading(false);
      }
    },
    [selectedSurveyId, canViewQ]
  );

  useEffect(() => {
    if (activeTab !== 'operational') return;
    void loadOperational();
  }, [activeTab, loadOperational]);

  useEffect(() => {
    if (activeTab !== 'lecturers') return;
    void loadLecturers();
  }, [activeTab, loadLecturers]);

  useEffect(() => {
    if (activeTab !== 'faculties') return;
    void loadFaculties();
  }, [activeTab, loadFaculties]);

  // Fetch Semester Surveys for Question Analysis
  useEffect(() => {
    if (activeTab !== 'questions' || !canViewQ) return;
    surveyApi.semesterSurveys()
      .then((surveys) => {
        setSemesterSurveys(surveys);
        if (surveys.length > 0) {
          setSelectedSurveyId(surveys[0].semesterSurveyId);
        }
      })
      .catch(console.error);
  }, [activeTab, canViewQ]);

  useEffect(() => {
    if (activeTab !== 'questions') return;
    void loadQuestions();
  }, [activeTab, loadQuestions]);

  // Chỉ làm mới đúng tab đang xem, không nạp lại cả bốn báo cáo mỗi nhịp.
  const refreshActiveReport = useCallback(() => {
    if (activeTab === 'operational') return loadOperational(true);
    if (activeTab === 'lecturers') return loadLecturers(true);
    if (activeTab === 'faculties') return loadFaculties(true);
    return loadQuestions(true);
  }, [activeTab, loadOperational, loadLecturers, loadFaculties, loadQuestions]);

  useAutoRefresh(refreshActiveReport, {
    // Đang mở chi tiết một giảng viên thì giữ nguyên số liệu người dùng đang đọc.
    enabled: canViewReports && selectedLecturer === null,
    intervalMs: reportRefreshIntervalMs,
  });

  if (!canViewReports) {
    return (
      <div className="survey-operations-page" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', background: '#fff', padding: '32px', border: '1px solid #dfe4e8', borderRadius: '4px' }}>
          <ShieldAlert style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#20262c' }}>
            Không có quyền truy cập
          </h2>
          <p style={{ color: '#68737d', fontSize: '14px', lineHeight: '1.5' }}>
            Tài khoản của bạn chưa được cấp quyền <code>VIEW_REPORTS</code> để xem báo cáo thống kê. Vui lòng liên hệ Quản trị viên hệ thống để được phân quyền.
          </p>
        </div>
      </div>
    );
  }

  // Filtered operational section details
  const filteredSectionDetails = opReport?.sectionDetails.filter(
    (s) =>
      s.courseName.toLowerCase().includes(opSearch.toLowerCase()) ||
      s.courseCode.toLowerCase().includes(opSearch.toLowerCase()) ||
      s.lecturerName.toLowerCase().includes(opSearch.toLowerCase()),
  ) ?? [];

  // Filtered lecturer list
  const filteredLecturers = lecturerReports.filter(
    (l) =>
      l.fullName.toLowerCase().includes(lecSearch.toLowerCase()) ||
      l.departmentName.toLowerCase().includes(lecSearch.toLowerCase()) ||
      l.facultyName.toLowerCase().includes(lecSearch.toLowerCase()),
  );

  return (
    <div className="survey-operations-page">
      {/* Header Bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dfe4e8', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0788b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <BarChart3 style={{ width: '16px', height: '16px' }} />
            Hệ thống Báo cáo & Thống kê
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#20262c', margin: '4px 0 0' }}>
            Tổng quan Chỉ số Kiểm định & Khảo sát
          </h1>
        </div>

        {/* Semester Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#68737d' }}>Học kỳ:</label>
          <select
            value={selectedSemesterId ?? ''}
            onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
            style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #dfe4e8', borderRadius: '4px', background: '#fff', color: '#20262c', fontWeight: '600' }}
          >
            {academicYears.flatMap((y) =>
              y.semesters.map((s) => (
                <option key={s.semesterId} value={s.semesterId}>
                  {y.academicYearName} - {s.semesterName}
                </option>
              )),
            )}
          </select>
        </div>
      </div>

      {/* Modern Pill Navigation Bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dfe4e8', padding: '0 20px' }}>
        <div className="operations-tabs" style={{ gap: '8px', border: 0 }}>
          {canViewOp && (
            <button
              type="button"
              className={`operations-tab ${activeTab === 'operational' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('operational')}
            >
              <Target style={{ width: '16px', height: '16px' }} />
              Tiến độ vận hành
            </button>
          )}
          {canViewLec && (
            <button
              type="button"
              className={`operations-tab ${activeTab === 'lecturers' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('lecturers')}
            >
              <GraduationCap style={{ width: '16px', height: '16px' }} />
              Đánh giá Giảng viên
            </button>
          )}
          {canViewFac && (
            <button
              type="button"
              className={`operations-tab ${activeTab === 'faculties' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('faculties')}
            >
              <Building2 style={{ width: '16px', height: '16px' }} />
              Thống kê Khoa / Bộ môn
            </button>
          )}
          {canViewQ && (
            <button
              type="button"
              className={`operations-tab ${activeTab === 'questions' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              <FileText style={{ width: '16px', height: '16px' }} />
              Phân tích Tiêu chí
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {loadError && (
        <div style={{ margin: '16px 20px', padding: '12px 16px', background: '#fff5f5', border: '1px solid #eccaca', borderLeft: '4px solid #ef4444', borderRadius: '4px', color: '#9f2727', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CircleAlert style={{ width: '18px', height: '18px' }} />
          {loadError}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ padding: '20px' }}>

        {/* TAB 1: TIẾN ĐỘ VẬN HÀNH */}
        {activeTab === 'operational' && canViewOp && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* KPI Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#e8f5fa', color: '#0788b8', display: 'grid', placeItems: 'center' }}>
                  <Users style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#68737d', fontWeight: '600' }}>Chỉ tiêu Phiếu</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#20262c', margin: '2px 0' }}>
                    {opReport?.totalTargetResponses.toLocaleString('vi-VN') ?? 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#68737d' }}>Sinh viên trong danh sách</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'grid', placeItems: 'center' }}>
                  <CheckCircle2 style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#68737d', fontWeight: '600' }}>Đã thu nộp</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: '2px 0' }}>
                    {opReport?.totalActualResponses.toLocaleString('vi-VN') ?? 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#68737d' }}>Phiếu hoàn thành hợp lệ</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                  <TrendingUp style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#68737d', fontWeight: '600' }}>Tỷ lệ Hoàn thành</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#d97706', margin: '2px 0' }}>
                    {opReport?.overallCompletionRate.toFixed(1) ?? 0}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#68737d' }}>Tiến độ khảo sát học kỳ</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#f3e8ff', color: '#8b5cf6', display: 'grid', placeItems: 'center' }}>
                  <Target style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#68737d', fontWeight: '600' }}>Số Lớp khảo sát</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6', margin: '2px 0' }}>
                    {(opReport?.completedSectionCount ?? 0) + (opReport?.inProgressSectionCount ?? 0) + (opReport?.laggingSectionCount ?? 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#68737d' }}>Lớp học phần đã khởi tạo đợt</div>
                </div>
              </div>
            </div>

            {/* Visual Charts & Table Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '20px' }}>
              {/* Detailed Progress Table */}
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#20262c' }}>Chi tiết Tiến độ Lớp Học Phần</h3>
                  <input
                    type="text"
                    placeholder="Tìm tên lớp, học phần, giảng viên..."
                    value={opSearch}
                    onChange={(e) => setOpSearch(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #dfe4e8', borderRadius: '4px', width: '240px' }}
                  />
                </div>

                {opLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#0788b8' }}>
                    <LoaderCircle className="auth-spin" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                    <span>Đang tải tiến độ...</span>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f7f9fa', borderBottom: '2px solid #dfe4e8' }}>
                          <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700' }}>Mã HP</th>
                          <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700' }}>Tên học phần & Lớp</th>
                          <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700' }}>Giảng viên</th>
                          <th style={{ textAlign: 'right', padding: '10px', color: '#68737d', fontWeight: '700' }}>Đã nộp</th>
                          <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700', width: '140px' }}>Tiến độ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSectionDetails.map((sec) => (
                          <tr key={sec.courseSectionSurveyId} style={{ borderBottom: '1px solid #dfe4e8' }}>
                            <td style={{ padding: '10px', fontWeight: '600', color: '#0788b8' }}>{sec.courseCode}</td>
                            <td style={{ padding: '10px', fontWeight: '600', color: '#20262c' }}>
                              {sec.courseName} ({sec.sectionName})
                            </td>
                            <td style={{ padding: '10px', color: '#68737d' }}>{sec.lecturerName}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                              {sec.responseCount} / {sec.classSize}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, sec.completionRate)}%`,
                                      height: '100%',
                                      background: sec.completionRate >= 80 ? '#10b981' : sec.completionRate >= 50 ? '#0788b8' : '#f59e0b',
                                      borderRadius: '4px',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#20262c', width: '36px', textAlign: 'right' }}>
                                  {sec.completionRate.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Donut Chart Component */}
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#20262c', marginBottom: '16px' }}>Tỷ lệ Đã nộp / Còn lại</h3>
                <div style={{ flex: 1, minHeight: '260px', display: 'grid', placeItems: 'center' }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Đã hoàn thành', value: opReport?.totalActualResponses ?? 0 },
                          { name: 'Còn lại', value: Math.max(0, (opReport?.totalTargetResponses ?? 0) - (opReport?.totalActualResponses ?? 0)) },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell key="cell-completed" fill="#10b981" />
                        <Cell key="cell-remaining" fill="#e5e7eb" />
                      </Pie>
                      <Tooltip formatter={(value: any) => [Number(value ?? 0).toLocaleString('vi-VN'), 'Số phiếu']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ĐÁNH GIÁ GIẢNG VIÊN */}
        {activeTab === 'lecturers' && canViewLec && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Top Bar Search & Filters */}
            <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <input
                type="text"
                placeholder="Tìm giảng viên, Bộ môn hoặc Khoa..."
                value={lecSearch}
                onChange={(e) => setLecSearch(e.target.value)}
                style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #dfe4e8', borderRadius: '4px', width: '320px' }}
              />
              <div style={{ fontSize: '13px', color: '#68737d' }}>
                Tổng cộng: <strong style={{ color: '#20262c' }}>{filteredLecturers.length}</strong> giảng viên được đánh giá
              </div>
            </div>

            {/* Visual Recharts Bar Chart: Top 10 Lecturers */}
            <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#20262c', marginBottom: '16px' }}>
                Top 10 Giảng viên có Điểm Đánh giá Cao nhất
              </h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...filteredLecturers].sort((a, b) => b.averageScore - a.averageScore).slice(0, 10)}
                    margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fullName" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                    <Tooltip formatter={(val: any) => [`${Number(val ?? 0).toFixed(2)} / 5.0`, 'Điểm TB']} />
                    <Bar dataKey="averageScore" fill="#0788b8" radius={[4, 4, 0, 0]}>
                      {[...filteredLecturers].sort((a, b) => b.averageScore - a.averageScore).slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.averageScore >= 4.5 ? '#10b981' : '#0788b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lecturer Table */}
            <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#20262c', marginBottom: '16px' }}>
                Danh sách Chi tiết Đánh giá Giảng viên
              </h3>
              {lecLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#0788b8' }}>
                  <LoaderCircle className="auth-spin" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                  <span>Đang tải kết quả giảng viên...</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f7f9fa', borderBottom: '2px solid #dfe4e8' }}>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700' }}>Họ và tên Giảng viên</th>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#68737d', fontWeight: '700' }}>Bộ môn / Khoa</th>
                        <th style={{ textAlign: 'right', padding: '10px', color: '#68737d', fontWeight: '700' }}>Số phiếu</th>
                        <th style={{ textAlign: 'right', padding: '10px', color: '#68737d', fontWeight: '700' }}>Số lớp</th>
                        <th style={{ textAlign: 'right', padding: '10px', color: '#68737d', fontWeight: '700' }}>Điểm TB (Thang 5)</th>
                        <th style={{ textAlign: 'center', padding: '10px', color: '#68737d', fontWeight: '700' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLecturers.map((lec) => (
                        <tr key={lec.lecturerId} style={{ borderBottom: '1px solid #dfe4e8' }}>
                          <td style={{ padding: '10px', fontWeight: '700', color: '#20262c' }}>{lec.fullName}</td>
                          <td style={{ padding: '10px', color: '#68737d' }}>{lec.departmentName} - {lec.facultyName}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>{lec.totalResponses}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>{lec.courseSectionCount}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: lec.averageScore >= 4.5 ? '#10b981' : lec.averageScore >= 4.0 ? '#0788b8' : '#f59e0b' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Star style={{ width: '14px', height: '14px', fill: 'currentColor' }} />
                              {lec.averageScore.toFixed(2)}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => setSelectedLecturer(lec)}
                            >
                              Xem phiếu
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: THỐNG KÊ KHOA BỘ MÔN */}
        {activeTab === 'faculties' && canViewFac && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Visual Recharts Bar Chart: Faculty Performance */}
            <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#20262c', marginBottom: '16px' }}>
                So sánh Điểm Đánh giá Hài lòng Trung bình theo Khoa
              </h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={facultyReports} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="facultyName" angle={-10} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                    <Tooltip formatter={(val: any) => [`${Number(val ?? 0).toFixed(2)} / 5.0`, 'Điểm trung bình']} />
                    <Bar dataKey="averageSatisfactionScore" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {facultyReports.map((_, index) => (
                        <Cell key={`cell-fac-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Faculty Cards Grid */}
            {facLoading ? (
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '40px', textAlign: 'center', color: '#0788b8' }}>
                <LoaderCircle className="auth-spin" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                <span>Đang tải kết quả Khoa/Bộ môn...</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {facultyReports.map((fac) => (
                  <div key={fac.facultyId} style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#20262c', margin: 0 }}>{fac.facultyName}</h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '16px' }}>
                      <div style={{ background: '#f7f9fa', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#68737d' }}>Số Bộ môn</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#20262c' }}>{fac.totalDepartments}</div>
                      </div>
                      <div style={{ background: '#f7f9fa', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#68737d' }}>Số Giảng viên</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#20262c' }}>{fac.totalLecturers}</div>
                      </div>
                      <div style={{ background: '#f7f9fa', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#68737d' }}>Tổng số phiếu</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#0788b8' }}>{fac.totalResponses}</div>
                      </div>
                      <div style={{ background: '#f7f9fa', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#68737d' }}>Điểm Hài lòng TB</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>{fac.averageSatisfactionScore.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PHÂN TÍCH TIÊU CHÍ */}
        {activeTab === 'questions' && canViewQ && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Survey Select */}
            <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#20262c' }}>Chọn đợt khảo sát:</label>
              <select
                value={selectedSurveyId ?? ''}
                onChange={(e) => setSelectedSurveyId(Number(e.target.value))}
                style={{ padding: '8px 14px', fontSize: '13px', border: '1px solid #dfe4e8', borderRadius: '4px', background: '#fff', width: '360px', fontWeight: '600' }}
              >
                {semesterSurveys.map((s) => (
                  <option key={s.semesterSurveyId} value={s.semesterSurveyId}>
                    {s.templateName} - {s.semesterName} ({s.academicYearName})
                  </option>
                ))}
              </select>
            </div>

            {/* Question Summary Bar Chart */}
            {qLoading ? (
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '40px', textAlign: 'center', color: '#0788b8' }}>
                <LoaderCircle className="auth-spin" style={{ width: '28px', height: '28px', margin: '0 auto 8px' }} />
                <span>Đang phân tích dữ liệu tiêu chí...</span>
              </div>
            ) : qReport && (
              <div style={{ background: '#fff', border: '1px solid #dfe4e8', borderRadius: '6px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#20262c' }}>{qReport.templateName}</h3>
                    <div style={{ fontSize: '12px', color: '#68737d', marginTop: '2px' }}>
                      Tổng số phiếu phản hồi: <strong>{qReport.totalResponses}</strong> | Điểm trung bình chung: <strong style={{ color: '#10b981' }}>{qReport.overallAverageScore.toFixed(2)} / 5.0</strong>
                    </div>
                  </div>
                </div>

                <div style={{ height: '360px', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={qReport.questions}
                      margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                      <YAxis type="category" dataKey="questionText" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => [`${Number(val ?? 0).toFixed(2)} / 5.0`, 'Điểm trung bình']} />
                      <Bar dataKey="averageScore" fill="#0788b8" radius={[0, 4, 4, 0]}>
                        {qReport.questions.map((entry, index) => (
                          <Cell key={`cell-q-${index}`} fill={entry.averageScore >= 4.5 ? '#10b981' : entry.averageScore >= 4.0 ? '#0788b8' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lecturer Detail Modal */}
      {selectedLecturer && (
        <Modal
          isOpen={!!selectedLecturer}
          onClose={() => setSelectedLecturer(null)}
          title={`Chi tiết Đánh giá: ${selectedLecturer.fullName}`}
        >
          <div style={{ padding: '8px' }}>
            <div style={{ background: '#f7f9fa', padding: '14px', borderRadius: '4px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#20262c' }}>{selectedLecturer.fullName}</div>
              <div style={{ fontSize: '12px', color: '#68737d', marginTop: '2px' }}>Bộ môn: {selectedLecturer.departmentName} - {selectedLecturer.facultyName}</div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <div>Số lượt đánh giá: <strong>{selectedLecturer.totalResponses}</strong></div>
                <div>Số lớp: <strong>{selectedLecturer.courseSectionCount}</strong></div>
                <div>Điểm TB: <strong style={{ color: '#10b981' }}>{selectedLecturer.averageScore.toFixed(2)}</strong></div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSelectedLecturer(null)}
              style={{ width: '100%' }}
            >
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
