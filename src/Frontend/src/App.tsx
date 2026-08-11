import { useState } from 'react';

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
import { CampaignsPage } from './pages/CampaignsPage';
import { SurveyProgressPage } from './pages/SurveyProgressPage';
import { StudentSurveyView } from './pages/StudentSurveyView';

// Mock Data & Types
import {
  initialStats,
  initialFaculties,
  initialDepartments,
  initialLecturers,
  initialMajors,
  initialCourses,
  initialClasses,
  initialCriteria,
  initialCampaigns,
} from './services/mockData';
import type {
  Faculty,
  Department,
  Lecturer,
  ClassGroup,
  Major,
  Course,
  CourseClass,
  Criterion,
  SurveyCampaign,
} from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isStudentView, setIsStudentView] = useState<boolean>(false);

  // System Catalog States
  const [stats, setStats] = useState(initialStats);
  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [lecturers, setLecturers] = useState<Lecturer[]>(initialLecturers);
  const [majors, setMajors] = useState<Major[]>(initialMajors);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [classes, setClasses] = useState<CourseClass[]>(initialClasses);
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>(initialCampaigns);

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

  // Handlers for Faculty
  const handleAddFaculty = (newFaculty: Faculty) => {
    setFaculties((prev) => [newFaculty, ...prev]);
    setStats((prev) => ({ ...prev, totalFaculties: prev.totalFaculties + 1 }));
  };
  const handleDeleteFaculty = (id: string) => {
    setFaculties((prev) => prev.filter((f) => f.id !== id));
    setStats((prev) => ({ ...prev, totalFaculties: Math.max(0, prev.totalFaculties - 1) }));
  };

  // Handlers for Major
  const handleAddMajor = (newMajor: Major) => {
    setMajors((prev) => [newMajor, ...prev]);
    setStats((prev) => ({ ...prev, totalMajors: prev.totalMajors + 1 }));
  };
  const handleDeleteMajor = (id: string) => {
    setMajors((prev) => prev.filter((m) => m.id !== id));
    setStats((prev) => ({ ...prev, totalMajors: Math.max(0, prev.totalMajors - 1) }));
  };

  // Handlers for Course
  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev]);
    setStats((prev) => ({ ...prev, totalCourses: prev.totalCourses + 1 }));
  };
  const handleDeleteCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setStats((prev) => ({ ...prev, totalCourses: Math.max(0, prev.totalCourses - 1) }));
  };

  // Handlers for Class
  const handleAddClass = (newClass: CourseClass) => {
    setClasses((prev) => [newClass, ...prev]);
    setStats((prev) => ({ ...prev, totalClasses: prev.totalClasses + 1 }));
  };
  const handleDeleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setStats((prev) => ({ ...prev, totalClasses: Math.max(0, prev.totalClasses - 1) }));
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
    setStats((prev) => ({ ...prev, activeCampaigns: prev.activeCampaigns + 1 }));
  };
  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setStats((prev) => ({ ...prev, activeCampaigns: Math.max(0, prev.activeCampaigns - 1) }));
  };

  const handleAddMultipleCampaigns = (newCampaigns: SurveyCampaign[]) => {
    setCampaigns((prev) => [...newCampaigns, ...prev]);
  };

  const handleUpdateCampaignDates = (id: string, startDate: string, endDate: string) => {
    setCampaigns((prev) =>
      prev.map((cmp) => (cmp.id === id ? { ...cmp, startDate, endDate } : cmp))
    );
  };

  const handleAddClassGroup = (classId: string, group: ClassGroup) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, groups: [...(c.groups || []), group] }
          : c
      )
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
    setStats((prev) => ({
      ...prev,
      totalResponses: prev.totalResponses + 1,
      qrScanCount: prev.qrScanCount + 1,
    }));
  };

  // Render Student View Mode
  if (isStudentView) {
    return (
      <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '40px' }}>
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
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          currentTab={currentTab}
          onOpenStudentView={() => setIsStudentView(true)}
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
              classes={classes}
            />
          )}

          {currentTab === 'faculties' && (
            <FacultiesPage
              faculties={faculties}
              onAddFaculty={handleAddFaculty}
              onDeleteFaculty={handleDeleteFaculty}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentsPage
              departments={departments}
              faculties={faculties}
              onAddDepartment={(newDept) => setDepartments((prev) => [newDept, ...prev])}
              onDeleteDepartment={(id) => setDepartments((prev) => prev.filter((d) => d.id !== id))}
            />
          )}

          {currentTab === 'lecturers' && (
            <LecturersPage
              lecturers={lecturers}
              faculties={faculties}
              departments={departments}
              onAddLecturer={(newLec) => setLecturers((prev) => [newLec, ...prev])}
              onDeleteLecturer={(id) => setLecturers((prev) => prev.filter((l) => l.id !== id))}
            />
          )}

          {currentTab === 'majors' && (
            <MajorsPage
              majors={majors}
              faculties={faculties}
              onAddMajor={handleAddMajor}
              onDeleteMajor={handleDeleteMajor}
            />
          )}

          {currentTab === 'courses' && (
            <CoursesPage
              courses={courses}
              faculties={faculties}
              onAddCourse={handleAddCourse}
              onDeleteCourse={handleDeleteCourse}
            />
          )}

          {currentTab === 'classes' && (
            <ClassesPage
              classes={classes}
              courses={courses}
              lecturers={lecturers}
              onAddClass={handleAddClass}
              onDeleteClass={handleDeleteClass}
              onAddClassGroup={handleAddClassGroup}
            />
          )}

          {(currentTab === 'course-criteria' || currentTab === 'criteria') && (
            <CriteriaPage
              criteria={criteria}
              surveyType="Học phần"
              onAddCriterion={handleAddCriterion}
              onDeleteCriterion={handleDeleteCriterion}
            />
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
            <CampaignsPage
              campaigns={campaigns}
              majors={majors}
              classes={classes}
              criteria={criteria}
              surveyType="Học phần"
              onAddCampaign={handleAddCampaign}
              onAddMultipleCampaigns={handleAddMultipleCampaigns}
              onDeleteCampaign={handleDeleteCampaign}
              onUpdateCampaignDates={handleUpdateCampaignDates}
              onOpenQR={handleOpenCampaignQR}
            />
          )}

          {currentTab === 'program-campaigns' && (
            <CampaignsPage
              campaigns={campaigns}
              majors={majors}
              classes={classes}
              criteria={criteria}
              surveyType="Chương trình đào tạo"
              onAddCampaign={handleAddCampaign}
              onAddMultipleCampaigns={handleAddMultipleCampaigns}
              onDeleteCampaign={handleDeleteCampaign}
              onUpdateCampaignDates={handleUpdateCampaignDates}
              onOpenQR={handleOpenCampaignQR}
            />
          )}
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

export default App;
