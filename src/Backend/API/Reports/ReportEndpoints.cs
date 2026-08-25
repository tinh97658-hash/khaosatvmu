using API.Auth;
using Application.Reports;

namespace API.Reports;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .RequireAuthorization(AuthPolicies.ReportsAccess);

        // Nhóm riêng cho từng tab của module Thống kê & Báo cáo. Vào được module
        // chưa đủ: mỗi tab đòi thêm đúng quyền của tab đó.
        var overviewTabGroup = app.MapGroup("/api/v1/reports")
            .RequireAuthorization(AuthPolicies.ReportsAccess, AuthPolicies.ReportsOverviewAccess);

        // Tra cứu chi tiết và Tổng hợp đơn vị đọc chung một tập kết quả nên nhận
        // một trong hai quyền; không có quyền nào thì chặn.
        var resultsTabGroup = app.MapGroup("/api/v1/reports")
            .RequireAuthorization(AuthPolicies.ReportsAccess, AuthPolicies.ReportsResultsRead);

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

        overviewTabGroup.MapGet("/school-overview", async (
            int semesterId,
            int? comparisonSemesterId,
            int? semesterSurveyId,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var report = await reportService.GetSchoolSurveyOverviewAsync(
                semesterId,
                comparisonSemesterId,
                semesterSurveyId,
                cancellationToken);
            return report is null ? Results.NotFound() : Results.Ok(report);
        });

        overviewTabGroup.MapGet("/question-ranking", async (
            int semesterId,
            int? semesterSurveyId,
            int? count,
            bool? lowest,
            IReportService reportService,
            CancellationToken cancellationToken) =>
        {
            var questions = await reportService.GetQuestionRankingAsync(
                semesterId,
                semesterSurveyId,
                count ?? 5,
                lowest ?? true,
                cancellationToken);
            return Results.Ok(questions);
        });

        resultsTabGroup.MapGet("/results", async (
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
