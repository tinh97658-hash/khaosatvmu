using API.Auth;
using Application.Surveys;
using Domain;
using Microsoft.AspNetCore.Mvc;

namespace API.Surveys;

public static class SurveyEndpoints
{
    public static IEndpointRouteBuilder MapSurveyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var questionSetGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.CourseQuestionSetsAccess);
        var campaignGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.CourseCampaignsAccess);
        var operationalReadGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.SurveyOperationalRead);
        // Nhóm Báo cáo tách theo từng trang: mỗi trang một quyền riêng để quản trị
        // viên bật/tắt độc lập trong màn hình Phân quyền Module.
        var surveyDashboardGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.SurveyDashboardAccess);
        // Trang bảng dữ liệu khảo sát và nút tính điểm theo mẻ.
        var surveyStatisticsGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.SurveyStatisticsAccess);
        var surveyAnalysisGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.SurveyAnalysisAccess);
        // Endpoint dùng chung cho bảng điều khiển, mở cho mọi quyền nhóm Báo cáo.
        var reportingReadGroup = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.ReportingRead);

        // --------------------------------------------------------- Answer scales

        questionSetGroup.MapGet("/answer-scales", async (
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAnswerScalesAsync(cancellationToken)));

        questionSetGroup.MapPost("/answer-scales", async (
            SaveAnswerScaleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateAnswerScaleAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        questionSetGroup.MapPut("/answer-scales/{answerScaleId:int}", async (
            int answerScaleId,
            SaveAnswerScaleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateAnswerScaleAsync(
                answerScaleId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        questionSetGroup.MapDelete("/answer-scales/{answerScaleId:int}", async (
            int answerScaleId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteAnswerScaleAsync(answerScaleId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------ Survey templates

        questionSetGroup.MapGet("/templates", async (
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetSurveyTemplatesAsync(cancellationToken)));

        questionSetGroup.MapPost("/templates", async (
            SaveSurveyTemplateRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateSurveyTemplateAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        questionSetGroup.MapPut("/templates/{surveyTemplateId:int}", async (
            int surveyTemplateId,
            SaveSurveyTemplateRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateSurveyTemplateAsync(
                surveyTemplateId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        questionSetGroup.MapDelete("/templates/{surveyTemplateId:int}", async (
            int surveyTemplateId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteSurveyTemplateAsync(surveyTemplateId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------- Đợt khảo sát theo học kỳ

        operationalReadGroup.MapGet("/semester-surveys", async (
            int? semesterId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetSemesterSurveysAsync(semesterId, cancellationToken)));

        campaignGroup.MapPost("/semester-surveys", async (
            CreateSemesterSurveyRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateSemesterSurveyAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        campaignGroup.MapDelete("/semester-surveys/{semesterSurveyId:int}", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteSemesterSurveyAsync(semesterSurveyId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        operationalReadGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/sections", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCourseSectionSurveysAsync(semesterSurveyId, cancellationToken)));

        operationalReadGroup.MapGet("/course-section-surveys/{courseSectionSurveyId:int}", async (
            int courseSectionSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetCourseSectionSurveyAsync(courseSectionSurveyId, cancellationToken)));

        operationalReadGroup.MapGet("/course-section-surveys/{courseSectionSurveyId:int}/responses", async (
            int courseSectionSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSurveyResponsesAsync(courseSectionSurveyId, cancellationToken)));

        operationalReadGroup.MapGet("/responses/{responseId:int}", async (
            int responseId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSurveyResponseAsync(responseId, cancellationToken)));

        campaignGroup.MapPut("/course-section-surveys/{courseSectionSurveyId:int}/schedule", async (
            int courseSectionSurveyId,
            SaveSurveyScheduleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateCourseSectionSurveyScheduleAsync(
                courseSectionSurveyId,
                new SaveSurveyScheduleCommand(request.StartTime, request.EndTime),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------- Thống kê điểm

        surveyStatisticsGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/statistics", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyStatisticsAsync(semesterSurveyId, cancellationToken)));

        surveyAnalysisGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/normalization", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyNormalizationAsync(semesterSurveyId, cancellationToken)));

        surveyAnalysisGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/department-summary", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyDepartmentSummaryAsync(semesterSurveyId, cancellationToken)));

        // Dải chỉ số gọn cho bảng điều khiển riêng của trưởng bộ môn. Số của bộ môn
        // kèm số toàn trường để so; mặt bằng vẫn tính trên toàn bộ dữ liệu.
        reportingReadGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/department-dashboard", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetDepartmentDashboardAsync(semesterSurveyId, cancellationToken)));

        surveyDashboardGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/dashboard", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyDashboardAsync(semesterSurveyId, cancellationToken)));

        surveyAnalysisGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/course-diagnosis", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyCourseDiagnosisAsync(semesterSurveyId, cancellationToken)));

        surveyAnalysisGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/lecturers", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSemesterSurveyLecturersAsync(semesterSurveyId, cancellationToken)));

        surveyAnalysisGroup.MapGet("/semester-surveys/{semesterSurveyId:int}/lecturers/{lecturerId:int}", async (
            int semesterSurveyId,
            int lecturerId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetLecturerSurveyReportAsync(semesterSurveyId, lecturerId, cancellationToken)));

        // Tính lại theo mẻ, chỉ chạy khi quản trị bấm nút.
        surveyStatisticsGroup.MapPost("/semester-surveys/{semesterSurveyId:int}/recalculate-scores", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.RecalculateSemesterSurveyScoresAsync(semesterSurveyId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // Phiếu của sinh viên: mở bằng link hoặc mã QR nên không yêu cầu đăng nhập.
        var publicGroup = endpoints.MapGroup("/api/public/surveys")
            .AllowAnonymous();

        publicGroup.MapGet("/{linkToken}", async (
            string linkToken,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetPublicSurveyAsync(linkToken, cancellationToken)))
            .RequireRateLimiting("PublicSurveyConcurrency");

        // Cú bấm "Bắt đầu làm bài" là mốc tính thời gian làm bài. Không cache
        // được vì mỗi sinh viên phải nhận một vé riêng, và cũng không lưu gì.
        publicGroup.MapPost("/{linkToken}/start", async (
            string linkToken,
            ISurveyService service,
            [FromServices] SurveyStartTicket ticket,
            CancellationToken cancellationToken) =>
        {
            // Vẫn phải kiểm link có thật và còn mở, tránh phát vé cho link rác.
            var survey = await service.GetPublicSurveyAsync(linkToken, cancellationToken);
            if (!survey.Succeeded || survey.Value is not { } value)
            {
                return ToResult(survey);
            }
            if (!value.IsOpen)
            {
                return Results.Json(
                    new { errorCode = SurveyErrorCodes.LinkNotOpen },
                    statusCode: StatusCodes.Status409Conflict);
            }

            return Results.Ok(new StartSurveyResponse(ticket.Issue(linkToken, DateTime.UtcNow)));
        }).RequireRateLimiting("PublicSurveyStart");

        publicGroup.MapPost("/{linkToken}/responses", async (
            string linkToken,
            SubmitSurveyResponseRequest request,
            ISurveyService service,
            [FromServices] SurveyStartTicket ticket,
            CancellationToken cancellationToken) =>
            ToResult(await service.SubmitSurveyResponseAsync(
                linkToken,
                request.ToCommand(
                    // Vé thiếu, sai chữ ký hay của lớp khác đều quy về 0 giây,
                    // để luật TOO_FAST của bộ lọc tự bắt.
                    ticket.ElapsedSeconds(request.StartTicket, linkToken, DateTime.UtcNow)),
                cancellationToken)))
            .RequireRateLimiting("PublicSurveySubmission");

        // ------------------------------------------------------------ Restore

        questionSetGroup.MapPatch("/answer-scales/{answerScaleId:int}/restore", async (
            int answerScaleId, ISurveyService service, CancellationToken ct) =>
            ToResult(await service.RestoreAnswerScaleAsync(answerScaleId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        questionSetGroup.MapPatch("/survey-templates/{surveyTemplateId:int}/restore", async (
            int surveyTemplateId, ISurveyService service, CancellationToken ct) =>
            ToResult(await service.RestoreSurveyTemplateAsync(surveyTemplateId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        campaignGroup.MapPatch("/semester-surveys/{semesterSurveyId:int}/restore", async (
            int semesterSurveyId, ISurveyService service, CancellationToken ct) =>
            ToResult(await service.RestoreSemesterSurveyAsync(semesterSurveyId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        return endpoints;
    }

    private static IResult ToResult<T>(SurveyOperationResult<T> result)
    {
        if (result.Succeeded && result.Value is not null)
        {
            return Results.Ok(result.Value);
        }

        var statusCode = result.ErrorCode switch
        {
            SurveyErrorCodes.OutOfScope => StatusCodes.Status403Forbidden,
            SurveyErrorCodes.AnswerScaleNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.TemplateNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SemesterNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SemesterSurveyNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SectionSurveyNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.LecturerHasNoSections => StatusCodes.Status404NotFound,
            SurveyErrorCodes.ResponseNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.LinkNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.QuestionScaleNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.AnswerScaleNameExists => StatusCodes.Status409Conflict,
            SurveyErrorCodes.TemplateNameExists => StatusCodes.Status409Conflict,
            SurveyErrorCodes.AnswerScaleInUse => StatusCodes.Status409Conflict,
            SurveyErrorCodes.AnswerScaleKindLocked => StatusCodes.Status409Conflict,
            SurveyErrorCodes.TemplateInUse => StatusCodes.Status409Conflict,
            SurveyErrorCodes.SemesterSurveyHasResponses => StatusCodes.Status409Conflict,
            SurveyErrorCodes.LinkNotOpen => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return Results.Json(new { errorCode = result.ErrorCode }, statusCode: statusCode);
    }

    public sealed record SaveAnswerScaleOptionRequest(int Value, string? DisplayText);

    public sealed record SaveAnswerScaleRequest(
        string AnswerScaleName,
        string? ScaleKind,
        IReadOnlyList<SaveAnswerScaleOptionRequest>? Options)
    {
        public SaveAnswerScaleCommand ToCommand() => new(
            AnswerScaleName,
            // Bỏ trống thì hiểu là thang có mức chọn, giữ tương thích với client cũ.
            string.IsNullOrWhiteSpace(ScaleKind) ? AnswerScaleKinds.Options : ScaleKind,
            Options?
                .Select(x => new SaveAnswerScaleOptionCommand(x.Value, x.DisplayText ?? string.Empty))
                .ToList() ?? []);
    }

    /// <summary>
    /// <paramref name="AttentionCheckValue"/> để trống là câu hỏi bình thường;
    /// điền một mức thì câu đó thành câu bẫy độ tập trung.
    /// </summary>
    public sealed record SaveSurveyQuestionRequest(
        string? QuestionText,
        int AnswerScaleId,
        int? AttentionCheckValue);

    public sealed record SaveSurveyTemplateRequest(
        string TemplateName,
        IReadOnlyList<SaveSurveyQuestionRequest>? Questions)
    {
        public SaveSurveyTemplateCommand ToCommand() => new(
            TemplateName,
            Questions?
                .Select(x => new SaveSurveyQuestionCommand(
                    x.QuestionText ?? string.Empty,
                    x.AnswerScaleId,
                    x.AttentionCheckValue))
                .ToList() ?? []);
    }

    public sealed record CreateSemesterSurveyRequest(
        int SemesterId,
        int SurveyTemplateId,
        DateTime StartTime,
        DateTime EndTime)
    {
        public CreateSemesterSurveyCommand ToCommand() =>
            new(SemesterId, SurveyTemplateId, StartTime, EndTime);
    }

    public sealed record SaveSurveyScheduleRequest(DateTime StartTime, DateTime EndTime);

    public sealed record SubmitSurveyAnswerRequest(int QuestionId, string? AnswerValue);

    /// <summary>Vé nhận được khi bấm "Bắt đầu làm bài".</summary>
    public sealed record StartSurveyResponse(string StartTicket);

    public sealed record SubmitSurveyResponseRequest(
        IReadOnlyList<SubmitSurveyAnswerRequest>? Answers,
        string? AdditionalComments,
        /// <summary>Vé lấy từ endpoint /start. Thiếu cũng nhận, phiếu sẽ bị lọc.</summary>
        string? StartTicket)
    {
        public SubmitSurveyResponseCommand ToCommand(double elapsedSeconds) => new(
            Answers?
                .Select(x => new SubmitSurveyAnswerCommand(x.QuestionId, x.AnswerValue ?? string.Empty))
                .ToList() ?? [],
            AdditionalComments,
            elapsedSeconds);
    }
}
