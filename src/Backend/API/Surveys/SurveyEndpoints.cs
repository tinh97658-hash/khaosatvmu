using API.Auth;
using Application.Surveys;

namespace API.Surveys;

public static class SurveyEndpoints
{
    public static IEndpointRouteBuilder MapSurveyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints
            .MapGroup("/api/surveys")
            .RequireAuthorization(AuthPolicies.SurveyManage);

        // --------------------------------------------------------- Answer scales

        group.MapGet("/answer-scales", async (
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetAnswerScalesAsync(cancellationToken)));

        group.MapPost("/answer-scales", async (
            SaveAnswerScaleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateAnswerScaleAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/answer-scales/{answerScaleId:int}", async (
            int answerScaleId,
            SaveAnswerScaleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateAnswerScaleAsync(
                answerScaleId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/answer-scales/{answerScaleId:int}", async (
            int answerScaleId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteAnswerScaleAsync(answerScaleId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------------------ Survey templates

        group.MapGet("/templates", async (
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetSurveyTemplatesAsync(cancellationToken)));

        group.MapPost("/templates", async (
            SaveSurveyTemplateRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateSurveyTemplateAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPut("/templates/{surveyTemplateId:int}", async (
            int surveyTemplateId,
            SaveSurveyTemplateRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateSurveyTemplateAsync(
                surveyTemplateId,
                request.ToCommand(),
                cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/templates/{surveyTemplateId:int}", async (
            int surveyTemplateId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteSurveyTemplateAsync(surveyTemplateId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        // ------------------------------------------- Đợt khảo sát theo học kỳ

        group.MapGet("/semester-surveys", async (
            int? semesterId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetSemesterSurveysAsync(semesterId, cancellationToken)));

        group.MapPost("/semester-surveys", async (
            CreateSemesterSurveyRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.CreateSemesterSurveyAsync(request.ToCommand(), cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapDelete("/semester-surveys/{semesterSurveyId:int}", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.DeleteSemesterSurveyAsync(semesterSurveyId, cancellationToken)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapGet("/semester-surveys/{semesterSurveyId:int}/sections", async (
            int semesterSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            Results.Ok(await service.GetCourseSectionSurveysAsync(semesterSurveyId, cancellationToken)));

        group.MapGet("/course-section-surveys/{courseSectionSurveyId:int}", async (
            int courseSectionSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetCourseSectionSurveyAsync(courseSectionSurveyId, cancellationToken)));

        group.MapGet("/course-section-surveys/{courseSectionSurveyId:int}/responses", async (
            int courseSectionSurveyId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSurveyResponsesAsync(courseSectionSurveyId, cancellationToken)));

        group.MapGet("/responses/{responseId:int}", async (
            int responseId,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.GetSurveyResponseAsync(responseId, cancellationToken)));

        group.MapPut("/course-section-surveys/{courseSectionSurveyId:int}/schedule", async (
            int courseSectionSurveyId,
            SaveSurveyScheduleRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.UpdateCourseSectionSurveyScheduleAsync(
                courseSectionSurveyId,
                new SaveSurveyScheduleCommand(request.StartTime, request.EndTime),
                cancellationToken)))
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

        publicGroup.MapPost("/{linkToken}/responses", async (
            string linkToken,
            SubmitSurveyResponseRequest request,
            ISurveyService service,
            CancellationToken cancellationToken) =>
            ToResult(await service.SubmitSurveyResponseAsync(
                linkToken,
                request.ToCommand(),
                cancellationToken)))
            .RequireRateLimiting("PublicSurveySubmission");

        // ------------------------------------------------------------ Restore

        group.MapPatch("/answer-scales/{answerScaleId:int}/restore", async (
            int answerScaleId, ISurveyService service, CancellationToken ct) =>
            ToResult(await service.RestoreAnswerScaleAsync(answerScaleId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/survey-templates/{surveyTemplateId:int}/restore", async (
            int surveyTemplateId, ISurveyService service, CancellationToken ct) =>
            ToResult(await service.RestoreSurveyTemplateAsync(surveyTemplateId, ct)))
            .AddEndpointFilter<RequireAntiforgeryFilter>();

        group.MapPatch("/semester-surveys/{semesterSurveyId:int}/restore", async (
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
            SurveyErrorCodes.AnswerScaleNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.TemplateNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SemesterNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SemesterSurveyNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.SectionSurveyNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.ResponseNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.LinkNotFound => StatusCodes.Status404NotFound,
            SurveyErrorCodes.AnswerScaleNameExists => StatusCodes.Status409Conflict,
            SurveyErrorCodes.TemplateNameExists => StatusCodes.Status409Conflict,
            SurveyErrorCodes.AnswerScaleInUse => StatusCodes.Status409Conflict,
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
        IReadOnlyList<SaveAnswerScaleOptionRequest>? Options)
    {
        public SaveAnswerScaleCommand ToCommand() => new(
            AnswerScaleName,
            Options?
                .Select(x => new SaveAnswerScaleOptionCommand(x.Value, x.DisplayText ?? string.Empty))
                .ToList() ?? []);
    }

    public sealed record SaveSurveyTemplateRequest(
        string TemplateName,
        int AnswerScaleId,
        IReadOnlyList<string>? Questions)
    {
        public SaveSurveyTemplateCommand ToCommand() => new(
            TemplateName,
            AnswerScaleId,
            Questions ?? []);
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

    public sealed record SubmitSurveyAnswerRequest(int QuestionId, int SelectedValue);

    public sealed record SubmitSurveyResponseRequest(
        IReadOnlyList<SubmitSurveyAnswerRequest>? Answers,
        string? AdditionalComments)
    {
        public SubmitSurveyResponseCommand ToCommand() => new(
            Answers?
                .Select(x => new SubmitSurveyAnswerCommand(x.QuestionId, x.SelectedValue))
                .ToList() ?? [],
            AdditionalComments);
    }
}
