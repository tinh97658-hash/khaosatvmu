using API.Auth;
using Application.Catalog;

namespace API.Catalog;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup("/api/catalog")
            .RequireAuthorization(AuthPolicies.SurveyManage);

        // ------------------------------------------------------------ Faculties

        group.MapGet("/faculties", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetFacultiesAsync(cancellationToken)));

        group.MapPost("/faculties", async (
            SaveFacultyRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateFacultyAsync(
                new SaveFacultyCommand(request.FacultyName),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/faculties/{facultyId:int}", async (
            int facultyId,
            SaveFacultyRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateFacultyAsync(
                facultyId,
                new SaveFacultyCommand(request.FacultyName),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/faculties/{facultyId:int}", async (
            int facultyId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteFacultyAsync(facultyId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/faculties/import", async (
            ImportFacultiesRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportFacultyRowCommand(x.RowNumber, x.FacultyName ?? string.Empty))
                .ToList() ?? [];
            return ToResult(await service.ImportFacultiesAsync(rows, cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // ---------------------------------------------------------- Departments

        group.MapGet("/departments", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetDepartmentsAsync(cancellationToken)));

        group.MapPost("/departments", async (
            SaveDepartmentRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateDepartmentAsync(
                new SaveDepartmentCommand(request.DepartmentId, request.DepartmentName, request.FacultyId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/departments/{departmentId:int}", async (
            int departmentId,
            SaveDepartmentRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateDepartmentAsync(
                departmentId,
                new SaveDepartmentCommand(departmentId, request.DepartmentName, request.FacultyId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/departments/{departmentId:int}", async (
            int departmentId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteDepartmentAsync(departmentId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/departments/import", async (
            ImportDepartmentsRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportDepartmentRowCommand(
                    x.RowNumber,
                    x.DepartmentId,
                    x.DepartmentName ?? string.Empty,
                    x.FacultyName))
                .ToList() ?? [];
            return ToResult(await service.ImportDepartmentsAsync(rows, cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------------ Positions

        group.MapGet("/positions", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetPositionsAsync(cancellationToken)));

        group.MapPost("/positions", async (
            SavePositionRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreatePositionAsync(
                new SavePositionCommand(request.PositionName),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/positions/{positionId:int}", async (
            int positionId,
            SavePositionRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdatePositionAsync(
                positionId,
                new SavePositionCommand(request.PositionName),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/positions/{positionId:int}", async (
            int positionId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeletePositionAsync(positionId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // --------------------------------------------------------------- Majors

        group.MapGet("/majors", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetMajorsAsync(cancellationToken)));

        group.MapPost("/majors", async (
            SaveMajorRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateMajorAsync(
                new SaveMajorCommand(request.MajorName, request.FacultyId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/majors/{majorId:int}", async (
            int majorId,
            SaveMajorRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateMajorAsync(
                majorId,
                new SaveMajorCommand(request.MajorName, request.FacultyId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/majors/{majorId:int}", async (
            int majorId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteMajorAsync(majorId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/majors/import", async (
            ImportMajorsRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportMajorRowCommand(
                    x.RowNumber,
                    x.MajorName ?? string.Empty,
                    x.FacultyName))
                .ToList() ?? [];
            return ToResult(await service.ImportMajorsAsync(rows, cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------- Năm học và học kỳ

        group.MapGet("/academic-years", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAcademicYearsAsync(cancellationToken)));

        group.MapPost("/academic-years", async (
            SaveAcademicYearRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateAcademicYearAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/academic-years/{academicYearId:int}", async (
            int academicYearId,
            SaveAcademicYearRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateAcademicYearAsync(
                academicYearId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/academic-years/{academicYearId:int}", async (
            int academicYearId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteAcademicYearAsync(academicYearId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/semesters", async (
            SaveSemesterRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateSemesterAsync(
                new SaveSemesterCommand(request.SemesterName, request.AcademicYearId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/semesters/{semesterId:int}", async (
            int semesterId,
            SaveSemesterRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateSemesterAsync(
                semesterId,
                new SaveSemesterCommand(request.SemesterName, request.AcademicYearId),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/semesters/{semesterId:int}", async (
            int semesterId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteSemesterAsync(semesterId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------- Lớp học phần

        group.MapGet("/course-sections", async (
            int? semesterId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCourseSectionsAsync(semesterId, cancellationToken)));

        group.MapPost("/course-sections", async (
            SaveCourseSectionRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateCourseSectionAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/course-sections/{courseSectionId:int}", async (
            int courseSectionId,
            SaveCourseSectionRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateCourseSectionAsync(
                courseSectionId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/course-sections/{courseSectionId:int}", async (
            int courseSectionId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteCourseSectionAsync(courseSectionId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/course-sections/import", async (
            ImportCourseSectionsRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportCourseSectionRowCommand(
                    x.RowNumber,
                    x.CourseCode ?? string.Empty,
                    x.CourseName,
                    x.SectionName ?? string.Empty,
                    x.Credits,
                    x.ClassSize,
                    x.DepartmentName,
                    x.DepartmentCode,
                    x.FacultyName,
                    x.LecturerFullName,
                    x.LecturerEmail))
                .ToList() ?? [];
            return ToResult(await service.ImportCourseSectionsAsync(
                request.SemesterId,
                rows,
                cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------------ Lecturers

        group.MapGet("/lecturers", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetLecturersAsync(cancellationToken)));

        group.MapPost("/lecturers", async (
            SaveLecturerRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateLecturerAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/lecturers/{lecturerId:int}", async (
            int lecturerId,
            SaveLecturerRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateLecturerAsync(lecturerId, request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/lecturers/{lecturerId:int}", async (
            int lecturerId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteLecturerAsync(lecturerId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/lecturers/import", async (
            ImportLecturersRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportLecturerRowCommand(
                    x.RowNumber,
                    x.FullName ?? string.Empty,
                    x.Email,
                    x.PhoneNumber,
                    x.FacultyName,
                    x.DepartmentName,
                    x.PositionName))
                .ToList() ?? [];
            return ToResult(await service.ImportLecturersAsync(rows, cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // -------------------------------------------------------------- Courses

        group.MapGet("/courses", async (
            ICatalogService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCoursesAsync(cancellationToken)));

        group.MapPost("/courses", async (
            SaveCourseRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateCourseAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/courses/{courseId:int}", async (
            int courseId,
            SaveCourseRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateCourseAsync(courseId, request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/courses/{courseId:int}", async (
            int courseId,
            ICatalogService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteCourseAsync(courseId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPost("/courses/import", async (
            ImportCoursesRequest request,
            ICatalogService service,
            CancellationToken cancellationToken) =>
        {
            var rows = request.Rows?
                .Select(x => new ImportCourseRowCommand(
                    x.RowNumber,
                    x.CourseCode ?? string.Empty,
                    x.CourseName ?? string.Empty,
                    x.Credits,
                    x.CourseType,
                    x.FacultyName,
                    x.DepartmentName,
                    x.PrerequisiteCourseCode))
                .ToList() ?? [];
            return ToResult(await service.ImportCoursesAsync(rows, cancellationToken));
        }).AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------------ Restore

        group.MapPatch("/faculties/{facultyId:int}/restore", async (
            int facultyId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreFacultyAsync(facultyId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/departments/{departmentId:int}/restore", async (
            int departmentId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreDepartmentAsync(departmentId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/majors/{majorId:int}/restore", async (
            int majorId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreMajorAsync(majorId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/academic-years/{academicYearId:int}/restore", async (
            int academicYearId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreAcademicYearAsync(academicYearId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/semesters/{semesterId:int}/restore", async (
            int semesterId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreSemesterAsync(semesterId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/course-sections/{courseSectionId:int}/restore", async (
            int courseSectionId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreCourseSectionAsync(courseSectionId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/lecturers/{lecturerId:int}/restore", async (
            int lecturerId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreLecturerAsync(lecturerId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/courses/{courseId:int}/restore", async (
            int courseId, ICatalogService service, CancellationToken ct) =>
            ToResult(await service.RestoreCourseAsync(courseId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        return endpoints;
    }

    private static IResult ToResult<T>(CatalogOperationResult<T> result)
    {
        if (result.Succeeded && result.Value is not null)
        {
            return Results.Ok(result.Value);
        }

        var statusCode = result.ErrorCode switch
        {
            CatalogErrorCodes.FacultyNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.DepartmentNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.MajorNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.PositionNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.PositionNameExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.DepartmentCodeInvalid => StatusCodes.Status400BadRequest,
            CatalogErrorCodes.CourseNameRequiredForAutoCreate => StatusCodes.Status400BadRequest,
            CatalogErrorCodes.CourseNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.LecturerNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.AcademicYearNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.SemesterNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.CourseSectionNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.AcademicYearNameExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.SemesterNameExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.CourseSectionExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.LecturerAmbiguous => StatusCodes.Status409Conflict,
            CatalogErrorCodes.PrerequisiteNotFound => StatusCodes.Status404NotFound,
            CatalogErrorCodes.FacultyNameExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.CourseCodeExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.LecturerEmailExists => StatusCodes.Status409Conflict,
            CatalogErrorCodes.LecturerInUse => StatusCodes.Status409Conflict,
            CatalogErrorCodes.FacultyInUse => StatusCodes.Status409Conflict,
            CatalogErrorCodes.DepartmentInUse => StatusCodes.Status409Conflict,
            CatalogErrorCodes.CourseInUse => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return Results.Json(new { errorCode = result.ErrorCode }, statusCode: statusCode);
    }

    public sealed record SaveFacultyRequest(string FacultyName);

    public sealed record SaveDepartmentRequest(int DepartmentId, string DepartmentName, int? FacultyId);

    public sealed record SavePositionRequest(string PositionName);

    public sealed record SaveMajorRequest(string MajorName, int FacultyId);

    public sealed record ImportFacultiesRequest(IReadOnlyList<ImportFacultyRowRequest>? Rows);

    public sealed record ImportFacultyRowRequest(int RowNumber, string FacultyName);

    public sealed record ImportDepartmentsRequest(IReadOnlyList<ImportDepartmentRowRequest>? Rows);

    public sealed record ImportDepartmentRowRequest(int RowNumber, int DepartmentId, string DepartmentName, string? FacultyName);

    public sealed record ImportMajorsRequest(IReadOnlyList<ImportMajorRowRequest>? Rows);

    public sealed record ImportMajorRowRequest(int RowNumber, string MajorName, string? FacultyName);

    public sealed record SaveAcademicYearRequest(
        string AcademicYearName,
        DateOnly StartDate,
        DateOnly EndDate)
    {
        public SaveAcademicYearCommand ToCommand() => new(AcademicYearName, StartDate, EndDate);
    }

    public sealed record SaveSemesterRequest(string SemesterName, int AcademicYearId);

    public sealed record SaveCourseSectionRequest(
        int CourseId,
        int SemesterId,
        int? LecturerId,
        string SectionName,
        int ClassSize,
        string? UnidentifiedLecturerName)
    {
        public SaveCourseSectionCommand ToCommand() =>
            new(CourseId, SemesterId, LecturerId, SectionName, ClassSize, UnidentifiedLecturerName);
    }

    public sealed record ImportCourseSectionsRequest(
        int SemesterId,
        IReadOnlyList<ImportCourseSectionRowRequest>? Rows);

    /// <summary>Các trường tương ứng cột trong tệp Excel gốc của đơn vị đào tạo.</summary>
    public sealed record ImportCourseSectionRowRequest(
        int RowNumber,
        string CourseCode,
        string? CourseName,
        string SectionName,
        string? Credits,
        string? ClassSize,
        string? DepartmentName,
        string? DepartmentCode,
        string? FacultyName,
        string? LecturerFullName,
        string? LecturerEmail);

    public sealed record SaveLecturerRequest(
        string FullName,
        int? DepartmentId,
        int? FacultyId,
        string? Email,
        string? PhoneNumber,
        int? PositionId)
    {
        public SaveLecturerCommand ToCommand() => new(
            FullName,
            DepartmentId,
            FacultyId,
            Email,
            PhoneNumber,
            PositionId);
    }

    public sealed record ImportLecturersRequest(IReadOnlyList<ImportLecturerRowRequest>? Rows);

    public sealed record ImportLecturerRowRequest(
        int RowNumber,
        string FullName,
        string? Email,
        string? PhoneNumber,
        string? FacultyName,
        string? DepartmentName,
        string? PositionName);

    public sealed record SaveCourseRequest(
        string CourseCode,
        string CourseName,
        int Credits,
        string? CourseType,
        int? DepartmentId,
        int? FacultyId,
        int? PrerequisiteCourseId)
    {
        public SaveCourseCommand ToCommand() => new(
            CourseCode,
            CourseName,
            Credits,
            CourseType,
            DepartmentId,
            FacultyId,
            PrerequisiteCourseId);
    }

    public sealed record ImportCoursesRequest(IReadOnlyList<ImportCourseRowRequest>? Rows);

    public sealed record ImportCourseRowRequest(
        int RowNumber,
        string CourseCode,
        string CourseName,
        string? Credits,
        string? CourseType,
        string? FacultyName,
        string? DepartmentName,
        string? PrerequisiteCourseCode);
}
