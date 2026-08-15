using Application.Surveys;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Surveys;

public sealed class EfSurveyService(AppDbContext db) : ISurveyService
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

        var scale = new AnswerScale { AnswerScaleName = validation.Name };
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

        scale.AnswerScaleName = validation.Name;

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

        // "SurveyTemplates"."AnswerScaleId" là ON DELETE RESTRICT.
        if (await db.SurveyTemplates.AnyAsync(x => x.AnswerScaleId == answerScaleId, cancellationToken))
        {
            return Failed<bool>(SurveyErrorCodes.AnswerScaleInUse);
        }

        db.AnswerScales.Remove(scale);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            return Failed<bool>(SurveyErrorCodes.AnswerScaleInUse);
        }

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
            AnswerScaleId = command.AnswerScaleId,
            CreatedAt = DateTime.UtcNow,
        };
        db.SurveyTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        var questions = validation.Questions
            .Select(text => new SurveyQuestion
            {
                SurveyTemplateId = template.SurveyTemplateId,
                QuestionText = text,
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
        template.AnswerScaleId = command.AnswerScaleId;

        // Ghi đè danh sách câu hỏi nhưng dùng lại dòng cũ theo thứ tự để giữ
        // "QuestionId" cho những câu đã có câu trả lời (ON DELETE RESTRICT).
        var existing = await db.SurveyQuestions
            .Where(x => x.SurveyTemplateId == surveyTemplateId)
            .OrderBy(x => x.QuestionId)
            .ToListAsync(cancellationToken);

        for (var index = 0; index < validation.Questions.Count; index++)
        {
            if (index < existing.Count)
            {
                existing[index].QuestionText = validation.Questions[index];
            }
            else
            {
                db.SurveyQuestions.Add(new SurveyQuestion
                {
                    SurveyTemplateId = surveyTemplateId,
                    QuestionText = validation.Questions[index],
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

        db.SurveyTemplates.Remove(template);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // "SemesterSurveys"."SurveyTemplateId" là ON DELETE RESTRICT.
            db.ChangeTracker.Clear();
            return Failed<bool>(SurveyErrorCodes.TemplateInUse);
        }

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
        var sectionSurveyIds = await db.CourseSectionSurveys
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .Select(x => x.CourseSectionSurveyId)
            .ToListAsync(cancellationToken);
        if (await db.SurveyResponses
            .AnyAsync(x => sectionSurveyIds.Contains(x.CourseSectionSurveyId), cancellationToken))
        {
            return Failed<bool>(SurveyErrorCodes.SemesterSurveyHasResponses);
        }

        db.SemesterSurveys.Remove(survey);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    public async Task<IReadOnlyList<CourseSectionSurveyDto>> GetCourseSectionSurveysAsync(
        int semesterSurveyId,
        CancellationToken cancellationToken = default)
    {
        var sectionSurveys = await db.CourseSectionSurveys
            .Where(x => x.SemesterSurveyId == semesterSurveyId)
            .ToListAsync(cancellationToken);
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

        var options = await AnswerOptionsOfSectionSurveyAsync(sectionSurvey, cancellationToken);
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
                return new SurveyResponseSummaryDto(
                    response.ResponseId,
                    response.CourseSectionSurveyId,
                    response.SubmittedAt,
                    response.Score,
                    response.AdditionalComments,
                    responseAnswers.Count,
                    // Giữ đủ các mức của thang, mức không ai chọn hiển thị 0.
                    options
                        .Select(option => new SurveyResponseValueCountDto(
                            option.Value,
                            option.DisplayText,
                            responseAnswers.Count(answer => answer.SelectedValue == option.Value)))
                        .ToList());
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

        var options = await AnswerOptionsOfSectionSurveyAsync(sectionSurvey, cancellationToken);
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
            options,
            questions
                .Select(question =>
                {
                    var answer = answers.FirstOrDefault(x => x.QuestionId == question.QuestionId);
                    return new SurveyResponseAnswerDto(
                        question.QuestionId,
                        question.QuestionText,
                        answer?.SelectedValue ?? 0,
                        options.FirstOrDefault(option => option.Value == answer?.SelectedValue)?.DisplayText
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
        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.LinkToken == token, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<PublicSurveyDto>(SurveyErrorCodes.LinkNotFound);
        }

        var semesterSurvey = await db.SemesterSurveys
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId, cancellationToken);
        if (semesterSurvey is null)
        {
            return Failed<PublicSurveyDto>(SurveyErrorCodes.LinkNotFound);
        }

        var template = await db.SurveyTemplates
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
        if (template is null)
        {
            return Failed<PublicSurveyDto>(SurveyErrorCodes.TemplateNotFound);
        }

        var questions = await db.SurveyQuestions
            .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
            .OrderBy(x => x.QuestionId)
            .Select(x => new PublicSurveyQuestionDto(x.QuestionId, x.QuestionText))
            .ToListAsync(cancellationToken);
        var options = await db.AnswerScaleOptions
            .Where(x => x.AnswerScaleId == template.AnswerScaleId)
            .OrderBy(x => x.Value)
            .Select(x => new AnswerScaleOptionDto(
                x.AnswerScaleOptionId,
                x.AnswerScaleId,
                x.Value,
                x.DisplayText))
            .ToListAsync(cancellationToken);

        var section = await db.CourseSections
            .FirstOrDefaultAsync(x => x.CourseSectionId == sectionSurvey.CourseSectionId, cancellationToken);
        var course = section is null
            ? null
            : await db.Courses.FirstOrDefaultAsync(x => x.CourseId == section.CourseId, cancellationToken);
        var lecturer = section is null
            ? null
            : await db.Lecturers.FirstOrDefaultAsync(x => x.LecturerId == section.LecturerId, cancellationToken);
        var semester = section is null
            ? null
            : await db.Semesters.FirstOrDefaultAsync(x => x.SemesterId == section.SemesterId, cancellationToken);
        var academicYear = semester is null
            ? null
            : await db.AcademicYears
                .FirstOrDefaultAsync(x => x.AcademicYearId == semester.AcademicYearId, cancellationToken);

        var now = DateTime.UtcNow;
        return Succeeded(new PublicSurveyDto(
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
            now >= sectionSurvey.StartTime && now <= sectionSurvey.EndTime,
            options,
            questions));
    }

    public async Task<SurveyOperationResult<SubmitSurveyResponseDto>> SubmitSurveyResponseAsync(
        string linkToken,
        SubmitSurveyResponseCommand command,
        CancellationToken cancellationToken = default)
    {
        var token = linkToken?.Trim() ?? string.Empty;
        var sectionSurvey = await db.CourseSectionSurveys
            .FirstOrDefaultAsync(x => x.LinkToken == token, cancellationToken);
        if (sectionSurvey is null)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.LinkNotFound);
        }

        var now = DateTime.UtcNow;
        if (now < sectionSurvey.StartTime || now > sectionSurvey.EndTime)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.LinkNotOpen);
        }

        var semesterSurvey = await db.SemesterSurveys
            .FirstOrDefaultAsync(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId, cancellationToken);
        if (semesterSurvey is null)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.LinkNotFound);
        }

        var template = await db.SurveyTemplates
            .FirstOrDefaultAsync(x => x.SurveyTemplateId == semesterSurvey.SurveyTemplateId, cancellationToken);
        if (template is null)
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.TemplateNotFound);
        }

        var questionIds = await db.SurveyQuestions
            .Where(x => x.SurveyTemplateId == template.SurveyTemplateId)
            .Select(x => x.QuestionId)
            .ToListAsync(cancellationToken);
        var allowedValues = await db.AnswerScaleOptions
            .Where(x => x.AnswerScaleId == template.AnswerScaleId)
            .Select(x => x.Value)
            .ToListAsync(cancellationToken);

        var answers = (command.Answers ?? [])
            .GroupBy(x => x.QuestionId)
            .Select(group => group.Last())
            .ToList();

        if (questionIds.Count == 0
            || answers.Count != questionIds.Count
            || answers.Any(answer => !questionIds.Contains(answer.QuestionId)))
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswersIncomplete);
        }
        if (answers.Any(answer => !allowedValues.Contains(answer.SelectedValue)))
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.AnswerValueInvalid);
        }

        var comments = command.AdditionalComments?.Trim();
        if (comments is { Length: > MaximumCommentLength })
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.CommentsTooLong);
        }

        var response = new SurveyResponse
        {
            CourseSectionSurveyId = sectionSurvey.CourseSectionSurveyId,
            AdditionalComments = string.IsNullOrEmpty(comments) ? null : comments,
            Score = Math.Round((decimal)answers.Average(answer => answer.SelectedValue), 2),
            SubmittedAt = now,
        };
        db.SurveyResponses.Add(response);
        await db.SaveChangesAsync(cancellationToken);

        db.SurveyResponseAnswers.AddRange(answers.Select(answer => new SurveyResponseAnswer
        {
            ResponseId = response.ResponseId,
            QuestionId = answer.QuestionId,
            SelectedValue = answer.SelectedValue,
        }));
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new SubmitSurveyResponseDto(response.ResponseId, response.Score, response.SubmittedAt));
    }

    // ------------------------------------------------------------------ Helpers

    /// <summary>Các mức trả lời của thang mà bộ câu hỏi của bài khảo sát đang dùng.</summary>
    private async Task<IReadOnlyList<AnswerScaleOptionDto>> AnswerOptionsOfSectionSurveyAsync(
        CourseSectionSurvey sectionSurvey,
        CancellationToken cancellationToken)
    {
        var answerScaleId = await db.SemesterSurveys
            .Where(x => x.SemesterSurveyId == sectionSurvey.SemesterSurveyId)
            .Join(
                db.SurveyTemplates,
                semesterSurvey => semesterSurvey.SurveyTemplateId,
                template => template.SurveyTemplateId,
                (_, template) => template.AnswerScaleId)
            .FirstOrDefaultAsync(cancellationToken);

        return await db.AnswerScaleOptions
            .Where(x => x.AnswerScaleId == answerScaleId)
            .OrderBy(x => x.Value)
            .Select(x => new AnswerScaleOptionDto(
                x.AnswerScaleOptionId,
                x.AnswerScaleId,
                x.Value,
                x.DisplayText))
            .ToListAsync(cancellationToken);
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
        IReadOnlyList<SaveAnswerScaleOptionCommand> Options);

    private async Task<AnswerScaleValidation> ValidateAnswerScaleAsync(
        SaveAnswerScaleCommand command,
        int? exceptAnswerScaleId,
        CancellationToken cancellationToken)
    {
        var name = command.AnswerScaleName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleNameRequired, name, []);
        }

        var names = await db.AnswerScales
            .Where(x => exceptAnswerScaleId == null || x.AnswerScaleId != exceptAnswerScaleId)
            .Select(x => x.AnswerScaleName)
            .ToListAsync(cancellationToken);
        if (names.Any(x => NormalizeKey(x) == NormalizeKey(name)))
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleNameExists, name, []);
        }

        var options = (command.Options ?? [])
            .Select(option => new SaveAnswerScaleOptionCommand(
                option.Value,
                option.DisplayText?.Trim() ?? string.Empty))
            .ToList();

        if (options.Count < 2 || options.Count > MaximumScaleOptions)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionsInvalid, name, []);
        }
        if (options.Any(x => x.Value is < 1 or > MaximumScaleOptions)
            || options.Select(x => x.Value).Distinct().Count() != options.Count)
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionsInvalid, name, []);
        }
        if (options.Any(x => x.DisplayText.Length == 0))
        {
            return new AnswerScaleValidation(SurveyErrorCodes.AnswerScaleOptionTextRequired, name, []);
        }

        return new AnswerScaleValidation(null, name, options.OrderBy(x => x.Value).ToList());
    }

    private sealed record TemplateValidation(string? ErrorCode, string Name, IReadOnlyList<string> Questions);

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

        if (!await db.AnswerScales.AnyAsync(x => x.AnswerScaleId == command.AnswerScaleId, cancellationToken))
        {
            return new TemplateValidation(SurveyErrorCodes.AnswerScaleNotFound, name, []);
        }

        var questions = (command.Questions ?? [])
            .Select(text => text?.Trim() ?? string.Empty)
            .Where(text => text.Length > 0)
            .ToList();

        if (questions.Count == 0)
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateQuestionsRequired, name, []);
        }
        if (questions.Count > SurveyRules.MaximumQuestionsPerTemplate)
        {
            return new TemplateValidation(SurveyErrorCodes.TemplateTooManyQuestions, name, []);
        }

        return new TemplateValidation(null, name, questions);
    }

    private static AnswerScaleDto ToDto(AnswerScale scale, IReadOnlyList<AnswerScaleOption> options) =>
        new(
            scale.AnswerScaleId,
            scale.AnswerScaleName,
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
            template.AnswerScaleId,
            template.CreatedAt,
            questions
                .OrderBy(x => x.QuestionId)
                .Select(x => new SurveyQuestionDto(x.QuestionId, x.SurveyTemplateId, x.QuestionText))
                .ToList());

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();

    private static SurveyOperationResult<T> Succeeded<T>(T value) => new(true, null, value);

    private static SurveyOperationResult<T> Failed<T>(string errorCode) => new(false, errorCode, default);
}
