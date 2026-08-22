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

    private static UserScope LecturerOf(int lecturerId, int? departmentId) =>
        new(RoleCodes.Lecturer, lecturerId, departmentId, null, SeesEverything: false);

    /// <summary>Giảng viên dạy nhiều lớp nhất, để chắc chắn có dữ liệu mà so.</summary>
    private static Task<int?> BusiestLecturerAsync(AppDbContext db) =>
        db.CourseSections
            .Where(x => x.LecturerId != null)
            .GroupBy(x => x.LecturerId)
            .OrderByDescending(x => x.Count())
            .Select(x => x.Key)
            .FirstOrDefaultAsync();

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

    // ------------------------------------------- Phạm vi giảng viên (congviec3.md H2)

    [Fact]
    public async Task LecturerScope_CourseSections_ShouldBeOnlyOwnTeaching()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var lecturerId = await BusiestLecturerAsync(db);
            if (lecturerId is null) return;

            var departmentId = await db.Lecturers
                .Where(x => x.LecturerId == lecturerId)
                .Select(x => x.DepartmentId)
                .FirstOrDefaultAsync();

            var asManager = await serviceFor(ManagerOf(departmentId ?? 0))
                .GetCourseSectionsAsync(semesterId: null);
            var mine = await serviceFor(LecturerOf(lecturerId.Value, departmentId))
                .GetCourseSectionsAsync(semesterId: null);

            mine.Should().NotBeEmpty();
            mine.Should().OnlyContain(x => x.LecturerId == lecturerId,
                "giảng viên đi theo người dạy, không theo học phần sở hữu");
            mine.Count.Should().BeLessThan(asManager.Count,
                "phạm vi của một người phải hẹp hơn phạm vi cả bộ môn");
        });
    }

    [Fact]
    public async Task LecturerScope_ShouldNotSeeSectionsWithoutLecturer()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var lecturerId = await BusiestLecturerAsync(db);
            if (lecturerId is null) return;

            var departmentId = await db.Lecturers
                .Where(x => x.LecturerId == lecturerId)
                .Select(x => x.DepartmentId)
                .FirstOrDefaultAsync();

            var mine = await serviceFor(LecturerOf(lecturerId.Value, departmentId))
                .GetCourseSectionsAsync(semesterId: null);

            // Lớp chưa xác định giảng viên có LecturerId NULL nên tự rơi ra khỏi phạm
            // vi. Đây là chỗ yêu cầu "giảng viên không theo dõi lớp chưa có giảng viên"
            // được thoả mà không cần thêm điều kiện nào.
            mine.Should().OnlyContain(x => x.LecturerId != null);
        });
    }

    [Fact]
    public async Task LecturerScope_Lecturers_ShouldBeOnlySelf()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var lecturerId = await BusiestLecturerAsync(db);
            if (lecturerId is null) return;

            var departmentId = await db.Lecturers
                .Where(x => x.LecturerId == lecturerId)
                .Select(x => x.DepartmentId)
                .FirstOrDefaultAsync();

            // Trang Lớp học phần cần endpoint này để đọc tên người dạy, nên vai trò chỉ
            // đọc vẫn gọi được. Chỉ cần đúng hồ sơ của chính mình.
            var mine = await serviceFor(LecturerOf(lecturerId.Value, departmentId))
                .GetLecturersAsync();

            mine.Should().ContainSingle();
            mine[0].LecturerId.Should().Be(lecturerId);
        });
    }

    [Fact]
    public async Task LecturerScope_Courses_ShouldFollowOwnSections_NotDepartment()
    {
        await RunAsync(async (db, serviceFor) =>
        {
            var lecturerId = await BusiestLecturerAsync(db);
            if (lecturerId is null) return;

            var departmentId = await db.Lecturers
                .Where(x => x.LecturerId == lecturerId)
                .Select(x => x.DepartmentId)
                .FirstOrDefaultAsync();

            var mine = await serviceFor(LecturerOf(lecturerId.Value, departmentId))
                .GetCoursesAsync();

            mine.Should().NotBeEmpty();

            // Mọi học phần hiện ra đều phải có ít nhất một lớp của chính mình — đây là
            // thứ giữ cho hai trang Học phần và Lớp học phần luôn khớp nhau.
            var taughtCourseIds = await db.CourseSections
                .Where(x => x.LecturerId == lecturerId)
                .Select(x => x.CourseId)
                .Distinct()
                .ToListAsync();
            mine.Select(x => x.CourseId).Should().BeEquivalentTo(taughtCourseIds);
        });
    }

    [Fact]
    public async Task LecturerScope_WithoutLecturerId_ShouldReturnEmpty()
    {
        await RunAsync(async (_, serviceFor) =>
        {
            // Ca nguy hiểm riêng của mức phạm vi này: có bộ môn nhưng không tra ra hồ
            // sơ giảng viên. Nếu SeesNothing chỉ nhìn DepartmentId thì người này lọt
            // xuống nhánh lọc theo bộ môn và thấy cả bộ môn.
            var service = serviceFor(new UserScope(
                RoleCodes.Lecturer, null, 1, null, SeesEverything: false));

            (await service.GetCoursesAsync()).Should().BeEmpty();
            (await service.GetCourseSectionsAsync(semesterId: null)).Should().BeEmpty();
            (await service.GetLecturersAsync()).Should().BeEmpty();
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
