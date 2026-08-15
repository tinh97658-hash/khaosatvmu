namespace Domain;

/// <summary>Bảng "Faculties".</summary>
public sealed class Faculty
{
    public int FacultyId { get; set; }
    public string FacultyName { get; set; } = string.Empty;
}

/// <summary>Bảng "Departments".</summary>
public sealed class Department
{
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;

    /// <summary>Nullable: bộ môn có thể chưa gắn khoa viện (ON DELETE SET NULL).</summary>
    public int? FacultyId { get; set; }
}

/// <summary>Bảng "Majors".</summary>
public sealed class Major
{
    public int MajorId { get; set; }
    public string MajorName { get; set; } = string.Empty;

    /// <summary>NOT NULL: ngành học luôn thuộc một khoa viện (ON DELETE CASCADE).</summary>
    public int FacultyId { get; set; }
}

/// <summary>Bảng "AcademicYears".</summary>
public sealed class AcademicYear
{
    public int AcademicYearId { get; set; }

    /// <summary>UNIQUE, vd '2025-2026'.</summary>
    public string AcademicYearName { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}

/// <summary>Bảng "Semesters". UNIQUE theo (AcademicYearId, SemesterName).</summary>
public sealed class Semester
{
    public int SemesterId { get; set; }
    public string SemesterName { get; set; } = string.Empty;

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int AcademicYearId { get; set; }
}

/// <summary>Bảng "CourseSections". UNIQUE theo (CourseId, SemesterId, SectionName).</summary>
public sealed class CourseSection
{
    public int CourseSectionId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int CourseId { get; set; }

    /// <summary>NOT NULL, ON DELETE CASCADE.</summary>
    public int SemesterId { get; set; }

    /// <summary>NOT NULL: mỗi lớp học phần có đúng một giảng viên (ON DELETE RESTRICT).</summary>
    public int LecturerId { get; set; }

    public string SectionName { get; set; } = string.Empty;
    public int ClassSize { get; set; }
}

/// <summary>Bảng "Lecturers". Giảng viên đăng nhập bằng Gmail, không qua Accounts.</summary>
public sealed class Lecturer
{
    public int LecturerId { get; set; }
    public string FullName { get; set; } = string.Empty;

    /// <summary>Nullable, ON DELETE RESTRICT.</summary>
    public int? DepartmentId { get; set; }

    /// <summary>Nullable, ON DELETE RESTRICT.</summary>
    public int? FacultyId { get; set; }

    /// <summary>Nullable. UNIQUE: PostgreSQL coi các NULL là khác nhau nên nhiều dòng bỏ trống vẫn hợp lệ.</summary>
    public string? Email { get; set; }

    public string? PhoneNumber { get; set; }
}

/// <summary>Bảng "Courses".</summary>
public sealed class Course
{
    public int CourseId { get; set; }

    /// <summary>Mã học phần nhập tay, vd '19783'. UNIQUE.</summary>
    public string CourseCode { get; set; } = string.Empty;

    public string CourseName { get; set; } = string.Empty;
    public int Credits { get; set; }

    /// <summary>Required | Elective. Cột có DEFAULT ''.</summary>
    public string CourseType { get; set; } = string.Empty;

    public int? DepartmentId { get; set; }
    public int? FacultyId { get; set; }

    /// <summary>Tự tham chiếu, tối đa một học phần tiên quyết (ON DELETE RESTRICT).</summary>
    public int? PrerequisiteCourseId { get; set; }
}
