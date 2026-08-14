import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './auth/authContext';
import { AuthLoading } from './components/AuthLoading';

// Shared Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { QRCodeModal } from './components/QRCodeModal';

// Catalog Pages
import { DashboardOverview } from './pages/DashboardOverview';
import { FacultiesPage } from './pages/FacultiesPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { LecturersPage } from './pages/LecturersPage';
import { MajorsPage } from './pages/MajorsPage';
import { CoursesPage } from './pages/CoursesPage';
import { ClassesPage } from './pages/ClassesPage';
import { CriteriaPage } from './pages/CriteriaPage';
import { SurveyTemplatesPage } from './pages/SurveyTemplatesPage';
import { CourseSurveysPage } from './pages/CourseSurveysPage';
import { PublicSurveyPage } from './pages/PublicSurveyPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { SurveyProgressPage } from './pages/SurveyProgressPage';
import { StudentSurveyView } from './pages/StudentSurveyView';
import { LoginPage } from './pages/LoginPage';
import { ProfileSelectionPage } from './pages/ProfileSelectionPage';
import { UsersAdminPage } from './pages/UsersAdminPage';

// Services & Types
import { ApiError } from './services/apiClient';
import {
  catalogApi,
  type SaveCoursePayload,
  type SaveLecturerPayload,
} from './services/catalogApi';
import type { ImportFacultyRow } from './utils/facultyImportExcel';
import type { ImportDepartmentRow } from './utils/departmentImportExcel';
import type { ImportMajorRow } from './utils/majorImportExcel';
import type { ImportCourseRow } from './utils/courseImportExcel';
import type { ImportLecturerRow } from './utils/lecturerImportExcel';
import type {
  Faculty,
  Department,
  Lecturer,
  Major,
  Course,
  CourseSection,
  Curriculum,
  CurriculumCourse,
  Criterion,
  SurveyCampaign,
  SystemStats,
} from './types';

