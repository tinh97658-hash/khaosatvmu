using Application.Auth;
using Application.Surveys;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Surveys;

public sealed class EfSurveyService(
    AppDbContext db,
    IMemoryCache cache,
    IUserScopeResolver userScope) : ISurveyService
{
    private const int MaximumScaleOptions = 5;
    private const int MaximumCommentLength = 1000;

    // ------------------------------------------------------------ Answer scales

    public async Task<IReadOnlyList<AnswerScaleDto>> GetAnswerScalesAsync(
        CancellationToken cancellationToken = default)
    {
        var scales = await db.AnswerScales
            .OrderBy(x => x.AnswerScaleName)
            .ToListAsync(cancellationToken);
        var options = await db.AnswerScaleOptions
            .OrderBy(x => x.Value)
            .ToListAsync(cancellationToken);

        return scales
            .Select(scale => ToDto(
                scale,
                options.Where(option => option.AnswerScaleId == scale.AnswerScaleId).ToList()))
            .ToList();
    }

    public async Task<SurveyOperationResult<AnswerScaleDto>> CreateAnswerScaleAsync(
        SaveAnswerScaleCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateAnswerScaleAsync(command, null, cancellationToken);
        if (validation.ErrorCode is not null)
        {
            return Failed<AnswerScaleDto>(validation.ErrorCode);
        }

        var scale = new AnswerScale
        {
            AnswerScaleName = validation.Name,
            ScaleKind = validation.ScaleKind,
        };
        db.AnswerScales.Add(scale);
        await db.SaveChangesAsync(cancellationToken);

        var options = validation.Options
            .Select(option => new AnswerScaleOption
            {
                AnswerScaleId = scale.AnswerScaleId,
                Value = option.Value,
                DisplayText = option.DisplayText,
            })
            .ToList();
        db.AnswerScaleOptions.AddRange(options);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(scale, options));
    }

    public async Task<SurveyOperationResult<AnswerScaleDto>> UpdateAnswerScaleAsync(
        int answerScaleId,
        SaveAnswerScaleCommand command,
        CancellationToken cancellationToken = default)
    {
        var scale = await db.AnswerScales
            .FirstOrDefaultAsync(x => x.AnswerScaleId == answerScaleId, cancellationToken);
        if (scale is null)
        {
            return Failed<AnswerScaleDto>(SurveyErrorCodes.AnswerScaleNotFound);
        }

        var validation = await ValidateAnswerScaleAsync(command, answerScaleId, cancellationToken);
        if (validation.ErrorCode is not null)
        {
            return Failed<AnswerScaleDto>(validation.ErrorCode);
        }

        // Đổi loại thang khi đã có câu hỏi dùng nó sẽ làm các phiếu đã thu không đọc
        // lại được (số đang lưu bỗng bị hiểu thành chữ và ngược lại).
        if (scale.ScaleKind != validation.ScaleKind
            && await db.SurveyQuestions.AnyAsync(x => x.AnswerScaleId == answerScaleId, cancellationToken))
        {
            return Failed<AnswerScaleDto>(SurveyErrorCodes.AnswerScaleKindLocked);
        }

        scale.AnswerScaleName = validation.Name;
        scale.ScaleKind = validation.ScaleKind;

        // Ghi đè các mức: giữ lại dòng cùng Value để không phá "SurveyResponseAnswers".
        var existing = await db.AnswerScaleOptions
            .Where(x => x.AnswerScaleId == answerScaleId)
            .ToListAsync(cancellationToken);

        foreach (var option in validation.Options)
        {
            var current = existing.FirstOrDefault(x => x.Value == option.Value);
            if (current is null)
            {
                db.AnswerScaleOptions.Add(new AnswerScaleOption
                {
                    AnswerScaleId = answerScaleId,
                    Value = option.Value,
                    DisplayText = option.DisplayText,
                });
            }
            else
            {
                current.DisplayText = option.DisplayText;
            }
        }

        var keptValues = validation.Options.Select(x => x.Value).ToHashSet();
        db.AnswerScaleOptions.RemoveRange(existing.Where(x => !keptValues.Contains(x.Value)));

        await db.SaveChangesAsync(cancellationToken);

        var options = await db.AnswerScaleOptions
            .Where(x => x.AnswerScaleId == answerScaleId)
            .OrderBy(x => x.Value)
            .ToListAsync(cancellationToken);

        return Succeeded(ToDto(scale, options));
    }

    public async Task<SurveyOperationResult<bool>> DeleteAnswerScaleAsync(
        int answerScaleId,
        CancellationToken cancellationToken = default)
    {
        var scale = await db.AnswerScales
            .FirstOrDefaultAsync(x => x.AnswerScaleId == answerScaleId, cancellationToken);
        if (scale is null)
        {
            return Failed<bool>(SurveyErrorCodes.AnswerScaleNotFound);
        }

        // "SurveyQuestions"."AnswerScaleId" là ON DELETE RESTRICT.
        if (await db.SurveyQuestions.AnyAsync(x => x.AnswerScaleId == answerScaleId, cancellationToken))
        {
            return Failed<bool>(SurveyErrorCodes.AnswerScaleInUse);
        }

        db.AnswerScales.Remove(scale);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    // --------------------------------------------------------- Survey templates

    public async Task<IReadOnlyList<SurveyTemplateDto>> GetSurveyTemplatesAsync(
        CancellationToken cancellationToken = default)
    {
        var templates = await db.SurveyTemplates
            .OrderByDescending(x => x.SurveyTemplateId)
            .ToListAsync(cancellationToken);
        var questions = await db.SurveyQuestions
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        return templates
            .Select(template => ToDto(
                template,
                questions.Where(q => q.SurveyTemplateId == template.SurveyTemplateId).ToList()))
            .ToList();
    }

    public async Task<SurveyOperationResult<SurveyTemplateDto>> CreateSurveyTemplateAsync(
        SaveSurveyTemplateCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateTemplateAsync(command, null, cancellationToken);
        if (validation.ErrorCode is not null)
        {
            return Failed<SurveyTemplateDto>(validation.ErrorCode);
        }

        var template = new SurveyTemplate
        {
            TemplateName = validation.Name,
            CreatedAt = DateTime.UtcNow,
        };
        db.SurveyTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        var questions = validation.Questions
            .Select(question => new SurveyQuestion
            {
                SurveyTemplateId = template.SurveyTemplateId,
                QuestionText = question.QuestionText,
                AnswerScaleId = question.AnswerScaleId,
                AttentionCheckValue = question.AttentionCheckValue,
            })
            .ToList();
        db.SurveyQuestions.AddRange(questions);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(template, questions));
    }

    public async Task<SurveyOperationResult<SurveyTemplateDto>> UpdateSurveyTemplateAsync(
        int surveyTemplateId,
        SaveSurveyTemplateCommand command,
        CancellationToken cancellationToken = default)
    {
        var template = await db.SurveyTemplates
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == surveyTemplateId, cancellationToken);
        if (template is null)
        {
            return Failed<SurveyTemplateDto>(SurveyErrorCodes.TemplateNotFound);
        }

        var validation = await ValidateTemplateAsync(command, surveyTemplateId, cancellationToken);
        if (validation.ErrorCode is not null)
        {
            return Failed<SurveyTemplateDto>(validation.ErrorCode);
        }

        template.TemplateName = validation.Name;

        // Ghi đè danh sách câu hỏi nhưng dùng lại dòng cũ theo thứ tự để giữ
        // "QuestionId" cho những câu đã có câu trả lời (ON DELETE RESTRICT).
        var existing = await db.SurveyQuestions
            .Where(x => x.SurveyTemplateId == surveyTemplateId)
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        // Đổi thang của một câu đã có phiếu trả lời sẽ làm "AnswerValue" đã lưu bị
        // hiểu sai (số thành chữ hoặc ngược lại), nên chặn từ đầu.
        var existingIds = existing.Select(x => x.QuestionId).ToList();
        var answeredIds = existingIds.Count == 0
            ? []
            : await db.SurveyResponseAnswers
                .Where(x => existingIds.Contains(x.QuestionId))
                .Select(x => x.QuestionId)
                .Distinct()
                .ToListAsync(cancellationToken);

        for (var index = 0; index < validation.Questions.Count; index++)
        {
            var question = validation.Questions[index];
            if (index < existing.Count)
            {
                var current = existing[index];
                if (current.AnswerScaleId != question.AnswerScaleId
                    && answeredIds.Contains(current.QuestionId))
                {
                    db.ChangeTracker.Clear();
                    return Failed<SurveyTemplateDto>(SurveyErrorCodes.TemplateInUse);
                }

                current.QuestionText = question.QuestionText;
                current.AnswerScaleId = question.AnswerScaleId;
                current.AttentionCheckValue = question.AttentionCheckValue;
            }
            else
            {
                db.SurveyQuestions.Add(new SurveyQuestion
                {
                    SurveyTemplateId = surveyTemplateId,
                    QuestionText = question.QuestionText,
                    AnswerScaleId = question.AnswerScaleId,
                    AttentionCheckValue = question.AttentionCheckValue,
                });
            }
        }

        if (existing.Count > validation.Questions.Count)
        {
            db.SurveyQuestions.RemoveRange(existing.Skip(validation.Questions.Count));
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Câu hỏi đã có phiếu trả lời thì không xóa bớt được.
            db.ChangeTracker.Clear();
            return Failed<SurveyTemplateDto>(SurveyErrorCodes.TemplateInUse);
        }

        var questions = await db.SurveyQuestions
            .Where(x => x.SurveyTemplateId == surveyTemplateId)
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        return Succeeded(ToDto(template, questions));
    }

    public async Task<SurveyOperationResult<bool>> DeleteSurveyTemplateAsync(
        int surveyTemplateId,
        CancellationToken cancellationToken = default)
    {
        var template = await db.SurveyTemplates
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == surveyTemplateId, cancellationToken);
        if (template is null)
        {
            return Failed<bool>(SurveyErrorCodes.TemplateNotFound);
        }

        // "SemesterSurveys"."SurveyTemplateId" là ON DELETE RESTRICT.
        if (await db.SemesterSurveys.AnyAsync(x => x.SurveyTemplateId == surveyTemplateId, cancellationToken))
        {
            return Failed<bool>(SurveyErrorCodes.TemplateInUse);
        }

        db.SurveyTemplates.Remove(template);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    // ------------------------------------------------- Đợt khảo sát theo học kỳ

    public async Task<IReadOnlyList<SemesterSurveyDto>> GetSemesterSurveysAsync(
        int? semesterId,
        CancellationToken cancellationToken = default)
    {
        var query = db.SemesterSurveys.AsQueryable();
        if (semesterId is { } id)
        {
            query = query.Where(x => x.SemesterId == id);
        }

        var surveys = await query
            .OrderByDescending(x => x.SemesterSurveyId)
            .ToListAsync(cancellationToken);
        if (surveys.Count == 0)
        {
            return [];
        }

        var semesterIds = surveys.Select(x => x.SemesterId).Distinct().ToList();
        var semesters = await db.Semesters
            .Where(x => semesterIds.Contains(x.SemesterId))
            .ToListAsync(cancellationToken);
        var academicYearIds = semesters.Select(x => x.AcademicYearId).Distinct().ToList();
        var academicYears = await db.AcademicYears
            .Where(x => academicYearIds.Contains(x.AcademicYearId))
            .ToListAsync(cancellationToken);

        var templateIds = surveys.Select(x => x.SurveyTemplateId).Distinct().ToList();
        var templates = await db.SurveyTemplates
            .Where(x => templateIds.Contains(x.SurveyTemplateId))
            .ToListAsync(cancellationToken);
        var questionCounts = await db.SurveyQuestions
            .Where(x => templateIds.Contains(x.SurveyTemplateId))
            .GroupBy(x => x.SurveyTemplateId)
            .Select(group => new { SurveyTemplateId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var surveyIds = surveys.Select(x => x.SemesterSurveyId).ToList();
        var sectionSurveys = await db.CourseSectionSurveys
            .Where(x => surveyIds.Contains(x.SemesterSurveyId))
            .ToListAsync(cancellationToken);
        var responseCounts = await ResponseCountsAsync(
            sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList(),
            cancellationToken);

        return surveys
            .Select(survey =>
            {
                var semester = semesters.FirstOrDefault(x => x.SemesterId == survey.SemesterId);
                var academicYear = academicYears
                    .FirstOrDefault(x => x.AcademicYearId == semester?.AcademicYearId);
                var sections = sectionSurveys
                    .Where(x => x.SemesterSurveyId == survey.SemesterSurveyId)
                    .ToList();

                return new SemesterSurveyDto(
                    survey.SemesterSurveyId,
                    survey.SemesterId,
                    semester?.SemesterName ?? string.Empty,
                    academicYear?.AcademicYearName ?? string.Empty,
                    survey.SurveyTemplateId,
                    templates.FirstOrDefault(x => x.SurveyTemplateId == survey.SurveyTemplateId)?.TemplateName
                        ?? string.Empty,
                    questionCounts
                        .FirstOrDefault(x => x.SurveyTemplateId == survey.SurveyTemplateId)?.Count ?? 0,
                    survey.CreatedAt,
                    sections.Count == 0 ? survey.CreatedAt : sections.Min(x => x.StartTime),
                    sections.Count == 0 ? survey.CreatedAt : sections.Max(x => x.EndTime),
                    sections.Count,
                    sections.Sum(section =>
                        responseCounts.TryGetValue(section.CourseSectionSurveyId, out var count) ? count : 0));
            })
            .ToList();
    }

    public async Task<SurveyOperationResult<SemesterSurveyDto>> CreateSemesterSurveyAsync(
        CreateSemesterSurveyCommand command,
        CancellationToken cancellationToken = default)
    {
        var startTime = ToUtc(command.StartTime);
        var endTime = ToUtc(command.EndTime);
        if (endTime <= startTime)
        {
            return Failed<SemesterSurveyDto>(SurveyErrorCodes.ScheduleInvalid);
        }

        if (!await db.Semesters.AnyAsync(x => x.SemesterId == command.SemesterId, cancellationToken))
        {
            return Failed<SemesterSurveyDto>(SurveyErrorCodes.SemesterNotFound);
        }
        if (!await db.SurveyTemplates
            .AnyAsync(x => x.SurveyTemplateId == command.SurveyTemplateId, cancellationToken))
        {
            return Failed<SemesterSurveyDto>(SurveyErrorCodes.TemplateNotFound);
        }

        var sectionIds = await db.CourseSections
            .Where(x => x.SemesterId == command.SemesterId)
            .Select(x => x.CourseSectionId)
            .ToListAsync(cancellationToken);
        if (sectionIds.Count == 0)
        {
            return Failed<SemesterSurveyDto>(SurveyErrorCodes.SemesterHasNoSections);
        }

        var now = DateTime.UtcNow;
        var survey = new SemesterSurvey
        {
            SemesterId = command.SemesterId,
            SurveyTemplateId = command.SurveyTemplateId,
            CreatedAt = now,
        };
        db.SemesterSurveys.Add(survey);
        await db.SaveChangesAsync(cancellationToken);

        // Mỗi lớp học phần một bài khảo sát riêng, LinkToken riêng để dựng link và QR.
        db.CourseSectionSurveys.AddRange(sectionIds.Select(sectionId => new CourseSectionSurvey
        {
            SemesterSurveyId = survey.SemesterSurveyId,
            CourseSectionId = sectionId,
            LinkToken = Guid.NewGuid().ToString("N"),
            StartTime = startTime,
            EndTime = endTime,
            CreatedAt = now,
        }));
        await db.SaveChangesAsync(cancellationToken);

        var created = (await GetSemesterSurveysAsync(command.SemesterId, cancellationToken))
            .FirstOrDefault(x => x.SemesterSurveyId == survey.SemesterSurveyId);
        return created is null
            ? Failed<SemesterSurveyDto>(SurveyErrorCodes.SemesterSurveyNotFound)
            : Succeeded(created);
    }

    public async Task<SurveyOperationResult<bool>> DeleteSemesterSurveyAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var survey = await db.SemesterSurveys
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == semesterSurveyId, cancellationToken);
        if (survey is null)
        {
            return Failed<bool>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        // Xóa đợt sẽ xóa lây phiếu đã thu (ON DELETE CASCADE) nên chặn lại.
        var sectionSurveys = await db.CourseSectionSurveys
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
        var sectionSurveyIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        if (await db.SurveyResponses
            .AnyAsync(x => sectionSurveyIds.Contains(x.CourseSectionSurveyId), cancellationToken))
        {
            return Failed<bool>(SurveyErrorCodes.SemesterSurveyHasResponses);
        }

        // Cascade soft-delete: đợt khảo sát → bài khảo sát lớp học phần.
        foreach (var sectionSurvey in sectionSurveys)
            db.CourseSectionSurveys.Remove(sectionSurvey);

        db.SemesterSurveys.Remove(survey);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    public async Task<IReadOnlyList<CourseSectionSurveyDto>> GetCourseSectionSurveysAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var scope = await userScope.ResolveAsync(cancellationToken);
        if (scope.SeesNothing) return [];

        var query = db.CourseSectionSurveys
            .Where(x => x.SemesterSurveyId == semesterSurveyId);

        // Bài khảo sát đi theo lớp, mà lớp thuộc bộ môn nào là theo học phần sở hữu.
        if (!scope.SeesEverything)
        {
            query = query.Where(x => db.CourseSections
                .Any(section => section.CourseSectionId == x.CourseSectionId
                                && db.Courses.Any(course =>
                                    course.CourseId == section.CourseId
                                    && course.DepartmentId == scope.DepartmentId)));
        }

        var sectionSurveys = await query.ToListAsync(cancellationToken);
        if (sectionSurveys.Count == 0)
        {
            return [];
        }

        var responseCounts = await ResponseCountsAsync(
            sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList(),
            cancellationToken);
        var sectionIds = sectionSurveys.Select(x => x.CourseSectionId).Distinct().ToList();
        var sections = await db.CourseSections
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);
        var courses = await db.Courses
            .Where(x => sections.Select(section => section.CourseId).Contains(x.CourseId))
            .ToListAsync(cancellationToken);
        var lecturers = await db.Lecturers
            .Where(x => sections.Select(section => section.LecturerId).Contains(x.LecturerId))
            .ToListAsync(cancellationToken);

        return sectionSurveys
            .Select(sectionSurvey =>
            {
                var section = sections
                    .FirstOrDefault(x => x.CourseSectionId == sectionSurvey.CourseSectionId);
                var course = courses.FirstOrDefault(x => x.CourseId == section?.CourseId);
                var lecturer = lecturers.FirstOrDefault(x => x.LecturerId == section?.LecturerId);

                return new CourseSectionSurveyDto(
                    sectionSurvey.CourseSectionSurveyId,
                    sectionSurvey.SemesterSurveyId,
                    sectionSurvey.CourseSectionId,
                    sectionSurvey.LinkToken,
                    sectionSurvey.StartTime,
                    sectionSurvey.EndTime,
                    course?.CourseCode ?? string.Empty,
                    course?.CourseName ?? string.Empty,
                    section?.SectionName ?? string.Empty,
                    lecturer?.FullName ?? string.Empty,
                    section?.ClassSize ?? 0,
                    responseCounts.TryGetValue(sectionSurvey.CourseSectionSurveyId, out var count) ? count : 0);
            })
            .OrderBy(x => x.CourseCode)
            .ThenBy(x => x.SectionName)
            .ToList();
    }

    public async Task<SurveyOperationResult<CourseSectionSurveyDto>> GetCourseSectionSurveyAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default)
    {
        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.CourseSectionSurveyId == courseSectionSurveyId, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<CourseSectionSurveyDto>(SurveyErrorCodes.SectionSurveyNotFound);
        }

        var dto = (await GetCourseSectionSurveysAsync(sectionSurvey.SemesterSurveyId, cancellationToken))
            .FirstOrDefault(x => x.CourseSectionSurveyId == courseSectionSurveyId);
        return dto is null
            ? Failed<CourseSectionSurveyDto>(SurveyErrorCodes.SectionSurveyNotFound)
            : Succeeded(dto);
    }

    public async Task<SurveyOperationResult<IReadOnlyList<SurveyResponseSummaryDto>>> GetSurveyResponsesAsync(
        int courseSectionSurveyId,
        CancellationToken cancellationToken = default)
    {
        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.CourseSectionSurveyId == courseSectionSurveyId, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<IReadOnlyList<SurveyResponseSummaryDto>>(SurveyErrorCodes.SectionSurveyNotFound);
        }

        var responses = await db.SurveyResponses
            .Where(x => x.CourseSectionSurveyId == courseSectionSurveyId)
            .OrderByDescending(x => x.ResponseId)
            .ToListAsync(cancellationToken);

        var scales = await ScalesOfSectionSurveyAsync(sectionSurvey, cancellationToken);
        var mergedValues = MergedOptionValues(scales);
        var scaleOfQuestion = await ScaleByQuestionAsync(sectionSurvey, scales, cancellationToken);

        var responseIds = responses.Select(x => x.ResponseId).ToList();
        var answers = responseIds.Count == 0
            ? []
            : await db.SurveyResponseAnswers
                .Where(x => responseIds.Contains(x.ResponseId))
                .ToListAsync(cancellationToken);

        var summaries = responses
            .Select(response =>
            {
                var responseAnswers = answers.Where(x => x.ResponseId == response.ResponseId).ToList();
                var selectedValues = responseAnswers
                    .Select(answer => SelectedValueOf(
                        scaleOfQuestion.GetValueOrDefault(answer.QuestionId),
                        answer.AnswerValue))
                    .Where(value => value.HasValue)
                    .Select(value => value!.Value)
                    .ToList();

                return new SurveyResponseSummaryDto(
                    response.ResponseId,
                    response.CourseSectionSurveyId,
                    response.SubmittedAt,
                    response.Score,
                    response.AdditionalComments,
                    responseAnswers.Count,
                    // Giữ đủ các mức của thang, mức không ai chọn hiển thị 0.
                    mergedValues
                        .Select(option => new SurveyResponseValueCountDto(
                            option.Value,
                            option.DisplayText,
                            selectedValues.Count(value => value == option.Value)))
                        .ToList(),
                    response.IsValid,
                    response.RejectionReasons);
            })
            .ToList();

        return Succeeded<IReadOnlyList<SurveyResponseSummaryDto>>(summaries);
    }

    public async Task<SurveyOperationResult<SurveyResponseDetailDto>> GetSurveyResponseAsync(
        int responseId,
        CancellationToken cancellationToken = default)
    {
        var response = await db.SurveyResponses
            .FirstOrDefaultAsync(x => x.ResponseId == responseId, cancellationToken);
        if (response is null)
        {
            return Failed<SurveyResponseDetailDto>(SurveyErrorCodes.ResponseNotFound);
        }

        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.CourseSectionSurveyId == response.CourseSectionSurveyId, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<SurveyResponseDetailDto>(SurveyErrorCodes.SectionSurveyNotFound);
        }

        var semesterSurvey = await db.SemesterSurveys
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId, cancellationToken);
        var template = semesterSurvey is null
            ? null
            : await db.SurveyTemplates
                .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);

        var scales = await ScalesOfSectionSurveyAsync(sectionSurvey, cancellationToken);
        var scaleById = scales.ToDictionary(x => x.AnswerScaleId);
        var questions = template is null
            ? []
            : await db.SurveyQuestions
                .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
                .OrderBy(x => x.QuestionId)
                .ToListAsync(cancellationToken);
        var answers = await db.SurveyResponseAnswers
            .Where(x => x.ResponseId == responseId)
            .ToListAsync(cancellationToken);

        var section = await db.CourseSections
            .FirstOrDefaultAsync(x => x.CourseSectionId == sectionSurvey.CourseSectionId, cancellationToken);
        var course = section is null
            ? null
            : await db.Courses.FirstOrDefaultAsync(x => x.CourseId == section.CourseId, cancellationToken);
        var lecturer = section is null
            ? null
            : await db.Lecturers.FirstOrDefaultAsync(x => x.LecturerId == section.LecturerId, cancellationToken);

        return Succeeded(new SurveyResponseDetailDto(
            response.ResponseId,
            response.CourseSectionSurveyId,
            response.SubmittedAt,
            response.Score,
            response.AdditionalComments,
            template?.TemplateName ?? string.Empty,
            course?.CourseCode ?? string.Empty,
            course?.CourseName ?? string.Empty,
            section?.SectionName ?? string.Empty,
            lecturer?.FullName ?? string.Empty,
            scales,
            questions
                .Select(question =>
                {
                    var answer = answers.FirstOrDefault(x => x.QuestionId == question.QuestionId);
                    var scale = scaleById.GetValueOrDefault(question.AnswerScaleId);
                    var selectedValue = SelectedValueOf(scale, answer?.AnswerValue);

                    return new SurveyResponseAnswerDto(
                        question.QuestionId,
                        question.QuestionText,
                        question.AnswerScaleId,
                        scale?.ScaleKind ?? AnswerScaleKinds.Options,
                        answer?.AnswerValue ?? string.Empty,
                        selectedValue,
                        scale?.Options.FirstOrDefault(option => option.Value == selectedValue)?.DisplayText
                            ?? string.Empty);
                })
                .ToList()));
    }

    public async Task<SurveyOperationResult<CourseSectionSurveyDto>> UpdateCourseSectionSurveyScheduleAsync(
        int courseSectionSurveyId,
        SaveSurveyScheduleCommand command,
        CancellationToken cancellationToken = default)
    {
        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.CourseSectionSurveyId == courseSectionSurveyId, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<CourseSectionSurveyDto>(SurveyErrorCodes.SectionSurveyNotFound);
        }

        var startTime = ToUtc(command.StartTime);
        var endTime = ToUtc(command.EndTime);
        if (endTime <= startTime)
        {
            return Failed<CourseSectionSurveyDto>(SurveyErrorCodes.ScheduleInvalid);
        }

        sectionSurvey.StartTime = startTime;
        sectionSurvey.EndTime = endTime;
        await db.SaveChangesAsync(cancellationToken);
        cache.Remove($"survey:public:{sectionSurvey.LinkToken}");

        var updated = (await GetCourseSectionSurveysAsync(sectionSurvey.SemesterSurveyId, cancellationToken))
            .FirstOrDefault(x => x.CourseSectionSurveyId == courseSectionSurveyId);
        return updated is null
            ? Failed<CourseSectionSurveyDto>(SurveyErrorCodes.SectionSurveyNotFound)
            : Succeeded(updated);
    }

    // -------------------------------------------------- Phiếu khảo sát công khai

    public async Task<SurveyOperationResult<PublicSurveyDto>> GetPublicSurveyAsync(
        string linkToken,
        CancellationToken cancellationToken = default)
    {
        var token = linkToken?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(token))
        {
            return Failed<PublicSurveyDto>(SurveyErrorCodes.LinkNotFound);
        }

        var cacheKey = $"survey:public:{token}";
        var cached = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15);

            var sectionSurvey = await db.CourseSectionSurveys
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.LinkToken == token, cancellationToken);
            if (sectionSurvey is null) return null;

            var semesterSurvey = await db.SemesterSurveys
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId, cancellationToken);
            if (semesterSurvey is null) return null;

            var template = await db.SurveyTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
            if (template is null) return null;

            var questions = await db.SurveyQuestions
                .AsNoTracking()
                .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
                .OrderBy(x => x.QuestionId)
                .Select(x => new PublicSurveyQuestionDto(x.QuestionId, x.QuestionText, x.AnswerScaleId))
                .ToListAsync(cancellationToken);

            // Trả về mọi thang mà bộ đang dùng; mỗi câu tự trỏ tới thang của nó.
            var scales = await ScalesOfTemplateAsync(template.SurveyTemplateId, cancellationToken);

            var section = await db.CourseSections
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CourseSectionId == sectionSurvey.CourseSectionId, cancellationToken);
            var course = section is null
                ? null
                : await db.Courses.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.CourseId == section.CourseId, cancellationToken);
            var lecturer = section is null
                ? null
                : await db.Lecturers.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.LecturerId == section.LecturerId, cancellationToken);
            var semester = section is null
                ? null
                : await db.Semesters.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.SemesterId == section.SemesterId, cancellationToken);
            var academicYear = semester is null
                ? null
                : await db.AcademicYears.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

            return new PublicSurveyDto(
                sectionSurvey.LinkToken,
                template.TemplateName,
                course?.CourseCode ?? string.Empty,
                course?.CourseName ?? string.Empty,
                section?.SectionName ?? string.Empty,
                lecturer?.FullName ?? string.Empty,
                semester?.SemesterName ?? string.Empty,
                academicYear?.AcademicYearName ?? string.Empty,
                sectionSurvey.StartTime,
                sectionSurvey.EndTime,
                true,
                scales,
                questions);
        });

        if (cached is null)
        {
            return Failed<PublicSurveyDto>(SurveyErrorCodes.LinkNotFound);
        }

        var now = DateTime.UtcNow;
        var isOpen = now >= cached.StartTime && now <= cached.EndTime;
        return Succeeded(cached with { IsOpen = isOpen });
    }

    public async Task<SurveyOperationResult<SubmitSurveyResponseDto>> SubmitSurveyResponseAsync(
        string linkToken,
        SubmitSurveyResponseCommand command,
        CancellationToken cancellationToken = default)
    {
        var token = linkToken?.Trim() ?? string.Empty;
        var publicSurveyResult = await GetPublicSurveyAsync(token, cancellationToken);
        if (!publicSurveyResult.Succeeded || publicSurveyResult.Value is not { } publicSurvey)
        {
            return Failed<SubmitSurveyResponseDto>(publicSurveyResult.ErrorCode ?? SurveyErrorCodes.LinkNotFound);
        }

        if (!publicSurvey.IsOpen)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.LinkNotOpen);
        }

        var sectionSurvey = await db.CourseSectionSurveys
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.LinkToken == token, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.LinkNotFound);
        }

        // Mỗi câu có thang riêng nên tra được thang nào cho câu nào trước khi kiểm.
        var scaleById = publicSurvey.AnswerScales.ToDictionary(x => x.AnswerScaleId);
        var scaleOfQuestion = publicSurvey.Questions
            .Where(x => scaleById.ContainsKey(x.AnswerScaleId))
            .ToDictionary(x => x.QuestionId, x => scaleById[x.AnswerScaleId]);
        var questionIds = publicSurvey.Questions.Select(x => x.QuestionId).ToHashSet();

        // Mức bắt buộc của câu bẫy không nằm trong DTO công khai — để lộ ra thì
        // sinh viên biết luôn câu nào là bẫy — nên phải tra thẳng từ cơ sở dữ liệu.
        var attentionCheckByQuestion = await db.SurveyQuestions
            .AsNoTracking()
            .Where(x => questionIds.Contains(x.QuestionId) && x.AttentionCheckValue != null)
            .ToDictionaryAsync(x => x.QuestionId, x => x.AttentionCheckValue!.Value, cancellationToken);

        var answers = (command.Answers ?? [])
            .GroupBy(x => x.QuestionId)
            .Select(group => group.Last())
            .Select(x => new SubmitSurveyAnswerCommand(x.QuestionId, x.AnswerValue?.Trim() ?? string.Empty))
            .ToList();

        if (questionIds.Count == 0
            || answers.Count != questionIds.Count
            || answers.Any(answer => !questionIds.Contains(answer.QuestionId))
            || answers.Any(answer => answer.AnswerValue.Length == 0))
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswersIncomplete);
        }

        // Câu thang 'Options' phải gửi lên một mức có thật; câu thang 'Text' nhận
        // nguyên nội dung, chỉ giới hạn độ dài.
        var scoredValues = new List<int>();
        foreach (var answer in answers)
        {
            if (!scaleOfQuestion.TryGetValue(answer.QuestionId, out var scale))
            {
                return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswerValueInvalid);
            }

            if (scale.ScaleKind == AnswerScaleKinds.Text)
            {
                if (answer.AnswerValue.Length > SurveyRules.MaximumTextAnswerLength)
                {
                    return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswerTextTooLong);
                }
                continue;
            }

            if (!int.TryParse(answer.AnswerValue, out var selectedValue)
                || scale.Options.All(option => option.Value != selectedValue))
            {
                return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswerValueInvalid);
            }

            // Câu bẫy vẫn phải là một mức hợp lệ nhưng không vào điểm trung bình.
            if (attentionCheckByQuestion.ContainsKey(answer.QuestionId)) continue;

            scoredValues.Add(selectedValue);
        }

        var comments = command.AdditionalComments?.Trim();
        if (comments is { Length: > MaximumCommentLength })
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.CommentsTooLong);
        }

        // Lọc phiếu làm ẩu. Phiếu bị lọc vẫn được nhận và vẫn là một lượt nộp,
        // chỉ không tham gia vào điểm trung bình của lớp.
        var filterQuestions = publicSurvey.Questions
            .Select(question => new FilterQuestion(
                question.QuestionId,
                scaleOfQuestion.TryGetValue(question.QuestionId, out var scale)
                    ? scale.ScaleKind
                    : AnswerScaleKinds.Options,
                attentionCheckByQuestion.TryGetValue(question.QuestionId, out var required)
                    ? required
                    : null))
            .ToList();
        var filterAnswers = answers
            .Select(answer => new FilterAnswer(answer.QuestionId, answer.AnswerValue))
            .ToList();
        var filterResult = ResponseFilter.Evaluate(filterQuestions, filterAnswers, command.ElapsedSeconds);

        var now = DateTime.UtcNow;
        var response = new SurveyResponse
        {
            CourseSectionSurveyId = sectionSurvey.CourseSectionSurveyId,
            AdditionalComments = string.IsNullOrEmpty(comments) ? null : comments,
            Score = ComputeScore(scoredValues),
            IsValid = filterResult.IsValid,
            RejectionReasons = filterResult.RejectionReasons,
            SubmittedAt = now,
        };

        db.SurveyResponses.Add(response);
        db.SurveyResponseAnswers.AddRange(answers.Select(answer => new SurveyResponseAnswer
        {
            SurveyResponse = response,
            QuestionId = answer.QuestionId,
            AnswerValue = answer.AnswerValue,
        }));

        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new SubmitSurveyResponseDto(response.ResponseId, response.Score, response.SubmittedAt));
    }

    // ------------------------------------------------------------------ Helpers

    /// <summary>Các thang mà bộ câu hỏi của bài khảo sát đang dùng.</summary>
    private async Task<IReadOnlyList<AnswerScaleDto>> ScalesOfSectionSurveyAsync(
        CourseSectionSurvey sectionSurvey,
        CancellationToken cancellationToken)
    {
        var surveyTemplateId = await db.SemesterSurveys
            .Where(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId)
            .Select(x => x.SurveyTemplateId)
            .FirstOrDefaultAsync(cancellationToken);

        return surveyTemplateId == 0
            ? []
            : await ScalesOfTemplateAsync(surveyTemplateId, cancellationToken);
    }

    /// <summary>
    /// Gộp các mức của mọi thang 'Options' theo giá trị số. Cùng một mức mà các
    /// thang đặt nhãn khác nhau thì hiển thị chung là "Mức n".
    /// </summary>
    private static IReadOnlyList<(int Value, string DisplayText)> MergedOptionValues(
        IReadOnlyList<AnswerScaleDto> scales)
    {
        return scales
            .Where(scale => scale.ScaleKind == AnswerScaleKinds.Options)
            .SelectMany(scale => scale.Options)
            .GroupBy(option => option.Value)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var labels = group.Select(x => x.DisplayText).Distinct().ToList();
                return (group.Key, labels.Count == 1 ? labels[0] : $"Mức {group.Key}");
            })
            .ToList();
    }

    /// <summary>Đọc "AnswerValue" ra số mức; null nếu câu không thuộc thang 'Options'.</summary>
    private static int? SelectedValueOf(AnswerScaleDto? scale, string? answerValue)
    {
        if (scale is null || scale.ScaleKind != AnswerScaleKinds.Options) return null;
        return int.TryParse(answerValue, out var value) ? value : null;
    }

    /// <summary>Bảng tra thang trả lời theo từng câu hỏi của bài khảo sát một lớp.</summary>
    private async Task<Dictionary<int, AnswerScaleDto>> ScaleByQuestionAsync(
        CourseSectionSurvey sectionSurvey,
        IReadOnlyList<AnswerScaleDto> scales,
        CancellationToken cancellationToken)
    {
        if (scales.Count == 0) return [];

        var surveyTemplateId = await db.SemesterSurveys
            .AsNoTracking()
            .Where(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId)
            .Select(x => x.SurveyTemplateId)
            .FirstOrDefaultAsync(cancellationToken);
        if (surveyTemplateId == 0) return [];

        var scaleById = scales.ToDictionary(x => x.AnswerScaleId);
        var pairs = await db.SurveyQuestions
            .AsNoTracking()
            .Where(x => x.SurveyTemplateId == surveyTemplateId)
            .Select(x => new { x.QuestionId, x.AnswerScaleId })
            .ToListAsync(cancellationToken);

        return pairs
            .Where(x => scaleById.ContainsKey(x.AnswerScaleId))
            .ToDictionary(x => x.QuestionId, x => scaleById[x.AnswerScaleId]);
    }

    private async Task<Dictionary<int, int>> ResponseCountsAsync(
        IReadOnlyList<int> courseSectionSurveyIds,
        CancellationToken cancellationToken)
    {
        if (courseSectionSurveyIds.Count == 0)
        {
            return [];
        }

        var counts = await db.SurveyResponses
            .Where(x => courseSectionSurveyIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => x.CourseSectionSurveyId)
            .Select(group => new { CourseSectionSurveyId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        return counts.ToDictionary(x => x.CourseSectionSurveyId, x => x.Count);
    }

    // ------------------------------------------- Tính điểm lớp theo mẻ (nhóm C)

    public async Task<SurveyOperationResult<RecalculateScoresDto>> RecalculateSemesterSurveyScoresAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var exists = await db.SemesterSurveys
            .AnyAsync(x => x.SemesterSurveyId == semesterSurveyId, cancellationToken);
        if (!exists)
        {
            return Failed<RecalculateScoresDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var calculatedAt = DateTime.UtcNow;

        // Cả ba câu phải cùng ăn hoặc cùng bỏ: điểm tổng hợp của lớp và điểm từng
        // câu là hai mặt của cùng một lần chốt, lệch nhau thì bảng đọc ra số vô lý.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Một câu UPDATE ... FROM chạy trọn trong Postgres: dù đợt có bao nhiêu
        // nghìn phiếu cũng không kéo dòng nào về bộ nhớ ứng dụng.
        // LEFT JOIN để lớp chưa có phiếu nào cũng được ghi về 0 thay vì giữ số cũ.
        var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE "CourseSectionSurveys" AS css
            SET "TotalResponseCount"   = agg.total_count,
                "ValidResponseCount"   = agg.valid_count,
                "InvalidResponseCount" = agg.total_count - agg.valid_count,
                "AverageScore"         = agg.average_score,
                "ScoreCalculatedAt"    = {calculatedAt}
            FROM (
                SELECT c."CourseSectionSurveyId" AS id,
                       count(r.*)                                        AS total_count,
                       count(r.*) FILTER (WHERE r."IsValid")             AS valid_count,
                       round(avg(r."Score") FILTER (WHERE r."IsValid"), 2) AS average_score
                FROM "CourseSectionSurveys" c
                LEFT JOIN "SurveyResponses" r
                       ON r."CourseSectionSurveyId" = c."CourseSectionSurveyId"
                WHERE c."SemesterSurveyId" = {semesterSurveyId}
                  AND NOT c."IsDeleted"
                GROUP BY c."CourseSectionSurveyId"
            ) AS agg
            WHERE css."CourseSectionSurveyId" = agg.id
            """, cancellationToken);

        // Xoá trắng rồi ghi lại thay vì UPSERT: câu bị gỡ khỏi bộ câu hỏi, hoặc
        // lớp bị xoá hết phiếu, thì dòng cũ phải biến mất chứ không được đứng lại.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM "CourseSectionSurveyQuestionScores" AS q
            USING "CourseSectionSurveys" AS c
            WHERE q."CourseSectionSurveyId" = c."CourseSectionSurveyId"
              AND c."SemesterSurveyId" = {semesterSurveyId}
            """, cancellationToken);

        // Gộp điểm từng câu ngay trong Postgres. Cùng bộ điều kiện với điểm phiếu:
        // chỉ phiếu hợp lệ, bỏ câu bẫy và câu tự nhập chữ. Câu chưa ai trả lời thì
        // không sinh dòng — bảng hiển thị sẽ đọc ra "chưa có số".
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CourseSectionSurveyQuestionScores"
                ("CourseSectionSurveyId", "QuestionId", "AverageScore", "AnswerCount")
            SELECT r."CourseSectionSurveyId",
                   a."QuestionId",
                   round(avg(a."AnswerValue"::numeric), 2),
                   count(*)
            FROM "SurveyResponses" AS r
            JOIN "SurveyResponseAnswers" AS a ON a."ResponseId" = r."ResponseId"
            JOIN "CourseSectionSurveys" AS c ON c."CourseSectionSurveyId" = r."CourseSectionSurveyId"
            JOIN "SurveyQuestions" AS q ON q."QuestionId" = a."QuestionId"
            JOIN "AnswerScales" AS s ON s."AnswerScaleId" = q."AnswerScaleId"
            WHERE c."SemesterSurveyId" = {semesterSurveyId}
              AND NOT c."IsDeleted"
              AND r."IsValid"
              AND q."AttentionCheckValue" IS NULL
              AND s."ScaleKind" = {AnswerScaleKinds.Options}
            GROUP BY r."CourseSectionSurveyId", a."QuestionId"
            """, cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Succeeded(new RecalculateScoresDto(semesterSurveyId, updated, calculatedAt));
    }

    public async Task<SurveyOperationResult<SemesterSurveyStatisticsDto>> GetSemesterSurveyStatisticsAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var semesterSurvey = await db.SemesterSurveys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == semesterSurveyId, cancellationToken);
        if (semesterSurvey is null)
        {
            return Failed<SemesterSurveyStatisticsDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var template = await db.SurveyTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
        var semester = await db.Semesters.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterId == semesterSurvey.SemesterId, cancellationToken);
        var academicYear = semester is null
            ? null
            : await db.AcademicYears.AsNoTracking()
                .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

        // Nạp TOÀN BỘ câu của bộ để đánh số thứ tự theo đúng vị trí gốc, rồi mới
        // lọc bỏ câu bẫy và câu tự nhập. Nhờ vậy bộ 30 câu có câu bẫy ở vị trí 16
        // sẽ ra các cột C1..C15 và C17..C30 — số hiệu khớp với số câu sinh viên
        // thấy trên phiếu, thay vì bị dồn lại thành C1..C29.
        var allQuestions = await (
            from q in db.SurveyQuestions.AsNoTracking()
            join s in db.AnswerScales.AsNoTracking() on q.AnswerScaleId equals s.AnswerScaleId
            where q.SurveyTemplateId == semesterSurvey.SurveyTemplateId
            orderby q.QuestionId
            select new { q.QuestionId, q.QuestionText, q.AttentionCheckValue, s.ScaleKind })
            .ToListAsync(cancellationToken);

        var questionColumns = allQuestions
            .Select((q, index) => new { Question = q, Order = index + 1 })
            .Where(x => x.Question.AttentionCheckValue == null
                && x.Question.ScaleKind == AnswerScaleKinds.Options)
            .Select(x => new StatisticsQuestionColumnDto(
                x.Question.QuestionId,
                x.Order,
                x.Question.QuestionText))
            .ToList();
        var scoredQuestionIds = questionColumns.Select(x => x.QuestionId).ToList();

        var attentionCheckOrders = allQuestions
            .Select((q, index) => new { Question = q, Order = index + 1 })
            .Where(x => x.Question.AttentionCheckValue != null)
            .Select(x => x.Order)
            .ToList();

        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        var sections = await db.CourseSections.AsNoTracking()
            .Where(x => sectionSurveys.Select(s => s.CourseSectionId).Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);
        var courses = await db.Courses.AsNoTracking()
            .Where(x => sections.Select(s => s.CourseId).Contains(x.CourseId))
            .ToDictionaryAsync(x => x.CourseId, x => x, cancellationToken);
        var lecturers = await db.Lecturers.AsNoTracking().ToDictionaryAsync(x => x.LecturerId, x => x, cancellationToken);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.DepartmentId, x => x.DepartmentName, cancellationToken);

        // Điểm từng câu: đọc bảng đã gộp sẵn, KHÔNG gộp lại từ phiếu. Đây là lý do
        // mở trang không còn phải đụng tới "SurveyResponseAnswers" — bảng nặng nhất
        // hệ thống. Lớp nào chưa được chốt điểm thì đơn giản là chưa có dòng nào.
        var questionScores = cssIds.Count == 0 || scoredQuestionIds.Count == 0
            ? []
            : await db.CourseSectionSurveyQuestionScores.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId)
                    && scoredQuestionIds.Contains(x.QuestionId))
                .ToListAsync(cancellationToken);

        var scoresBySection = questionScores
            .GroupBy(x => x.CourseSectionSurveyId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(x => x.QuestionId, x => x));

        // Số phiếu thu và số phiếu bị lọc: đếm thẳng từ "SurveyResponses" mỗi lần
        // mở trang. Đây là số liệu tiến độ nên phải đúng ngay cả khi đợt chưa chốt
        // điểm, và chỉ là COUNT trên một bảng đã có chỉ mục (CourseSectionSurveyId,
        // IsValid) nên rẻ — khác hẳn việc gộp điểm từng câu.
        var responseTallies = cssIds.Count == 0
            ? []
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new
                {
                    CourseSectionSurveyId = g.Key,
                    Total = g.Count(),
                    Valid = g.Count(x => x.IsValid),
                })
                .ToDictionaryAsync(x => x.CourseSectionSurveyId, x => x, cancellationToken);

        // Số phiếu có điền ô "Ý kiến khác" — chỉ đếm ô cuối bài, không đếm câu
        // thuộc thang tự nhập chữ.
        var commentCounts = cssIds.Count == 0
            ? []
            : await db.SurveyResponses.AsNoTracking()
                .Where(x => cssIds.Contains(x.CourseSectionSurveyId)
                    && x.AdditionalComments != null
                    && x.AdditionalComments != "")
                .GroupBy(x => x.CourseSectionSurveyId)
                .Select(g => new { CourseSectionSurveyId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CourseSectionSurveyId, x => x.Count, cancellationToken);

        var lastCalculatedAt = sectionSurveys
            .Where(x => x.ScoreCalculatedAt is not null)
            .Select(x => x.ScoreCalculatedAt!.Value)
            .DefaultIfEmpty()
            .Max();
        var lastCalculated = lastCalculatedAt == default ? (DateTime?)null : lastCalculatedAt;

        // Phiếu về sau lần tính gần nhất: dấu hiệu con số đang xem đã cũ.
        var responsesSince = lastCalculated is null || cssIds.Count == 0
            ? 0
            : await db.SurveyResponses.AsNoTracking()
                .CountAsync(x => cssIds.Contains(x.CourseSectionSurveyId)
                    && x.SubmittedAt > lastCalculated.Value, cancellationToken);

        var rows = new List<SectionStatisticsRowDto>(sectionSurveys.Count);
        foreach (var css in sectionSurveys)
        {
            var section = sections.FirstOrDefault(x => x.CourseSectionId == css.CourseSectionId);
            var course = section is not null && courses.TryGetValue(section.CourseId, out var c) ? c : null;
            var lecturer = section?.LecturerId is { } lecId && lecturers.TryGetValue(lecId, out var l) ? l : null;
            var departmentId = course?.DepartmentId ?? lecturer?.DepartmentId;

            // Câu chưa được chốt điểm trả về AnswerCount = 0; giao diện đọc đúng
            // dấu hiệu đó để hiện gạch ngang thay vì số 0 gây hiểu nhầm là điểm kém.
            var perQuestion = scoresBySection.GetValueOrDefault(css.CourseSectionSurveyId);
            var columnScores = questionColumns
                .Select(column =>
                {
                    var stat = perQuestion?.GetValueOrDefault(column.QuestionId);
                    return new SectionQuestionScoreDto(
                        column.QuestionId,
                        stat?.AverageScore ?? 0m,
                        stat?.AnswerCount ?? 0);
                })
                .ToList();

            var weakest = columnScores
                .Where(x => x.AnswerCount > 0)
                .OrderBy(x => x.AverageScore)
                .FirstOrDefault();

            var tally = responseTallies.GetValueOrDefault(css.CourseSectionSurveyId);
            var totalResponses = tally?.Total ?? 0;
            var validResponses = tally?.Valid ?? 0;

            var classSize = section?.ClassSize ?? 0;
            rows.Add(new SectionStatisticsRowDto(
                css.CourseSectionId,
                css.CourseSectionSurveyId,
                course?.CourseCode ?? string.Empty,
                course?.CourseName ?? string.Empty,
                section?.SectionName ?? string.Empty,
                departmentId is { } dId && departments.TryGetValue(dId, out var dn) ? dn : "Chưa thuộc bộ môn",
                // Lớp import thiếu email giảng viên thì hiện tên đọc được từ tệp.
                lecturer?.FullName ?? section?.UnidentifiedLecturerName ?? "Chưa phân công",
                classSize,
                totalResponses,
                validResponses,
                totalResponses - validResponses,
                // Tỷ lệ phản hồi là số liệu tiến độ nên chia trên tổng lượt nộp.
                classSize > 0 ? Math.Round((decimal)totalResponses / classSize * 100, 1) : 0m,
                css.AverageScore,
                css.ScoreCalculatedAt,
                commentCounts.GetValueOrDefault(css.CourseSectionSurveyId),
                weakest?.QuestionId,
                weakest?.AverageScore,
                columnScores));
        }

        return Succeeded(new SemesterSurveyStatisticsDto(
            semesterSurveyId,
            template?.TemplateName ?? string.Empty,
            semester?.SemesterName ?? string.Empty,
            academicYear?.AcademicYearName ?? string.Empty,
            lastCalculated,
            responsesSince,
            questionColumns,
            attentionCheckOrders,
            rows.OrderBy(x => x.CourseCode).ThenBy(x => x.SectionName).ToList()));
    }

    // ------------------------------- Sheet 1 và 3: phân tích chuyên sâu

    /// <summary>
    /// Một lớp đã có phiếu, kèm đủ thông tin quy về khoa/bộ môn. Dùng chung cho
    /// cả hai sheet để chỉ phải viết một lần phần quy thuộc đơn vị.
    /// </summary>
    private sealed record AnalysedSection(
        int CourseSectionSurveyId,
        int CourseSectionId,
        string CourseCode,
        string CourseName,
        string SectionName,
        string LecturerName,
        int? LecturerId,
        /// <summary>Tên đọc từ tệp import khi lớp chưa gắn được mã giảng viên.</summary>
        string? UnidentifiedLecturerName,
        int ClassSize,
        int ResponseCount,
        decimal AverageScore,
        int? FacultyId,
        string FacultyName,
        int? DepartmentId,
        string DepartmentName);

    /// <summary>
    /// Đếm giảng viên của một nhóm lớp. Lớp chưa gắn được mã vẫn tính nếu đọc
    /// được tên từ tệp import, vì đó vẫn là một người dạy thật; chỉ lớp không có
    /// cả mã lẫn tên mới bị bỏ qua. Nhóm theo tên nên hai người trùng tên chưa
    /// xác định bị đếm gộp làm một — không tránh được khi thiếu email.
    /// </summary>
    private static int CountLecturers(IEnumerable<AnalysedSection> sections) =>
        sections
            .Select(x => x.LecturerId is { } lecturerId
                ? $"id:{lecturerId}"
                : string.IsNullOrWhiteSpace(x.UnidentifiedLecturerName)
                    ? null
                    : $"name:{x.UnidentifiedLecturerName.Trim().ToLowerInvariant()}")
            .Where(x => x is not null)
            .Distinct()
            .Count();

    /// <summary>
    /// Nạp các lớp của một đợt kèm điểm tính TRỰC TIẾP từ phiếu hợp lệ. Cố ý
    /// không đọc cột <c>AverageScore</c> đã lưu, vì đó là ảnh chụp của lần bấm
    /// nút gần nhất; báo cáo thì phải phản ánh dữ liệu tại thời điểm xem.
    /// Lớp chưa có phiếu hợp lệ nào bị loại khỏi mọi phép tính mặt bằng.
    /// </summary>
    private async Task<List<AnalysedSection>> LoadAnalysedSectionsAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken)
    {
        var sectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
        if (sectionSurveys.Count == 0) return [];

        var cssIds = sectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();

        var tallies = await db.SurveyResponses.AsNoTracking()
            .Where(x => cssIds.Contains(x.CourseSectionSurveyId))
            .GroupBy(x => x.CourseSectionSurveyId)
            .Select(g => new
            {
                CourseSectionSurveyId = g.Key,
                TotalCount = g.Count(),
                ValidCount = g.Count(x => x.IsValid),
                ValidTotal = g.Sum(x => x.IsValid ? x.Score : 0m)
            })
            .ToDictionaryAsync(x => x.CourseSectionSurveyId, x => x, cancellationToken);

        var sectionIds = sectionSurveys.Select(x => x.CourseSectionId).ToList();
        var sections = await db.CourseSections.AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToListAsync(cancellationToken);
        var courses = await db.Courses.AsNoTracking()
            .Where(x => sections.Select(s => s.CourseId).Contains(x.CourseId))
            .ToDictionaryAsync(x => x.CourseId, x => x, cancellationToken);
        var lecturers = await db.Lecturers.AsNoTracking()
            .ToDictionaryAsync(x => x.LecturerId, x => x, cancellationToken);
        var departments = await db.Departments.AsNoTracking()
            .ToDictionaryAsync(x => x.DepartmentId, x => x, cancellationToken);
        var faculties = await db.Faculties.AsNoTracking()
            .ToDictionaryAsync(x => x.FacultyId, x => x.FacultyName, cancellationToken);

        var result = new List<AnalysedSection>(sectionSurveys.Count);
        foreach (var css in sectionSurveys)
        {
            if (!tallies.TryGetValue(css.CourseSectionSurveyId, out var tally)
                || tally.ValidCount == 0)
            {
                continue;
            }

            var section = sections.FirstOrDefault(x => x.CourseSectionId == css.CourseSectionId);
            var course = section is not null && courses.TryGetValue(section.CourseId, out var c) ? c : null;
            var lecturer = section?.LecturerId is { } lecId && lecturers.TryGetValue(lecId, out var l) ? l : null;

            // Quy thuộc đơn vị: ưu tiên đơn vị sở hữu học phần, không có thì lấy
            // theo giảng viên. Khoa suy từ bộ môn nếu học phần không ghi khoa.
            var departmentId = course?.DepartmentId ?? lecturer?.DepartmentId;
            var facultyId = course?.FacultyId;
            if (facultyId is null && departmentId is { } dId && departments.TryGetValue(dId, out var dept))
            {
                facultyId = dept.FacultyId;
            }
            facultyId ??= lecturer?.FacultyId;

            result.Add(new AnalysedSection(
                css.CourseSectionSurveyId,
                css.CourseSectionId,
                course?.CourseCode ?? string.Empty,
                course?.CourseName ?? string.Empty,
                section?.SectionName ?? string.Empty,
                lecturer?.FullName ?? section?.UnidentifiedLecturerName ?? "Chưa phân công",
                section?.LecturerId,
                section?.UnidentifiedLecturerName,
                section?.ClassSize ?? 0,
                tally.TotalCount,
                Math.Round(tally.ValidTotal / tally.ValidCount, 2),
                facultyId,
                facultyId is { } fId && faculties.TryGetValue(fId, out var fn) ? fn : "Chưa thuộc khoa",
                departmentId,
                departmentId is { } dId2 && departments.TryGetValue(dId2, out var dp)
                    ? dp.DepartmentName
                    : "Chưa thuộc bộ môn"));
        }

        return result;
    }

    /// <summary>Điểm của một câu trong phạm vi một lớp, dạng thô để còn gộp tiếp.</summary>
    private sealed record SectionQuestionStat(
        int CourseSectionSurveyId,
        int QuestionId,
        int AnswerCount,
        decimal Total)
    {
        public decimal Average => AnswerCount == 0 ? 0m : Total / AnswerCount;
    }

    /// <summary>
    /// Điểm từng câu của từng lớp, gộp một lượt trong SQL. Chỉ phiếu hợp lệ.
    /// Đây là đơn vị nhỏ nhất mà sheet 3, 4, 5 đều gộp lên từ đó.
    /// </summary>
    private async Task<List<SectionQuestionStat>> SectionQuestionStatsAsync(
        IReadOnlyCollection<int> courseSectionSurveyIds,
        IReadOnlyCollection<int> questionIds,
        CancellationToken cancellationToken)
    {
        if (courseSectionSurveyIds.Count == 0 || questionIds.Count == 0) return [];

        var rows = await (
            from r in db.SurveyResponses.AsNoTracking()
            join a in db.SurveyResponseAnswers.AsNoTracking() on r.ResponseId equals a.ResponseId
            where courseSectionSurveyIds.Contains(r.CourseSectionSurveyId)
              && r.IsValid
              && questionIds.Contains(a.QuestionId)
            group a by new { r.CourseSectionSurveyId, a.QuestionId } into g
            select new
            {
                g.Key.CourseSectionSurveyId,
                g.Key.QuestionId,
                Count = g.Count(),
                Total = g.Sum(x => Convert.ToDecimal(x.AnswerValue))
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(x => new SectionQuestionStat(x.CourseSectionSurveyId, x.QuestionId, x.Count, x.Total))
            .ToList();
    }

    /// <summary>
    /// Trung vị. Dùng thay trung bình khi so mặt bằng: một lớp cá biệt điểm rất
    /// thấp sẽ kéo trung bình xuống, làm mọi người khác trông như trên mặt bằng.
    /// </summary>
    private static decimal? Median(IReadOnlyList<decimal> values)
    {
        if (values.Count == 0) return null;
        var sorted = values.OrderBy(x => x).ToList();
        var middle = sorted.Count / 2;
        return sorted.Count % 2 == 1
            ? Math.Round(sorted[middle], 2)
            : Math.Round((sorted[middle - 1] + sorted[middle]) / 2, 2);
    }

    /// <summary>Độ lệch chuẩn mẫu. Dưới hai phần tử thì không tồn tại.</summary>
    private static decimal? SampleStandardDeviation(IReadOnlyList<decimal> values)
    {
        if (values.Count < 2) return null;
        var mean = values.Average();
        var sumSquares = values.Sum(x => (x - mean) * (x - mean));
        return Math.Round((decimal)Math.Sqrt((double)(sumSquares / (values.Count - 1))), 3);
    }

    public async Task<SurveyOperationResult<SemesterSurveyNormalizationDto>> GetSemesterSurveyNormalizationAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<SemesterSurveyNormalizationDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);

        var schoolScores = sections.Select(x => x.AverageScore).ToList();
        var schoolAverage = schoolScores.Count == 0 ? 0m : Math.Round(schoolScores.Average(), 3);
        var schoolSd = SampleStandardDeviation(schoolScores);

        var groups = sections
            .GroupBy(x => new { x.FacultyId, x.FacultyName })
            .Select(g =>
            {
                var scores = g.Select(x => x.AverageScore).ToList();
                return new NormalizationGroupDto(
                    g.Key.FacultyId,
                    g.Key.FacultyName,
                    scores.Count,
                    Math.Round(scores.Average(), 3),
                    SampleStandardDeviation(scores),
                    scores.Count >= ReportThresholds.MinimumSectionsForNormalization);
            })
            .OrderByDescending(x => x.SectionCount)
            .ThenBy(x => x.FacultyName)
            .ToList();
        var groupByFaculty = groups.ToDictionary(x => x.FacultyName);

        var rows = sections
            .Select(section =>
            {
                var group = groupByFaculty[section.FacultyName];

                // SD bằng 0 nghĩa là mọi lớp cùng điểm: Z không xác định, để null
                // thay vì chia cho 0.
                decimal? zSchool = schoolSd is > 0
                    ? Math.Round((section.AverageScore - schoolAverage) / schoolSd.Value, 2)
                    : null;
                decimal? zFaculty = group.CanNormalize && group.StandardDeviation is > 0
                    ? Math.Round((section.AverageScore - group.AverageScore) / group.StandardDeviation.Value, 2)
                    : null;

                var verdict = Verdict(group, zSchool, zFaculty);

                return new NormalizedSectionDto(
                    section.CourseSectionSurveyId,
                    section.CourseCode,
                    section.CourseName,
                    section.SectionName,
                    section.LecturerName,
                    section.FacultyName,
                    section.ClassSize,
                    section.AverageScore,
                    zSchool,
                    zFaculty,
                    zSchool is not null && zFaculty is not null
                        ? Math.Round(zFaculty.Value - zSchool.Value, 2)
                        : null,
                    verdict);
            })
            .OrderBy(x => x.FacultyName)
            .ThenBy(x => x.CourseCode)
            .ThenBy(x => x.SectionName)
            .ToList();

        return Succeeded(new SemesterSurveyNormalizationDto(
            semesterSurveyId,
            header.TemplateName,
            header.SemesterName,
            header.AcademicYearName,
            sections.Count,
            schoolAverage,
            schoolSd,
            groups,
            rows));
    }

    /// <summary>
    /// Kết luận cho một lớp. Ưu tiên nêu bật trường hợp hai cách so cho kết luận
    /// trái ngược — đó mới là thứ chuẩn hoá sinh ra để phát hiện.
    /// </summary>
    private static string Verdict(NormalizationGroupDto group, decimal? zSchool, decimal? zFaculty)
    {
        if (!group.CanNormalize || zFaculty is null) return NormalizationVerdicts.FacultyTooSmall;

        var notable = ReportThresholds.NotableZScore;
        if (zSchool is { } zs
            && ((zs >= notable && zFaculty <= -notable) || (zs <= -notable && zFaculty >= notable)))
        {
            return NormalizationVerdicts.ConclusionFlips;
        }

        if (zFaculty >= notable) return NormalizationVerdicts.AboveFaculty;
        if (zFaculty <= -notable) return NormalizationVerdicts.BelowFaculty;
        return NormalizationVerdicts.Normal;
    }

    public async Task<SurveyOperationResult<SemesterSurveyDepartmentSummaryDto>> GetSemesterSurveyDepartmentSummaryAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<SemesterSurveyDepartmentSummaryDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);

        // Câu yếu nhất của từng bộ môn: gộp điểm từng câu trên mọi lớp của bộ môn.
        // Bỏ câu bẫy và câu tự nhập, đánh số theo vị trí gốc trong bộ câu hỏi.
        var questionOrder = await QuestionOrderMapAsync(header.SurveyTemplateId, cancellationToken);
        var cssToDepartment = sections.ToDictionary(x => x.CourseSectionSurveyId, x => x.DepartmentName);
        var cssIds = sections.Select(x => x.CourseSectionSurveyId).ToList();

        var perQuestion = await SectionQuestionStatsAsync(
            cssIds, questionOrder.Keys.ToList(), cancellationToken);

        var weakestByDepartment = perQuestion
            .Where(x => cssToDepartment.ContainsKey(x.CourseSectionSurveyId))
            .GroupBy(x => new { Department = cssToDepartment[x.CourseSectionSurveyId], x.QuestionId })
            .Select(g => new
            {
                g.Key.Department,
                g.Key.QuestionId,
                Score = g.Sum(x => x.Total) / g.Sum(x => x.AnswerCount)
            })
            .GroupBy(x => x.Department)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(x => x.Score).First());

        var rows = sections
            .GroupBy(x => new { x.FacultyId, x.FacultyName, x.DepartmentId, x.DepartmentName })
            .Select(g =>
            {
                var scores = g.Select(x => x.AverageScore).ToList();
                var totalResponses = g.Sum(x => x.ResponseCount);
                var withClassSize = g.Where(x => x.ClassSize > 0).ToList();
                var weakest = weakestByDepartment.GetValueOrDefault(g.Key.DepartmentName);

                return new DepartmentSummaryRowDto(
                    g.Key.FacultyId,
                    g.Key.FacultyName,
                    g.Key.DepartmentId,
                    g.Key.DepartmentName,
                    g.Count(),
                    CountLecturers(g),
                    totalResponses,
                    withClassSize.Count == 0
                        ? 0m
                        : Math.Round(
                            withClassSize.Average(x => (decimal)x.ResponseCount / x.ClassSize) * 100, 1),
                    scores.Count == 0 ? null : Math.Round(scores.Average(), 2),
                    scores.Count(x => x < ReportThresholds.LowScore),
                    weakest is null ? null : questionOrder[weakest.QuestionId].Order,
                    weakest is null ? null : Math.Round(weakest.Score, 2),
                    weakest is null ? null : questionOrder[weakest.QuestionId].Text);
            })
            .OrderBy(x => x.FacultyName)
            .ThenBy(x => x.DepartmentName)
            .ToList();

        return Succeeded(new SemesterSurveyDepartmentSummaryDto(
            semesterSurveyId,
            header.TemplateName,
            header.SemesterName,
            header.AcademicYearName,
            rows));
    }

    public async Task<SurveyOperationResult<SemesterSurveyCourseDiagnosisDto>> GetSemesterSurveyCourseDiagnosisAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<SemesterSurveyCourseDiagnosisDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);
        var rows = await BuildCourseDiagnosisAsync(header.SurveyTemplateId, sections, cancellationToken);

        return Succeeded(new SemesterSurveyCourseDiagnosisDto(
            semesterSurveyId,
            header.TemplateName,
            header.SemesterName,
            header.AcademicYearName,
            rows));
    }

    /// <summary>
    /// Gộp các lớp theo học phần và ra kết luận cho từng học phần. Tách riêng vì
    /// màn hình tổng quan cũng cần đúng phép đếm này, và hai chỗ mà tính lệch
    /// nhau thì người dùng sẽ thấy hai con số khác nhau cho cùng một việc.
    /// </summary>
    private async Task<List<CourseDiagnosisRowDto>> BuildCourseDiagnosisAsync(
        int surveyTemplateId,
        List<AnalysedSection> sections,
        CancellationToken cancellationToken)
    {
        if (sections.Count == 0) return [];

        // Cần CourseId để gộp; AnalysedSection chỉ mang mã và tên nên tra lại.
        var sectionIds = sections.Select(x => x.CourseSectionId).ToList();
        var courseIdBySection = await db.CourseSections.AsNoTracking()
            .Where(x => sectionIds.Contains(x.CourseSectionId))
            .ToDictionaryAsync(x => x.CourseSectionId, x => x.CourseId, cancellationToken);

        var questionOrder = await QuestionOrderMapAsync(surveyTemplateId, cancellationToken);
        var cssIds = sections.Select(x => x.CourseSectionSurveyId).ToList();
        var perQuestion = await SectionQuestionStatsAsync(
            cssIds, questionOrder.Keys.ToList(), cancellationToken);

        var courseOfCss = sections
            .Where(x => courseIdBySection.ContainsKey(x.CourseSectionId))
            .ToDictionary(
                x => x.CourseSectionSurveyId,
                x => courseIdBySection[x.CourseSectionId]);

        // Câu yếu nhất của từng học phần: gộp mọi lớp của học phần đó.
        var weakestByCourse = perQuestion
            .Where(x => courseOfCss.ContainsKey(x.CourseSectionSurveyId))
            .GroupBy(x => new { CourseId = courseOfCss[x.CourseSectionSurveyId], x.QuestionId })
            .Select(g => new
            {
                g.Key.CourseId,
                g.Key.QuestionId,
                Score = g.Sum(x => x.Total) / g.Sum(x => x.AnswerCount)
            })
            .GroupBy(x => x.CourseId)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Score).First());

        return sections
            .Where(x => courseIdBySection.ContainsKey(x.CourseSectionId))
            .GroupBy(x => courseIdBySection[x.CourseSectionId])
            .Select(g =>
            {
                var scores = g.Select(x => x.AverageScore).ToList();
                var min = scores.Min();
                var max = scores.Max();
                var spread = Math.Round(max - min, 2);
                var first = g.First();
                var weakest = weakestByCourse.GetValueOrDefault(g.Key);

                return new CourseDiagnosisRowDto(
                    g.Key,
                    first.CourseCode,
                    first.CourseName,
                    first.FacultyName,
                    g.Count(),
                    CountLecturers(g),
                    Math.Round(scores.Average(), 2),
                    min,
                    max,
                    spread,
                    weakest is null ? null : questionOrder[weakest.QuestionId].Order,
                    weakest is null ? null : Math.Round(weakest.Score, 2),
                    weakest is null ? null : questionOrder[weakest.QuestionId].Text,
                    DiagnoseCourse(min, max, spread));
            })
            .OrderBy(x => x.CourseCode)
            .ToList();
    }

    /// <summary>
    /// Bốn kết luận, xét theo thứ tự ưu tiên. "Mọi lớp đều thấp" xét trước vì đó
    /// là tín hiệu mạnh nhất: lớp tốt nhất còn dưới ngưỡng thì biên độ rộng hay
    /// hẹp cũng không đổi được kết luận.
    /// Học phần một lớp có biên độ bằng 0 nên không bao giờ rơi vào nhóm quy cho
    /// giảng viên — đúng, vì một lớp thì không có gì để so.
    /// </summary>
    private static string DiagnoseCourse(decimal min, decimal max, decimal spread)
    {
        if (max < ReportThresholds.LowScore) return CourseDiagnosisVerdicts.CourseIssue;
        if (min >= ReportThresholds.GoodScore) return CourseDiagnosisVerdicts.AllGood;
        if (spread >= ReportThresholds.WideSpread) return CourseDiagnosisVerdicts.LecturerVariance;
        return CourseDiagnosisVerdicts.Inconclusive;
    }

    public async Task<SurveyOperationResult<SemesterSurveyDashboardDto>> GetSemesterSurveyDashboardAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<SemesterSurveyDashboardDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        // Bốn chỉ số đầu là TIẾN ĐỘ: đếm mọi lớp của đợt và mọi phiếu thu được,
        // kể cả phiếu bị lọc nhiễu — đó vẫn là phiếu sinh viên đã nộp. Phần điểm
        // bên dưới mới lọc phiếu hợp lệ.
        var allSectionSurveys = await db.CourseSectionSurveys.AsNoTracking()
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .Select(x => new { x.CourseSectionSurveyId, x.CourseSectionId })
            .ToListAsync(cancellationToken);

        var allSectionIds = allSectionSurveys.Select(x => x.CourseSectionId).ToList();
        var totalClassSize = await db.CourseSections.AsNoTracking()
            .Where(x => allSectionIds.Contains(x.CourseSectionId))
            .SumAsync(x => (int?)x.ClassSize, cancellationToken) ?? 0;

        var allCssIds = allSectionSurveys.Select(x => x.CourseSectionSurveyId).ToList();
        var totalResponseCount = await db.SurveyResponses.AsNoTracking()
            .CountAsync(x => allCssIds.Contains(x.CourseSectionSurveyId), cancellationToken);

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);

        var questionOrder = await QuestionOrderMapAsync(header.SurveyTemplateId, cancellationToken);
        var perQuestion = await SectionQuestionStatsAsync(
            sections.Select(x => x.CourseSectionSurveyId).ToList(),
            questionOrder.Keys.ToList(),
            cancellationToken);

        var questions = perQuestion
            .GroupBy(x => x.QuestionId)
            .Where(g => g.Sum(x => x.AnswerCount) > 0)
            .Select(g => new DashboardQuestionScoreDto(
                questionOrder[g.Key].Order,
                questionOrder[g.Key].Text,
                Math.Round(g.Sum(x => x.Total) / g.Sum(x => x.AnswerCount), 2),
                // Đếm theo LỚP chứ không theo phiếu: một câu bị nhiều lớp chấm
                // thấp là vấn đề hệ thống, còn một lớp chấm thấp thì chỉ là cá biệt.
                g.Count(x => x.AnswerCount > 0 && x.Average < ReportThresholds.LowScore)))
            .OrderBy(x => x.QuestionOrder)
            .ToList();

        var faculties = sections
            .GroupBy(x => new { x.FacultyId, x.FacultyName })
            .Select(g => new DashboardFacultyScoreDto(
                g.Key.FacultyId,
                g.Key.FacultyName,
                g.Count(),
                Math.Round(g.Average(x => x.AverageScore), 2)))
            .OrderByDescending(x => x.AverageScore)
            .ToList();

        var courseRows = await BuildCourseDiagnosisAsync(
            header.SurveyTemplateId, sections, cancellationToken);

        return Succeeded(new SemesterSurveyDashboardDto(
            semesterSurveyId,
            header.TemplateName,
            header.SemesterName,
            header.AcademicYearName,
            allSectionSurveys.Count,
            totalResponseCount,
            totalClassSize == 0
                ? 0m
                : Math.Round((decimal)totalResponseCount / totalClassSize * 100, 1),
            sections.Count == 0 ? null : Math.Round(sections.Average(x => x.AverageScore), 2),
            sections.Count,
            questions,
            questions.OrderBy(x => x.AverageScore).Take(5).ToList(),
            faculties,
            courseRows.Count(x => x.Verdict == CourseDiagnosisVerdicts.CourseIssue),
            courseRows.Count(x => x.Verdict == CourseDiagnosisVerdicts.LecturerVariance)));
    }

    public async Task<SurveyOperationResult<IReadOnlyList<LecturerOptionDto>>> GetSemesterSurveyLecturersAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<IReadOnlyList<LecturerOptionDto>>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);

        // Lớp chưa gắn được giảng viên thì không có ai để làm báo cáo cá nhân.
        // Gom theo mã giảng viên và chỉ theo mã. Bộ môn/khoa của một lớp suy từ
        // đơn vị sở hữu học phần chứ không từ hồ sơ giảng viên, nên người dạy học
        // phần của nhiều đơn vị có nhiều giá trị khác nhau; đưa chúng vào khóa gom
        // thì cùng một người bị tách thành nhiều dòng trùng mã và số lớp bị chia
        // nhỏ. Đơn vị lấy theo lớp đầu tiên, chỉ dùng để hiển thị và lọc.
        var options = sections
            .Where(x => x.LecturerId is not null)
            .GroupBy(x => x.LecturerId!.Value)
            .Select(g => new LecturerOptionDto(
                g.Key,
                g.First().LecturerName,
                g.First().DepartmentName,
                g.First().FacultyName,
                g.Count()))
            .OrderBy(x => x.FacultyName)
            .ThenBy(x => x.DepartmentName)
            .ThenBy(x => x.FullName)
            .ToList();

        return Succeeded<IReadOnlyList<LecturerOptionDto>>(options);
    }

    public async Task<SurveyOperationResult<LecturerReportDto>> GetLecturerSurveyReportAsync(
        int semesterSurveyId,
        int lecturerId,
        CancellationToken cancellationToken = default)
    {
        var header = await LoadSurveyHeaderAsync(semesterSurveyId, cancellationToken);
        if (header is null)
        {
            return Failed<LecturerReportDto>(SurveyErrorCodes.SemesterSurveyNotFound);
        }

        var sections = await LoadAnalysedSectionsAsync(semesterSurveyId, cancellationToken);
        var mine = sections.Where(x => x.LecturerId == lecturerId).ToList();
        if (mine.Count == 0)
        {
            return Failed<LecturerReportDto>(SurveyErrorCodes.LecturerHasNoSections);
        }

        var facultyName = mine[0].FacultyName;
        var departmentName = mine[0].DepartmentName;

        // Z trong khoa dùng đúng mặt bằng khoa như sheet 1, để hai màn hình không
        // nói hai con số khác nhau cho cùng một lớp.
        var facultyScores = sections.Where(x => x.FacultyName == facultyName)
            .Select(x => x.AverageScore).ToList();
        var facultyMean = facultyScores.Average();
        var facultySd = SampleStandardDeviation(facultyScores);
        var canNormalize = facultyScores.Count >= ReportThresholds.MinimumSectionsForNormalization
            && facultySd is > 0;

        var questionOrder = await QuestionOrderMapAsync(header.SurveyTemplateId, cancellationToken);
        var perQuestion = await SectionQuestionStatsAsync(
            sections.Select(x => x.CourseSectionSurveyId).ToList(),
            questionOrder.Keys.ToList(),
            cancellationToken);

        // Cả ba con số so sánh đều lấy từ cùng một tập: điểm trung bình của từng
        // LỚP cho câu đó. Giảng viên lấy trung bình các lớp mình dạy, bộ môn và
        // khoa lấy trung vị các lớp thuộc đơn vị.
        var departmentCss = sections.Where(x => x.DepartmentName == departmentName)
            .Select(x => x.CourseSectionSurveyId).ToHashSet();
        var facultyCss = sections.Where(x => x.FacultyName == facultyName)
            .Select(x => x.CourseSectionSurveyId).ToHashSet();
        var myCss = mine.Select(x => x.CourseSectionSurveyId).ToHashSet();

        var comparisons = new List<LecturerQuestionComparisonDto>();
        foreach (var (questionId, info) in questionOrder.OrderBy(x => x.Value.Order))
        {
            var stats = perQuestion.Where(x => x.QuestionId == questionId && x.AnswerCount > 0).ToList();

            var mineScores = stats.Where(x => myCss.Contains(x.CourseSectionSurveyId))
                .Select(x => x.Average).ToList();
            if (mineScores.Count == 0) continue;

            var departmentMedian = Median(
                stats.Where(x => departmentCss.Contains(x.CourseSectionSurveyId))
                    .Select(x => x.Average).ToList());
            var facultyMedian = Median(
                stats.Where(x => facultyCss.Contains(x.CourseSectionSurveyId))
                    .Select(x => x.Average).ToList());
            var lecturerScore = Math.Round(mineScores.Average(), 2);

            comparisons.Add(new LecturerQuestionComparisonDto(
                info.Order,
                info.Text,
                lecturerScore,
                departmentMedian,
                facultyMedian,
                departmentMedian is null ? null : Math.Round(lecturerScore - departmentMedian.Value, 2)));
        }

        var sectionRows = mine
            .Select(x => new LecturerSectionDto(
                x.CourseSectionSurveyId,
                x.CourseCode,
                x.CourseName,
                x.SectionName,
                x.ClassSize,
                x.ResponseCount,
                x.ClassSize > 0 ? Math.Round((decimal)x.ResponseCount / x.ClassSize * 100, 1) : 0m,
                x.AverageScore,
                canNormalize
                    ? Math.Round((x.AverageScore - facultyMean) / facultySd!.Value, 2)
                    : null))
            .OrderBy(x => x.CourseCode)
            .ThenBy(x => x.SectionName)
            .ToList();

        return Succeeded(new LecturerReportDto(
            lecturerId,
            mine[0].LecturerName,
            departmentName,
            facultyName,
            mine.Count,
            mine.Sum(x => x.ResponseCount),
            Math.Round(mine.Average(x => x.AverageScore), 2),
            sectionRows,
            comparisons));
    }

    private sealed record SurveyHeader(
        int SurveyTemplateId,
        string TemplateName,
        string SemesterName,
        string AcademicYearName);

    private async Task<SurveyHeader?> LoadSurveyHeaderAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken)
    {
        var semesterSurvey = await db.SemesterSurveys.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == semesterSurveyId, cancellationToken);
        if (semesterSurvey is null) return null;

        var template = await db.SurveyTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
        var semester = await db.Semesters.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SemesterId == semesterSurvey.SemesterId, cancellationToken);
        var academicYear = semester is null
            ? null
            : await db.AcademicYears.AsNoTracking()
                .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

        return new SurveyHeader(
            semesterSurvey.SurveyTemplateId,
            template?.TemplateName ?? string.Empty,
            semester?.SemesterName ?? string.Empty,
            academicYear?.AcademicYearName ?? string.Empty);
    }

    /// <summary>
    /// Các câu chấm điểm của một bộ, kèm số thứ tự theo VỊ TRÍ GỐC trong bộ. Câu
    /// bẫy và câu tự nhập không có mặt nhưng vẫn chiếm số thứ tự, nên bộ 30 câu
    /// có bẫy ở vị trí 16 sẽ cho C1..C15 và C17..C30.
    /// </summary>
    private async Task<Dictionary<int, (int Order, string Text)>> QuestionOrderMapAsync(
        int surveyTemplateId,
        CancellationToken cancellationToken)
    {
        var all = await (
            from q in db.SurveyQuestions.AsNoTracking()
            join s in db.AnswerScales.AsNoTracking() on q.AnswerScaleId equals s.AnswerScaleId
            where q.SurveyTemplateId == surveyTemplateId
            orderby q.QuestionId
            select new { q.QuestionId, q.QuestionText, q.AttentionCheckValue, s.ScaleKind })
            .ToListAsync(cancellationToken);

        return all
            .Select((q, index) => new { Question = q, Order = index + 1 })
            .Where(x => x.Question.AttentionCheckValue == null
                && x.Question.ScaleKind == AnswerScaleKinds.Options)
            .ToDictionary(
                x => x.Question.QuestionId,
                x => (x.Order, x.Question.QuestionText));
    }

    /// <summary>Cột timestamptz của Npgsql chỉ nhận DateTime có Kind = Utc.</summary>
    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime(),
    };

    private sealed record AnswerScaleValidation(
        string? ErrorCode,
        string Name,
        string ScaleKind,
        IReadOnlyList<SaveAnswerScaleOptionCommand> Options);

    private async Task<AnswerScaleValidation> ValidateAnswerScaleAsync(
        SaveAnswerScaleCommand command,
        int? exceptAnswerScaleId,
        CancellationToken cancellationToken)
    {
        var name = command.AnswerScaleName?.Trim() ?? string.Empty;
        var kind = command.ScaleKind?.Trim() ?? string.Empty;

        if (name.Length == 0)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleNameRequired, name, kind, []);
        }
        if (!AnswerScaleKinds.IsValid(kind))
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleKindInvalid, name, kind, []);
        }

        var names = await db.AnswerScales
            .Where(x => exceptAnswerScaleId == null || x.AnswerScaleId != exceptAnswerScaleId)
            .Select(x => x.AnswerScaleName)
            .ToListAsync(cancellationToken);
        if (names.Any(x => NormalizeKey(x) == NormalizeKey(name)))
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleNameExists, name, kind, []);
        }

        var options = (command.Options ?? [])
            .Select(option => new SaveAnswerScaleOptionCommand(
                option.Value,
                option.DisplayText?.Trim() ?? string.Empty))
            .ToList();

        // Thang tự nhập chữ không có mức nào để chọn.
        if (kind == AnswerScaleKinds.Text)
        {
            return options.Count > 0
                ? new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleTextHasOptions, name, kind, [])
                : new AnswerScaleValidation(null, name, kind, []);
        }

        if (options.Count < 2 || options.Count > MaximumScaleOptions)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionsInvalid, name, kind, []);
        }
        // Value không cần liên tiếp: thang 'Có/Không' dùng 1 và 5 để cùng dải điểm
        // với thang mức độ hài lòng.
        if (options.Any(x => x.Value is < 1 or > MaximumScaleOptions)
            || options.Select(x => x.Value).Distinct().Count() != options.Count)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionsInvalid, name, kind, []);
        }
        if (options.Any(x => x.DisplayText.Length == 0))
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionTextRequired, name, kind, []);
        }

        return new AnswerScaleValidation(null, name, kind, options.OrderBy(x => x.Value).ToList());
    }

    private sealed record TemplateValidation(
        string? ErrorCode,
        string Name,
        IReadOnlyList<SaveSurveyQuestionCommand> Questions);

    private async Task<TemplateValidation> ValidateTemplateAsync(
        SaveSurveyTemplateCommand command,
        int? exceptTemplateId,
        CancellationToken cancellationToken)
    {
        var name = command.TemplateName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateNameRequired, name, []);
        }

        var names = await db.SurveyTemplates
            .Where(x => exceptTemplateId == null || x.SurveyTemplateId != exceptTemplateId)
            .Select(x => x.TemplateName)
            .ToListAsync(cancellationToken);
        if (names.Any(x => NormalizeKey(x) == NormalizeKey(name)))
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateNameExists, name, []);
        }

        var questions = (command.Questions ?? [])
            .Select(question => new SaveSurveyQuestionCommand(
                question.QuestionText?.Trim() ?? string.Empty,
                question.AnswerScaleId,
                question.AttentionCheckValue))
            .Where(question => question.QuestionText.Length > 0)
            .ToList();

        if (questions.Count == 0)
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateQuestionsRequired, name, []);
        }
        if (questions.Count > SurveyRules.MaximumQuestionsPerTemplate)
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateTooManyQuestions, name, []);
        }

        // Mỗi câu mang thang riêng nên phải kiểm tất cả mã thang được dùng.
        var scaleIds = questions.Select(x => x.AnswerScaleId).Distinct().ToList();
        var scales = await db.AnswerScales
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .Select(x => new { x.AnswerScaleId, x.ScaleKind })
            .ToListAsync(cancellationToken);
        if (scales.Count != scaleIds.Count)
        {
            return new TemplateValidation(SurveyErrorCodes.QuestionScaleNotFound, name, []);
        }

        // Câu bẫy phải đặt được: thang có mức chọn sẵn, và mức bắt buộc phải là
        // một mức có thật của chính thang đó. Không thể bắt "chọn mức 3" trên
        // thang Có/Không vì thang đó chỉ có mức 1 và 5.
        if (questions.Any(x => x.AttentionCheckValue is not null))
        {
            var kindByScale = scales.ToDictionary(x => x.AnswerScaleId, x => x.ScaleKind);
            var optionValuesByScale = (await db.AnswerScaleOptions
                    .Where(x => scaleIds.Contains(x.AnswerScaleId))
                    .Select(x => new { x.AnswerScaleId, x.Value })
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.AnswerScaleId)
                .ToDictionary(group => group.Key, group => group.Select(x => x.Value).ToHashSet());

            foreach (var question in questions)
            {
                if (question.AttentionCheckValue is not { } required) continue;

                if (kindByScale[question.AnswerScaleId] != AnswerScaleKinds.Options)
                {
                    return new TemplateValidation(SurveyErrorCodes.AttentionCheckOnTextScale, name, []);
                }
                if (!optionValuesByScale.TryGetValue(question.AnswerScaleId, out var values)
                    || !values.Contains(required))
                {
                    return new TemplateValidation(SurveyErrorCodes.AttentionCheckValueInvalid, name, []);
                }
            }
        }

        return new TemplateValidation(null, name, questions);
    }

    private static AnswerScaleDto ToDto(AnswerScale scale, IReadOnlyList<AnswerScaleOption> options) =>
        new(
            scale.AnswerScaleId,
            scale.AnswerScaleName,
            scale.ScaleKind,
            options
                .OrderBy(x => x.Value)
                .Select(x => new AnswerScaleOptionDto(
                    x.AnswerScaleOptionId,
                    x.AnswerScaleId,
                    x.Value,
                    x.DisplayText))
                .ToList());

    private static SurveyTemplateDto ToDto(SurveyTemplate template, IReadOnlyList<SurveyQuestion> questions) =>
        new(
            template.SurveyTemplateId,
            template.TemplateName,
            template.CreatedAt,
            questions
                .OrderBy(x => x.QuestionId)
                .Select(x => new SurveyQuestionDto(
                    x.QuestionId,
                    x.SurveyTemplateId,
                    x.QuestionText,
                    x.AnswerScaleId,
                    x.AttentionCheckValue))
                .ToList());

    /// <summary>Các thang (kèm mức) mà một bộ câu hỏi đang dùng.</summary>
    private async Task<IReadOnlyList<AnswerScaleDto>> ScalesOfTemplateAsync(
        int surveyTemplateId,
        CancellationToken cancellationToken)
    {
        var scaleIds = await db.SurveyQuestions
            .AsNoTracking()
            .Where(x => x.SurveyTemplateId == surveyTemplateId)
            .Select(x => x.AnswerScaleId)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (scaleIds.Count == 0) return [];

        var scales = await db.AnswerScales
            .AsNoTracking()
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .ToListAsync(cancellationToken);
        var options = await db.AnswerScaleOptions
            .AsNoTracking()
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .OrderBy(x => x.Value)
            .ToListAsync(cancellationToken);

        return scales
            .OrderBy(x => x.AnswerScaleId)
            .Select(scale => ToDto(
                scale,
                options.Where(option => option.AnswerScaleId == scale.AnswerScaleId).ToList()))
            .ToList();
    }

    /// <summary>
    /// Điểm của một phiếu: trung bình các câu thuộc thang 'Options' và không phải
    /// câu bẫy. Câu thang 'Text' không có giá trị số nên không tham gia; câu bẫy
    /// ép chọn một mức cố định nên điểm của nó vô nghĩa, tính vào sẽ kéo lệch.
    /// </summary>
    private static decimal ComputeScore(IReadOnlyList<int> scoredValues) =>
        scoredValues.Count == 0
            ? 0m
            : Math.Round((decimal)scoredValues.Average(), 2);

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();

    private static SurveyOperationResult<T> Succeeded<T>(T value) => new(true, null, value);

    private static SurveyOperationResult<T> Failed<T>(string errorCode) => new(false, errorCode, default);

    // --------------------------------------------------------------- Restore

    public async Task<SurveyOperationResult<bool>> RestoreAnswerScaleAsync(
        int answerScaleId,
        CancellationToken cancellationToken = default)
    {
        var scale = await db.AnswerScales.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.AnswerScaleId == answerScaleId && x.IsDeleted, cancellationToken);
        if (scale is null) return Failed<bool>(SurveyErrorCodes.AnswerScaleNotFound);
        scale.IsDeleted = false;
        scale.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    public async Task<SurveyOperationResult<bool>> RestoreSurveyTemplateAsync(
        int surveyTemplateId,
        CancellationToken cancellationToken = default)
    {
        var template = await db.SurveyTemplates.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == surveyTemplateId && x.IsDeleted, cancellationToken);
        if (template is null) return Failed<bool>(SurveyErrorCodes.TemplateNotFound);
        template.IsDeleted = false;
        template.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    public async Task<SurveyOperationResult<bool>> RestoreSemesterSurveyAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var survey = await db.SemesterSurveys.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == semesterSurveyId && x.IsDeleted, cancellationToken);
        if (survey is null) return Failed<bool>(SurveyErrorCodes.SemesterSurveyNotFound);
        survey.IsDeleted = false;
        survey.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }
}
