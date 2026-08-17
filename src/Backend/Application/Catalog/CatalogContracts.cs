namespace Application.Catalog;

public sealed record FacultyDto(int FacultyId, string FacultyName);

public sealed record DepartmentDto(int DepartmentId, string DepartmentName, int? FacultyId);

public sealed record MajorDto(int MajorId, string MajorName, int FacultyId);

public sealed record AcademicYearDto(
    int AcademicYearId,
    string AcademicYearName,
    DateOnly StartDate,
    DateOnly EndDate,
    IReadOnlyList<SemesterDto> Semesters);

public sealed record SemesterDto(int SemesterId, string SemesterName, int AcademicYearId);

public sealed record CourseSectionDto(
    int CourseSectionId,
    int CourseId,
    int SemesterId,
    int LecturerId,
    string SectionName,
    int ClassSize);

public sealed record SaveAcademicYearCommand(string AcademicYearName, DateOnly StartDate, DateOnly EndDate);

public sealed record SaveSemesterCommand(string SemesterName, int AcademicYearId);

public sealed record SaveCourseSectionCommand(
    int CourseId,
    int SemesterId,
    int LecturerId,
    string SectionName,
    int ClassSize);

/// <summary>
/// Một dòng lớp học phần trong tệp Excel. Học phần đi vào theo MÃ; giảng viên
/// tra theo email, hoặc theo họ tên thu hẹp bằng bộ môn và khoa viện.
/// </summary>
public sealed record ImportCourseSectionRowCommand(
    int RowNumber,
    string CourseCode,
    string SectionName,
    string? ClassSize,
    string? LecturerEmail,
    string? LecturerFullName,
    string? LecturerDepartmentName,
    string? LecturerFacultyName);

public sealed record LecturerDto(
    int LecturerId,
    string FullName,
    int? DepartmentId,
    int? FacultyId,
    string? Email,
    string? PhoneNumber);

public sealed record CourseDto(
    int CourseId,
    string CourseCode,
    string CourseName,
    int Credits,
    string CourseType,
    int? DepartmentId,
    int? FacultyId,
    int? PrerequisiteCourseId);

public sealed record SaveFacultyCommand(string FacultyName);

public sealed record SaveDepartmentCommand(string DepartmentName, int? FacultyId);

public sealed record SaveMajorCommand(string MajorName, int FacultyId);

public sealed record SaveLecturerCommand(
    string FullName,
    int? DepartmentId,
    int? FacultyId,
    string? Email,
    string? PhoneNumber);

public sealed record SaveCourseCommand(
    string CourseCode,
    string CourseName,
    int Credits,
    string CourseType,
    int? DepartmentId,
    int? FacultyId,
    int? PrerequisiteCourseId);

/// <summary>Một dòng của tệp Excel. Khoa viện đi vào theo TÊN, không phải theo id.</summary>
public sealed record ImportFacultyRowCommand(int RowNumber, string FacultyName);

public sealed record ImportDepartmentRowCommand(int RowNumber, string DepartmentName, string? FacultyName);

public sealed record ImportMajorRowCommand(int RowNumber, string MajorName, string? FacultyName);

/// <summary>Một dòng giảng viên trong tệp Excel. Khoa viện và bộ môn đi vào theo TÊN.</summary>
public sealed record ImportLecturerRowCommand(
    int RowNumber,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string? FacultyName,
    string? DepartmentName);

/// <summary>
/// Một dòng học phần trong tệp Excel. Khoa viện, bộ môn và học phần tiên quyết
/// đi vào theo TÊN / MÃ, được tra ngược ra id khi import.
/// </summary>
public sealed record ImportCourseRowCommand(
    int RowNumber,
    string CourseCode,
    string CourseName,
    string? Credits,
    string? CourseType,
    string? FacultyName,
    string? DepartmentName,
    string? PrerequisiteCourseCode);

public sealed record CatalogImportItemDto(int RowNumber, string Name, string? FacultyName, bool Succeeded, string? ErrorCode);

public sealed record CatalogImportDto(
    int TotalCount,
    int CreatedCount,
    int SkippedCount,
    IReadOnlyList<CatalogImportItemDto> Items);

public sealed record CatalogOperationResult<T>(bool Succeeded, string? ErrorCode, T? Value);

