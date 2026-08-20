using Application.Surveys;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Surveys;

public sealed class EfSurveyService(AppDbContext db, IMemoryCache cache) : ISurveyService
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
            }
            else
            {
                db.SurveyQuestions.Add(new SurveyQuestion
                {
                    SurveyTemplateId = surveyTemplateId,
                    QuestionText = question.QuestionText,
                    AnswerScaleId = question.AnswerScaleId,
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
            scoredValues.Add(selectedValue);
        }

        var comments = command.AdditionalComments?.Trim();
        if (comments is { Length: > MaximumCommentLength })
        {
            return Failed<SubmitSurveyResponseDto>(SurveyErrorCodes.CommentsTooLong);
        }

        var now = DateTime.UtcNow;
        var response = new SurveyResponse
        {
            CourseSectionSurveyId = sectionSurvey.CourseSectionSurveyId,
            AdditionalComments = string.IsNullOrEmpty(comments) ? null : comments,
            Score = ComputeScore(scoredValues),
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
                question.AnswerScaleId))
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
        var knownScaleIds = await db.AnswerScales
            .Where(x => scaleIds.Contains(x.AnswerScaleId))
            .Select(x => x.AnswerScaleId)
            .ToListAsync(cancellationToken);
        if (knownScaleIds.Count != scaleIds.Count)
        {
            return new TemplateValidation(SurveyErrorCodes.QuestionScaleNotFound, name, []);
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
                    x.AnswerScaleId))
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
    /// Điểm của một phiếu: trung bình các câu thuộc thang 'Options'. Câu thang
    /// 'Text' không có giá trị số nên không tham gia.
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
