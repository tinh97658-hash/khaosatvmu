namespace UnitTests.InfrastructureTests;

using Application;
using Application.Auth;
using Application.Surveys;
using Domain;
using FluentAssertions;
using global::Infrastructure.Persistence;
using global::Infrastructure.Surveys;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Đợt khảo sát phát phiếu cho toàn bộ lớp của kỳ tại thời điểm tạo. Lớp nhập bổ sung
/// sau đó bị bỏ lại không có bài. Kiểm chứng phần đếm lớp thiếu và phần tạo bù.
///
/// Mọi test ghi đều bọc transaction rồi rollback. Không đặt biến môi trường
/// <c>ConnectionStrings__DefaultConnection</c> thì tự bỏ qua.
/// </summary>
public class SectionSurveyBackfillTests
{
    private sealed class FixedScopeResolver(UserScope scope) : IUserScopeResolver
    {
        public Task<UserScope> ResolveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(scope);
    }

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private static async Task RunInRollbackAsync(
        Func<AppDbContext, Func<UserScope, EfSurveyService>, Task> body)
    {
        var connectionString = ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var services = new ServiceCollection();
        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
            })
            .Build();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddPersistence(configuration);

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cache = scope.ServiceProvider.GetRequiredService<IMemoryCache>();

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await body(db, userScope => new EfSurveyService(db, cache, new FixedScopeResolver(userScope)));
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    private static UserScope Admin => UserScope.Unrestricted(RoleCodes.Admin);

    private static UserScope Lecturer =>
        new(RoleCodes.Lecturer, 1, null, null, SeesEverything: false);

    /// <summary>
    /// Dựng một đợt cố tình thiếu bài: lấy một kỳ có lớp, tạo đợt rồi bỏ lại
    /// <paramref name="missingCount"/> lớp không có bài khảo sát.
    /// </summary>
    private static async Task<(int SemesterSurveyId, int MissingCount)?> SeedIncompleteSurveyAsync(
        AppDbContext db,
        int missingCount)
    {
        var templateId = await db.SurveyTemplates
            .Select(x => x.SurveyTemplateId)
            .FirstOrDefaultAsync();
        if (templateId == 0) return null;

        var semesterId = await db.CourseSections
            .GroupBy(x => x.SemesterId)
            .Where(group => group.Count() > missingCount)
            .Select(group => group.Key)
            .FirstOrDefaultAsync();
        if (semesterId == 0) return null;

        var sectionIds = await db.CourseSections
            .Where(x => x.SemesterId == semesterId)
            .Select(x => x.CourseSectionId)
            .OrderBy(x => x)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var survey = new SemesterSurvey
        {
            SemesterId = semesterId,
            SurveyTemplateId = templateId,
            CreatedAt = now,
        };
        db.SemesterSurveys.Add(survey);
        await db.SaveChangesAsync();

        // Bỏ lại đúng missingCount lớp cuối danh sách, giống lúc nhập thiếu rồi bổ sung sau.
        db.CourseSectionSurveys.AddRange(sectionIds
            .Take(sectionIds.Count - missingCount)
            .Select(sectionId => new CourseSectionSurvey
            {
                SemesterSurveyId = survey.SemesterSurveyId,
                CourseSectionId = sectionId,
                LinkToken = Guid.NewGuid().ToString("N"),
                StartTime = now.AddDays(-1),
                EndTime = now.AddDays(30),
                CreatedAt = now,
            }));
        await db.SaveChangesAsync();

        return (survey.SemesterSurveyId, missingCount);
    }

    [Fact]
    public async Task SemesterSurveys_ShouldCountSectionsWithoutASurvey()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var seeded = await SeedIncompleteSurveyAsync(db, 3);
            if (seeded is null) return;

            var surveys = await serviceFor(Admin).GetSemesterSurveysAsync(null);
            var survey = surveys.Single(x => x.SemesterSurveyId == seeded.Value.SemesterSurveyId);

            survey.MissingSectionCount.Should().Be(3, "ba lớp của kỳ chưa có bài khảo sát");
        });
    }

    [Fact]
    public async Task Backfill_ShouldCreateSurveysForMissingSections_KeepingTheExistingSchedule()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var seeded = await SeedIncompleteSurveyAsync(db, 3);
            if (seeded is null) return;
            var semesterSurveyId = seeded.Value.SemesterSurveyId;

            var before = await db.CourseSectionSurveys
                .Where(x => x.SemesterSurveyId == semesterSurveyId)
                .Select(x => new { x.CourseSectionSurveyId, x.StartTime, x.EndTime })
                .ToListAsync();

            var result = await serviceFor(Admin).BackfillSemesterSurveySectionsAsync(semesterSurveyId);

            result.Succeeded.Should().BeTrue();
            result.Value!.CreatedSectionCount.Should().Be(3);
            result.Value.StartTime.Should().Be(before.Min(x => x.StartTime));
            result.Value.EndTime.Should().Be(before.Max(x => x.EndTime));

            var after = await db.CourseSectionSurveys
                .Where(x => x.SemesterSurveyId == semesterSurveyId)
                .ToListAsync();
            after.Should().HaveCount(before.Count + 3);
            after.Select(x => x.LinkToken).Should().OnlyHaveUniqueItems("mỗi lớp một đường dẫn riêng");

            var created = after.Where(x => before.All(old => old.CourseSectionSurveyId != x.CourseSectionSurveyId));
            created.Should().OnlyContain(
                x => x.StartTime == result.Value.StartTime && x.EndTime == result.Value.EndTime,
                "lớp bù dùng đúng khung giờ của các bài đã có");

            // Không còn lớp nào thiếu, và bấm lần nữa thì bị chặn.
            var surveys = await serviceFor(Admin).GetSemesterSurveysAsync(null);
            surveys.Single(x => x.SemesterSurveyId == semesterSurveyId)
                .MissingSectionCount.Should().Be(0);

            var again = await serviceFor(Admin).BackfillSemesterSurveySectionsAsync(semesterSurveyId);
            again.Succeeded.Should().BeFalse();
            again.ErrorCode.Should().Be(SurveyErrorCodes.SemesterSurveySectionsUpToDate);
        });
    }

    [Fact]
    public async Task Backfill_ByANonAdmin_ShouldBeRejected()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var seeded = await SeedIncompleteSurveyAsync(db, 2);
            if (seeded is null) return;

            var result = await serviceFor(Lecturer)
                .BackfillSemesterSurveySectionsAsync(seeded.Value.SemesterSurveyId);

            result.Succeeded.Should().BeFalse();
            result.ErrorCode.Should().Be(SurveyErrorCodes.OutOfScope);

            var count = await db.CourseSectionSurveys
                .CountAsync(x => x.SemesterSurveyId == seeded.Value.SemesterSurveyId);
            count.Should().Be(
                await db.CourseSections.CountAsync(x => x.SemesterId ==
                    db.SemesterSurveys.Single(s => s.SemesterSurveyId == seeded.Value.SemesterSurveyId).SemesterId) - 2,
                "không được tạo bù bài nào");
        });
    }
}
