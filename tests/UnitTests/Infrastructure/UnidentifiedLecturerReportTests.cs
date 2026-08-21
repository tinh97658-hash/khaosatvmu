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
/// Kiểm chứng danh sách giảng viên chưa xác định — chỗ dùng thử <see cref="UserScope"/>
/// đầu tiên. Quan trọng nhất là hai nhánh: trưởng bộ môn chỉ thấy bộ môn mình, và
/// người không tra ra bộ môn thì thấy RỖNG chứ không phải thấy hết.
///
/// Chạy trên cơ sở dữ liệu thật, chỉ đọc, không ghi gì. Không đặt biến môi trường
/// <c>ConnectionStrings__DefaultConnection</c> thì tự bỏ qua.
/// </summary>
public class UnidentifiedLecturerReportTests
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

    /// <summary>Bộ môn đang có nhiều lớp chưa xác định nhất, để có dữ liệu mà đối chiếu.</summary>
    private static Task<int?> BusiestDepartmentAsync(AppDbContext db) =>
        (from section in db.CourseSections
         join course in db.Courses on section.CourseId equals course.CourseId
         where section.LecturerId == null
               && section.UnidentifiedLecturerName != null
               && section.UnidentifiedLecturerName != string.Empty
               && course.DepartmentId != null
         group section by course.DepartmentId into grouped
         orderby grouped.Count() descending
         select grouped.Key).FirstOrDefaultAsync();

    [Fact]
    public async Task AdminSeesEverything_AndDepartmentManagerSeesOnlyOwnDepartment()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var departmentId = await BusiestDepartmentAsync(db);
            if (departmentId is null) return; // không còn lớp nào chưa xác định

            var admin = await serviceFor(UserScope.Unrestricted(RoleCodes.Admin))
                .GetUnidentifiedLecturersAsync(semesterId: null);
            var manager = await serviceFor(new UserScope(
                    RoleCodes.DepartmentManager, 1, departmentId, null, SeesEverything: false))
                .GetUnidentifiedLecturersAsync(semesterId: null);

            manager.SectionCount.Should().BeGreaterThan(0);
            manager.SectionCount.Should().BeLessThan(
                admin.SectionCount, "trưởng bộ môn chỉ thấy một phần của toàn trường");
            manager.Sections.Should().OnlyContain(
                x => x.DepartmentId == departmentId, "không được lọt lớp của bộ môn khác");
            admin.SectionCount.Should().Be(admin.Sections.Count);
        });
    }

    [Fact]
    public async Task ScopeWithoutDepartment_ShouldReturnEmpty_NotEverything()
    {
        await RunAsync(async (_, serviceFor) =>
        {
            // Đây là nhánh nguy hiểm nhất: nếu viết nhầm thành "không lọc" thì người
            // này thấy toàn bộ dữ liệu của trường mà nhìn vẫn như chạy đúng.
            var report = await serviceFor(UserScope.None with { RoleCode = RoleCodes.DepartmentManager })
                .GetUnidentifiedLecturersAsync(semesterId: null);

            report.SectionCount.Should().Be(0);
            report.LecturerCount.Should().Be(0);
            report.Sections.Should().BeEmpty();
            report.Lecturers.Should().BeEmpty();
        });
    }

    [Fact]
    public async Task GroupingByLecturer_ShouldBeFewerRowsThanSections()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var departmentId = await BusiestDepartmentAsync(db);
            if (departmentId is null) return;

            var report = await serviceFor(new UserScope(
                    RoleCodes.DepartmentManager, 1, departmentId, null, SeesEverything: false))
                .GetUnidentifiedLecturersAsync(semesterId: null);

            // Chính là lý do cần cả hai cách gom: cầm 6 cái tên đi hỏi thì được, cầm
            // 36 dòng lớp thì rối.
            report.LecturerCount.Should().BeLessThan(report.SectionCount);
            report.Lecturers.Sum(x => x.SectionCount).Should().Be(report.SectionCount);
            report.Lecturers.Should().BeInDescendingOrder(x => x.SectionCount);
            report.Lecturers.Should().OnlyContain(x => x.SectionLabels.Count == x.SectionCount);
        });
    }

    [Fact]
    public async Task SemesterFilter_ShouldNarrowTheResult()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var service = serviceFor(UserScope.Unrestricted(RoleCodes.Admin));
            var all = await service.GetUnidentifiedLecturersAsync(semesterId: null);
            if (all.SectionCount == 0) return;

            var semesterId = await db.CourseSections
                .Where(x => x.LecturerId == null && x.UnidentifiedLecturerName != null)
                .Select(x => x.SemesterId)
                .FirstAsync();

            var filtered = await service.GetUnidentifiedLecturersAsync(semesterId);

            filtered.SectionCount.Should().BeGreaterThan(0);
            filtered.SectionCount.Should().BeLessThanOrEqualTo(all.SectionCount);
        });
    }
}