function DashboardApp() {
  const auth = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isStudentView, setIsStudentView] = useState<boolean>(false);
  const canManageUsers = auth.access?.permissions.includes('ADMIN_ACCESS') ?? false;

  useEffect(() => {
    if (currentTab === 'users-admin' && !canManageUsers) {
      setCurrentTab('overview');
    }
  }, [canManageUsers, currentTab]);

  // Nạp danh mục đã lưu trong database khi vào hệ thống.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [
          nextFaculties,
          nextDepartments,
          nextMajors,
          nextCourses,
          nextLecturers,
          nextSections,
        ] = await Promise.all([
          catalogApi.faculties(),
          catalogApi.departments(),
          catalogApi.majors(),
          catalogApi.courses(),
          catalogApi.lecturers(),
          catalogApi.courseSections(),
        ]);
        if (cancelled) return;
        setFaculties(nextFaculties);
        setDepartments(nextDepartments);
        setMajors(nextMajors);
        setCourses(nextCourses);
        setLecturers(nextLecturers);
        setSections(nextSections);
      } catch {
        if (!cancelled) {
          toast.error('Không tải được danh mục từ máy chủ');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Danh mục đào tạo. Mọi danh mục bắt đầu rỗng, dữ liệu chỉ nằm trong phiên
  // làm việc cho tới khi backend có API cho các bảng này.
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<CourseSection[]>([]);
  // Hai bảng khung chương trình, cần để đếm số nhóm lớp của một ngành học.
  // Chưa có màn hình quản lý nên hiện luôn rỗng.
  const [curricula] = useState<Curriculum[]>([]);
  const [curriculumCourses] = useState<CurriculumCourse[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>([]);
  const [surveyCounters, setSurveyCounters] = useState({ totalResponses: 0, qrScanCount: 0 });

  const stats: SystemStats = useMemo(
    () => ({
      totalFaculties: faculties.length,
      totalMajors: majors.length,
      totalCourses: courses.length,
      totalClasses: sections.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'Đang diễn ra').length,
      totalResponses: surveyCounters.totalResponses,
      overallSatisfaction: 0,
      qrScanCount: surveyCounters.qrScanCount,
    }),
    [faculties, majors, courses, sections, campaigns, surveyCounters]
  );

  // QR Modal state
  const [qrModalData, setQrModalData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    qrUrl: string;
    surveyLink: string;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    qrUrl: '',
    surveyLink: '',
  });

  // ---------------------------------------------------------------------------
  // Danh mục khoa viện / bộ môn / ngành học đi qua API /api/catalog và được lưu
  // trong PostgreSQL. Sau mỗi thao tác ghi, danh sách được nạp lại từ server để
  // id do database sinh ra luôn khớp với những gì đang hiển thị.
  // ---------------------------------------------------------------------------
  const errorCodeOf = (error: unknown): string =>
    error instanceof ApiError ? error.errorCode : 'API_REQUEST_FAILED';

  const handleSaveFaculty = async (
    facultyId: number | null,
    facultyName: string
  ): Promise<string | null> => {
    try {
      if (facultyId === null) {
        await catalogApi.createFaculty(facultyName);
      } else {
        await catalogApi.updateFaculty(facultyId, facultyName);
      }
      setFaculties(await catalogApi.faculties());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleImportFaculties = async (rows: ImportFacultyRow[]) => {
    const result = await catalogApi.importFaculties(rows);
    setFaculties(await catalogApi.faculties());
    return result;
  };

  const handleDeleteFaculty = async (facultyId: number): Promise<string | null> => {
    try {
      await catalogApi.deleteFaculty(facultyId);
      // Departments.FacultyId là ON DELETE SET NULL, Majors là CASCADE.
      const [nextFaculties, nextDepartments, nextMajors] = await Promise.all([
        catalogApi.faculties(),
        catalogApi.departments(),
        catalogApi.majors(),
      ]);
      setFaculties(nextFaculties);
      setDepartments(nextDepartments);
      setMajors(nextMajors);
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleSaveDepartment = async (
    departmentId: number | null,
    departmentName: string,
    facultyId: number | null
  ): Promise<string | null> => {
    try {
      if (departmentId === null) {
        await catalogApi.createDepartment(departmentName, facultyId);
      } else {
        await catalogApi.updateDepartment(departmentId, departmentName, facultyId);
      }
      setDepartments(await catalogApi.departments());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleImportDepartments = async (rows: ImportDepartmentRow[]) => {
    const result = await catalogApi.importDepartments(rows);
    setDepartments(await catalogApi.departments());
    return result;
  };

  const handleDeleteDepartment = async (departmentId: number): Promise<string | null> => {
    try {
      await catalogApi.deleteDepartment(departmentId);
      setDepartments(await catalogApi.departments());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Lecturers. CourseSectionLecturers: ON DELETE CASCADE.
  // ---------------------------------------------------------------------------
  const handleSaveLecturer = async (
    lecturerId: number | null,
    lecturer: SaveLecturerPayload
  ): Promise<string | null> => {
    try {
      if (lecturerId === null) {
        await catalogApi.createLecturer(lecturer);
      } else {
        await catalogApi.updateLecturer(lecturerId, lecturer);
      }
      setLecturers(await catalogApi.lecturers());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleImportLecturers = async (rows: ImportLecturerRow[]) => {
    const result = await catalogApi.importLecturers(rows);
    setLecturers(await catalogApi.lecturers());
    return result;
  };

  const handleDeleteLecturer = async (lecturerId: number): Promise<string | null> => {
    try {
      await catalogApi.deleteLecturer(lecturerId);
      setLecturers(await catalogApi.lecturers());
      // "CourseSections"."LecturerId" là ON DELETE RESTRICT nên nếu giảng viên
      // còn lớp học phần thì API đã trả lỗi ở trên, danh sách lớp không đổi.
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Majors.
  // ---------------------------------------------------------------------------
  const handleSaveMajor = async (
    majorId: number | null,
    majorName: string,
    facultyId: number
  ): Promise<string | null> => {
    try {
      if (majorId === null) {
        await catalogApi.createMajor(majorName, facultyId);
      } else {
        await catalogApi.updateMajor(majorId, majorName, facultyId);
      }
      setMajors(await catalogApi.majors());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleImportMajors = async (rows: ImportMajorRow[]) => {
    const result = await catalogApi.importMajors(rows);
    setMajors(await catalogApi.majors());
    return result;
  };

  const handleDeleteMajor = async (majorId: number): Promise<string | null> => {
    try {
      await catalogApi.deleteMajor(majorId);
      setMajors(await catalogApi.majors());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  // ---------------------------------------------------------------------------
  // Courses. CourseSections: ON DELETE CASCADE.
  // PrerequisiteCourseId: ON DELETE RESTRICT.
  // ---------------------------------------------------------------------------
  const handleSaveCourse = async (
    courseId: number | null,
    course: SaveCoursePayload
  ): Promise<string | null> => {
    try {
      if (courseId === null) {
        await catalogApi.createCourse(course);
      } else {
        await catalogApi.updateCourse(courseId, course);
      }
      setCourses(await catalogApi.courses());
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  const handleImportCourses = async (rows: ImportCourseRow[]) => {
    const result = await catalogApi.importCourses(rows);
    setCourses(await catalogApi.courses());
    return result;
  };

  const handleDeleteCourse = async (courseId: number): Promise<string | null> => {
    try {
      await catalogApi.deleteCourse(courseId);
      setCourses(await catalogApi.courses());
      // CourseSections tham chiếu Courses với ON DELETE CASCADE.
      setSections((prev) => prev.filter((section) => section.courseId !== courseId));
      return null;
    } catch (error) {
      return errorCodeOf(error);
    }
  };

  // Handlers for Criteria
  const handleAddCriterion = (newCriterion: Criterion) => {
    setCriteria((prev) => [newCriterion, ...prev]);
  };
  const handleDeleteCriterion = (id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  // Handlers for Campaigns
  const handleAddCampaign = (newCampaign: SurveyCampaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
  };
  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddMultipleCampaigns = (newCampaigns: SurveyCampaign[]) => {
    setCampaigns((prev) => [...newCampaigns, ...prev]);
  };

  const handleUpdateCampaignDates = (id: string, startDate: string, endDate: string) => {
    setCampaigns((prev) =>
      prev.map((cmp) => (cmp.id === id ? { ...cmp, startDate, endDate } : cmp))
    );
  };

  // QR Code Open Handlers
  const handleOpenCampaignQR = (campaign: SurveyCampaign) => {
    setQrModalData({
      isOpen: true,
      title: campaign.title,
      subtitle: `Đợt khảo sát ${campaign.type} • Thời gian mở QR: ${campaign.startDate} ~ ${campaign.endDate}`,
      qrUrl: campaign.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(campaign.surveyLink || `https://khaosat.vimaru.edu.vn/survey/${campaign.id}`)}`,
      surveyLink: campaign.surveyLink || `https://khaosat.vimaru.edu.vn/survey/${campaign.id}`,
    });
  };

  const handleSurveySubmitted = () => {
    setSurveyCounters((prev) => ({
      totalResponses: prev.totalResponses + 1,
      qrScanCount: prev.qrScanCount + 1,
    }));
  };

  // Render Student View Mode
  if (isStudentView) {
    return (
      <div className="student-survey-shell">
        <StudentSurveyView
          criteria={criteria}
          onCloseStudentView={() => setIsStudentView(false)}
          onSurveySubmitted={handleSurveySubmitted}
        />
      </div>
    );
  }

  // Render Main Dashboard Layout
  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        activeCampaignsCount={stats.activeCampaigns}
        canManageUsers={canManageUsers}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          currentTab={currentTab}
          onOpenStudentView={() => setIsStudentView(true)}
          user={auth.user!}
          activeProfile={auth.activeProfile!}
          availableProfiles={auth.availableProfiles}
          onSwitchProfile={auth.switchProfile}
          onLogout={auth.logout}
        />

        <main className="content-area">
          {currentTab === 'overview' && (
            <DashboardOverview
              stats={stats}
              campaigns={campaigns}
              onOpenQR={handleOpenCampaignQR}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'progress' && (
            <SurveyProgressPage
              sections={sections}
              courses={courses}
              lecturers={lecturers}
            />
          )}

          {currentTab === 'faculties' && (
            <FacultiesPage
              faculties={faculties}
              majors={majors}
              departments={departments}
              onSaveFaculty={handleSaveFaculty}
              onDeleteFaculty={handleDeleteFaculty}
              onImportFaculties={handleImportFaculties}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentsPage
              departments={departments}
              faculties={faculties}
              courses={courses}
              lecturers={lecturers}
              onSaveDepartment={handleSaveDepartment}
              onDeleteDepartment={handleDeleteDepartment}
              onImportDepartments={handleImportDepartments}
            />
          )}

          {currentTab === 'lecturers' && (
            <LecturersPage
              lecturers={lecturers}
              faculties={faculties}
              departments={departments}
              onSaveLecturer={handleSaveLecturer}
              onDeleteLecturer={handleDeleteLecturer}
              onImportLecturers={handleImportLecturers}
            />
          )}

          {currentTab === 'majors' && (
            <MajorsPage
              majors={majors}
              faculties={faculties}
              curricula={curricula}
              curriculumCourses={curriculumCourses}
              sections={sections}
              onSaveMajor={handleSaveMajor}
              onDeleteMajor={handleDeleteMajor}
              onImportMajors={handleImportMajors}
            />
          )}

          {currentTab === 'courses' && (
            <CoursesPage
              courses={courses}
              faculties={faculties}
              departments={departments}
              onSaveCourse={handleSaveCourse}
              onDeleteCourse={handleDeleteCourse}
              onImportCourses={handleImportCourses}
            />
          )}

          {currentTab === 'classes' && (
            <ClassesPage courses={courses} lecturers={lecturers} />
          )}

          {(currentTab === 'course-question-sets' || currentTab === 'criteria') && (
            <SurveyTemplatesPage />
          )}

          {currentTab === 'program-criteria' && (
            <CriteriaPage
              criteria={criteria}
              surveyType="Chương trình đào tạo"
              onAddCriterion={handleAddCriterion}
              onDeleteCriterion={handleDeleteCriterion}
            />
          )}

          {(currentTab === 'course-campaigns' || currentTab === 'campaigns') && (
            <CourseSurveysPage />
          )}

          {currentTab === 'program-campaigns' && (
            <CampaignsPage
              campaigns={campaigns}
              majors={majors}
              sections={sections}
              courses={courses}
              lecturers={lecturers}
              criteria={criteria}
              surveyType="Chương trình đào tạo"
              onAddCampaign={handleAddCampaign}
              onAddMultipleCampaigns={handleAddMultipleCampaigns}
              onDeleteCampaign={handleDeleteCampaign}
              onUpdateCampaignDates={handleUpdateCampaignDates}
              onOpenQR={handleOpenCampaignQR}
            />
          )}

          {currentTab === 'users-admin' && canManageUsers && <UsersAdminPage />}
        </main>
      </div>

      {/* Shared QR Code Modal */}
      <QRCodeModal
        isOpen={qrModalData.isOpen}
        onClose={() => setQrModalData((prev) => ({ ...prev, isOpen: false }))}
        title={qrModalData.title}
        subtitle={qrModalData.subtitle}
        qrUrl={qrModalData.qrUrl}
        surveyLink={qrModalData.surveyLink}
        onOpenSurveySimulator={() => {
          setIsStudentView(true);
        }}
      />
    </div>
  );
}

export function App() {
  const auth = useAuth();
  const isProfileSelection = window.location.pathname === '/select-profile';

  // Link và mã QR của từng lớp học phần trỏ vào /survey/{LinkToken}. Sinh viên
  // làm bài ẩn danh nên màn hình này đứng trước mọi bước kiểm tra đăng nhập.
  const publicSurveyToken = window.location.pathname.startsWith('/survey/')
    ? decodeURIComponent(window.location.pathname.slice('/survey/'.length))
    : '';
  if (publicSurveyToken) {
    return <PublicSurveyPage linkToken={publicSurveyToken} />;
  }

  if (auth.status === 'loading') {
    return <AuthLoading />;
  }

  if (isProfileSelection && auth.status !== 'authenticated') {
    return <ProfileSelectionPage />;
  }

  if (auth.status !== 'authenticated') {
    return <LoginPage />;
  }

  return <DashboardApp />;
}

export default App;
