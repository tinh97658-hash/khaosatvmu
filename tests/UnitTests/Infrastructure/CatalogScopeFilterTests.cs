namespace UnitTests.InfrastructureTests;

using Application;
using Application.Auth;
using FluentAssertions;
using global::Infrastructure.Catalog;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Kiểm chứng ba danh sách của trang danh mục đã lọc đúng phạm vi: Giảng viên, Học
/// phần, Lớp học phần. Đây là chỗ trước khi sửa thì trưởng bộ môn Luật hàng hải nhìn
/// thấy cả 112 giảng viên của bốn khoa.
///
/// Chạy trên cơ sở dữ liệu thật, chỉ đọc. Không đặt biến môi trường
/// <c>ConnectionStrings__DefaultConnection</c> thì tự bỏ qua.
/// </summary>
public class CatalogScopeFilterTests
{
    private sealed class FixedScopeResolver(UserScope scope) : IUserScopeResolver
    {
        public Task<UserScope> ResolveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(scope);
    }

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private static async Task RunAsync(Func<AppDbContext, Func<UserScope, EfCatalogService>, Task> body)
    {
        var connectionString = ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var services = new ServiceCollection();
        services.AddHttpContextAccessor();
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

        await body(db, userScope => new EfCatalogService(db, new FixedScopeResolver(userScope)));
    }

    private static UserScope ManagerOf(int departmentId) =>
        new(RoleCodes.DepartmentManager, 1, departmentId, null, SeesEverything: false);

    /// <summary>Bộ môn có nhiều giảng viên nhất, để chắc chắn có dữ liệu mà so.</summary>
    private static Task<int?> BusiestDepartmentAsync(AppDbContext db) =>
        db.Lecturers
            .Where(x => x.DepartmentId != null)
            .GroupBy(x => x.DepartmentId)
            .OrderByDescending(x => x.Count())
            .Select(x => x.Key)
            .FirstOrDefaultAsync();

    [Fact]
    public async Task Lecturers_ShouldBeNarrowedToOwnDepartment()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var departmentId = await BusiestDepartmentAsync(db);
            if (departmentId is null) return;

            var all = await serviceFor(UserScope.Unrestricted(RoleCodes.Admin)).GetLecturersAsync();
            var mine = await serviceFor(ManagerOf(departmentId.Value)).GetLecturersAsync();

            mine.Should().NotBeEmpty();
            mine.Count.Should().BeLessThan(all.Count, "trưởng bộ môn không được thấy cả trường");
            mine.Should().OnlyContain(x => x.DepartmentId == departmentId);
        });
    }

    [Fact]
    public async Task Courses_ShouldBeNarrowedToOwnDepartment()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var departmentId = await db.Courses
                .Where(x => x.DepartmentId != null)
                .GroupBy(x => x.DepartmentId)
                .OrderByDescending(x => x.Count())
                .Select(x => x.Key)
                .FirstOrDefaultAsync();
            if (departmentId is null) return;

            var all = await serviceFor(UserScope.Unrestricted(RoleCodes.Admin)).GetCoursesAsync();
            var mine = await serviceFor(ManagerOf(departmentId.Value)).GetCoursesAsync();

            mine.Should().NotBeEmpty();
            mine.Count.Should().BeLessThan(all.Count);
            mine.Should().OnlyContain(x => x.DepartmentId == departmentId);
        });
    }

    [Fact]
    public async Task CourseSections_ShouldFollowOwningCourse_NotTeachingLecturer()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var departmentId = await db.Courses
                .Where(x => x.DepartmentId != null && db.CourseSections.Any(s => s.CourseId == x.CourseId))
                .GroupBy(x => x.DepartmentId)
                .OrderByDescending(x => x.Count())
                .Select(x => x.Key)
                .FirstOrDefaultAsync();
            if (departmentId is null) return;

            var all = await serviceFor(UserScope.Unrestricted(RoleCodes.Admin))
                .GetCourseSectionsAsync(semesterId: null);
            var mine = await serviceFor(ManagerOf(departmentId.Value))
                .GetCourseSectionsAsync(semesterId: null);

            mine.Should().NotBeEmpty();
            mine.Count.Should().BeLessThan(all.Count);

            // Quy đơn vị theo học phần sở hữu, đúng câu D-b. Kiểm bằng cách đối chiếu
            // ngược lại danh mục học phần của chính bộ môn đó.
            var courseIds = await db.Courses
                .Where(x => x.DepartmentId == departmentId)
                .Select(x => x.CourseId)
                .ToListAsync();
            mine.Should().OnlyContain(x => courseIds.Contains(x.CourseId));
        });
    }

    [Fact]
    public async Task ScopeWithoutDepartment_ShouldReturnEmpty_ForAllThreeLists()
    {
        await RunAsync(async (_, serviceFor) =>
        {
            // Nhánh nguy hiểm nhất: viết nhầm thành "không lọc" thì người này thấy
            // toàn bộ dữ liệu của trường mà không có gì báo lỗi.
            var service = serviceFor(UserScope.None with { RoleCode = RoleCodes.DepartmentManager });

            (await service.GetLecturersAsync()).Should().BeEmpty();
            (await service.GetCoursesAsync()).Should().BeEmpty();
            (await service.GetCourseSectionsAsync(semesterId: null)).Should().BeEmpty();
        });
    }

    [Fact]
    public async Task SurveyAdmin_ShouldStillSeeEverything()
    {
        await RunAsync(async (_, serviceFor) =>
        {
            var admin = serviceFor(UserScope.Unrestricted(RoleCodes.Admin));
            var surveyAdmin = serviceFor(UserScope.Unrestricted(RoleCodes.SurveyAdmin));

            (await surveyAdmin.GetLecturersAsync()).Count
                .Should().Be((await admin.GetLecturersAsync()).Count);
        });
    }
}