public interface ICatalogService
{
    Task<IReadOnlyList<FacultyDto>> GetFacultiesAsync(CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<FacultyDto>> CreateFacultyAsync(
        SaveFacultyCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<FacultyDto>> UpdateFacultyAsync(
        int facultyId,
        SaveFacultyCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteFacultyAsync(
        int facultyId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CatalogImportDto>> ImportFacultiesAsync(
        IReadOnlyList<ImportFacultyRowCommand> rows,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DepartmentDto>> GetDepartmentsAsync(CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<DepartmentDto>> CreateDepartmentAsync(
        SaveDepartmentCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<DepartmentDto>> UpdateDepartmentAsync(
        int departmentId,
        SaveDepartmentCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteDepartmentAsync(
        int departmentId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CatalogImportDto>> ImportDepartmentsAsync(
        IReadOnlyList<ImportDepartmentRowCommand> rows,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MajorDto>> GetMajorsAsync(CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<MajorDto>> CreateMajorAsync(
        SaveMajorCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<MajorDto>> UpdateMajorAsync(
        int majorId,
        SaveMajorCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteMajorAsync(
        int majorId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CatalogImportDto>> ImportMajorsAsync(
        IReadOnlyList<ImportMajorRowCommand> rows,
        CancellationToken cancellationToken = default);

    /// <summary>Danh sách năm học kèm học kỳ, dùng cho cây bên trái màn hình lớp học phần.</summary>
    Task<IReadOnlyList<AcademicYearDto>> GetAcademicYearsAsync(CancellationToken cancellationToken = default);

    /// <summary>Tạo năm học và tự sinh ba học kỳ mặc định.</summary>
    Task<CatalogOperationResult<AcademicYearDto>> CreateAcademicYearAsync(
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<AcademicYearDto>> UpdateAcademicYearAsync(
        int academicYearId,
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteAcademicYearAsync(
        int academicYearId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<SemesterDto>> CreateSemesterAsync(
        SaveSemesterCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<SemesterDto>> UpdateSemesterAsync(
        int semesterId,
        SaveSemesterCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteSemesterAsync(
        int semesterId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CourseSectionDto>> GetCourseSectionsAsync(
        int? semesterId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CourseSectionDto>> CreateCourseSectionAsync(
        SaveCourseSectionCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CourseSectionDto>> UpdateCourseSectionAsync(
        int courseSectionId,
        SaveCourseSectionCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteCourseSectionAsync(
        int courseSectionId,
        CancellationToken cancellationToken = default);

    /// <summary>Import lớp học phần vào một học kỳ đã chọn.</summary>
    Task<CatalogOperationResult<CatalogImportDto>> ImportCourseSectionsAsync(
        int semesterId,
        IReadOnlyList<ImportCourseSectionRowCommand> rows,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LecturerDto>> GetLecturersAsync(CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<LecturerDto>> CreateLecturerAsync(
        SaveLecturerCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<LecturerDto>> UpdateLecturerAsync(
        int lecturerId,
        SaveLecturerCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteLecturerAsync(
        int lecturerId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CatalogImportDto>> ImportLecturersAsync(
        IReadOnlyList<ImportLecturerRowCommand> rows,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CourseDto>> GetCoursesAsync(CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CourseDto>> CreateCourseAsync(
        SaveCourseCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CourseDto>> UpdateCourseAsync(
        int courseId,
        SaveCourseCommand command,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<bool>> DeleteCourseAsync(
        int courseId,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<CatalogImportDto>> ImportCoursesAsync(
        IReadOnlyList<ImportCourseRowCommand> rows,
        CancellationToken cancellationToken = default);

    Task<CatalogOperationResult<FacultyDto>> RestoreFacultyAsync(int facultyId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<DepartmentDto>> RestoreDepartmentAsync(int departmentId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<MajorDto>> RestoreMajorAsync(int majorId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<AcademicYearDto>> RestoreAcademicYearAsync(int academicYearId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<SemesterDto>> RestoreSemesterAsync(int semesterId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<CourseSectionDto>> RestoreCourseSectionAsync(int courseSectionId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<LecturerDto>> RestoreLecturerAsync(int lecturerId, CancellationToken cancellationToken = default);
    Task<CatalogOperationResult<CourseDto>> RestoreCourseAsync(int courseId, CancellationToken cancellationToken = default);
}

public static class CatalogErrorCodes
{
    public const string InvalidRequest = "CATALOG_INVALID_REQUEST";
    public const string ImportTooManyRows = "CATALOG_IMPORT_TOO_MANY_ROWS";

    public const string FacultyNotFound = "CATALOG_FACULTY_NOT_FOUND";
    public const string FacultyNameRequired = "CATALOG_FACULTY_NAME_REQUIRED";
    public const string FacultyNameExists = "CATALOG_FACULTY_NAME_EXISTS";
    public const string FacultyDuplicateInFile = "CATALOG_FACULTY_DUPLICATE_IN_FILE";
    public const string FacultyInUse = "CATALOG_FACULTY_IN_USE";

    public const string DepartmentNotFound = "CATALOG_DEPARTMENT_NOT_FOUND";
    public const string DepartmentNameRequired = "CATALOG_DEPARTMENT_NAME_REQUIRED";
    public const string DepartmentInUse = "CATALOG_DEPARTMENT_IN_USE";

    public const string MajorNotFound = "CATALOG_MAJOR_NOT_FOUND";
    public const string MajorNameRequired = "CATALOG_MAJOR_NAME_REQUIRED";
    public const string MajorFacultyRequired = "CATALOG_MAJOR_FACULTY_REQUIRED";

    public const string AcademicYearNotFound = "CATALOG_ACADEMIC_YEAR_NOT_FOUND";
    public const string AcademicYearNameRequired = "CATALOG_ACADEMIC_YEAR_NAME_REQUIRED";
    public const string AcademicYearNameExists = "CATALOG_ACADEMIC_YEAR_NAME_EXISTS";
    public const string AcademicYearRangeInvalid = "CATALOG_ACADEMIC_YEAR_RANGE_INVALID";

    public const string SemesterNotFound = "CATALOG_SEMESTER_NOT_FOUND";
    public const string SemesterNameRequired = "CATALOG_SEMESTER_NAME_REQUIRED";
    public const string SemesterNameExists = "CATALOG_SEMESTER_NAME_EXISTS";

    public const string CourseSectionNotFound = "CATALOG_COURSE_SECTION_NOT_FOUND";
    public const string CourseSectionNameRequired = "CATALOG_COURSE_SECTION_NAME_REQUIRED";
    public const string CourseSectionExists = "CATALOG_COURSE_SECTION_EXISTS";
    public const string CourseSectionSizeInvalid = "CATALOG_COURSE_SECTION_SIZE_INVALID";
    public const string CourseSectionDuplicateInFile = "CATALOG_COURSE_SECTION_DUPLICATE_IN_FILE";
    public const string SectionLecturerRequired = "CATALOG_SECTION_LECTURER_REQUIRED";
    public const string LecturerAmbiguous = "CATALOG_LECTURER_AMBIGUOUS";

    public const string LecturerNotFound = "CATALOG_LECTURER_NOT_FOUND";
    public const string LecturerNameRequired = "CATALOG_LECTURER_NAME_REQUIRED";
    public const string LecturerEmailExists = "CATALOG_LECTURER_EMAIL_EXISTS";
    public const string LecturerEmailDuplicateInFile = "CATALOG_LECTURER_EMAIL_DUPLICATE_IN_FILE";
    public const string LecturerInUse = "CATALOG_LECTURER_IN_USE";

    public const string CourseNotFound = "CATALOG_COURSE_NOT_FOUND";
    public const string CourseCodeRequired = "CATALOG_COURSE_CODE_REQUIRED";
    public const string CourseNameRequired = "CATALOG_COURSE_NAME_REQUIRED";
    public const string CourseCodeExists = "CATALOG_COURSE_CODE_EXISTS";
    public const string CourseDuplicateInFile = "CATALOG_COURSE_DUPLICATE_IN_FILE";
    public const string CourseCreditsInvalid = "CATALOG_COURSE_CREDITS_INVALID";
    public const string CourseTypeInvalid = "CATALOG_COURSE_TYPE_INVALID";
    public const string PrerequisiteNotFound = "CATALOG_PREREQUISITE_NOT_FOUND";
    public const string CourseInUse = "CATALOG_COURSE_IN_USE";
}
