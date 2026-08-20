using API.Auth;
using Application.Reports;

namespace API.Reports;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .RequireAuthorization(AuthPolicies.ReportsAccess);

        group.MapGet("/operational-progress", async (
            int semesterId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetOperationalProgressReportAsync(semesterId, cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        group.MapGet("/lecturers", async (
            int? facultyId,
            int? departmentId,
            int? semesterId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var reports = await reportService.GetLecturerPerformanceReportsAsync(facultyId, departmentId, semesterId, cancellationToken);
            return Results.Ok(reports);
        });

        group.MapGet("/lecturers/{lecturerId:int}", async (
            int lecturerId,
            int? semesterId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetLecturerPerformanceReportAsync(lecturerId, semesterId, cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        group.MapGet("/faculties", async (
            int? semesterId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var reports = await reportService.GetFacultyDepartmentReportsAsync(semesterId, cancellationToken);
            return Results.Ok(reports);
        });

        group.MapGet("/question-analysis", async (
            int semesterSurveyId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetQuestionAnalysisReportAsync(semesterSurveyId, cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        group.MapGet("/section-analysis", async (
            int courseSectionSurveyId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetSectionSurveyAnalysisAsync(courseSectionSurveyId, cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        group.MapGet("/school-overview", async (
            int semesterId,
            int? comparisonSemesterId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetSchoolSurveyOverviewAsync(
                semesterId,
                comparisonSemesterId,
                cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        group.MapGet("/results", async (
            int? semesterId,
            int? facultyId,
            int? departmentId,
            int? lecturerId,
            int? semesterSurveyId,
            string? search,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var results = await reportService.GetSurveyResultsAsync(
                semesterId,
                facultyId,
                departmentId,
                lecturerId,
                semesterSurveyId,
                search,
                cancellationToken);
            return Results.Ok(results);
        });

        return app;
    }
}
