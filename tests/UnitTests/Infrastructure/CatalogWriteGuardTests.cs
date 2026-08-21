namespace UnitTests.InfrastructureTests;

using Application;
using Application.Auth;
using Application.Catalog;
using FluentAssertions;
using global::Infrastructure.Catalog;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Kiểm chứng phan chặn ghi. Lọc danh sách chỉ giấu dữ liệu đi chứ không chặn được gì:
/// biết mã bản ghi là gọi thẳng API sửa hay xoá được. Đây mới là lớp bảo vệ thật.
///
/// Mọi test ghi đều bọc transaction rồi rollback. Không đặt biến môi trường
/// <c>ConnectionStrings__DefaultConnection</c> thì tự bỏ qua.
/// </summary>
public class CatalogWriteGuardTests
{
    private sealed class FixedScopeResolver(UserScope scope) : IUserScopeResolver
    {
        public Task<UserScope> ResolveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(scope);
    }

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private static async Task RunInRollbackAsync(
        Func<AppDbContext, Func<UserScope, EfCatalogService>, Task> body)
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

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await body(db, userScope => new EfCatalogService(db, new FixedScopeResolver(userScope)));
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    private static UserScope ManagerOf(int departmentId) =>
        new(RoleCodes.DepartmentManager, 1, departmentId, null, SeesEverything: false);

    private static UserScope Admin => UserScope.Unrestricted(RoleCodes.Admin);

    /// <summary>Hai bộ môn khác nhau, để thử chuyện với tay sang bộ môn của người khác.</summary>
    private static async Task<(int Mine, int Other)?> TwoDepartmentsAsync(AppDbContext db)
    {
        var ids = await db.Departments.OrderBy(x => x.DepartmentId)
            .Select(x => x.DepartmentId).Take(2).ToListAsync();
        return ids.Count < 2 ? null : (ids[0], ids[1]);
    }

    private static SaveLecturerCommand LecturerCommand(int? departmentId) =>
        new("Kiem Thu Ghi", departmentId, null, $"guard-{Guid.NewGuid():N}@vimaru.edu.vn", null, null);

    [Fact]
    public async Task CreateLecturer_ShouldForceOwnDepartment_EvenWhenAnotherIsSent()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departments = await TwoDepartmentsAsync(db);
            if (departments is null) return;

            // Cố tình gửi lên bộ môn của người khác.
            var result = await serviceFor(ManagerOf(departments.Value.Mine))
                .CreateLecturerAsync(LecturerCommand(departments.Value.Other));

            result.Succeeded.Should().BeTrue();
            result.Value!.DepartmentId.Should().Be(
                departments.Value.Mine, "bộ môn phải bị ép về bộ môn của chính mình");
        });
    }

    [Fact]
    public async Task UpdateLecturer_OfAnotherDepartment_ShouldBeRejected()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departments = await TwoDepartmentsAsync(db);
            if (departments is null) return;

            var victim = await db.Lecturers
                .FirstOrDefaultAsync(x => x.DepartmentId == departments.Value.Other);
            if (victim is null) return;

            var result = await serviceFor(ManagerOf(departments.Value.Mine))
                .UpdateLecturerAsync(
                    victim.LecturerId,
                    new SaveLecturerCommand("Bi Sua Trom", victim.DepartmentId, null, victim.Email, null, null));

            result.Succeeded.Should().BeFalse();
            result.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }

    [Fact]
    public async Task UpdateLecturer_MovingToAnotherDepartment_ShouldBeRejected()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departments = await TwoDepartmentsAsync(db);
            if (departments is null) return;

            var mine = await db.Lecturers
                .FirstOrDefaultAsync(x => x.DepartmentId == departments.Value.Mine);
            if (mine is null) return;

            // Người của mình, nhưng cố đẩy sang bộ môn khác.
            var result = await serviceFor(ManagerOf(departments.Value.Mine))
                .UpdateLecturerAsync(
                    mine.LecturerId,
                    new SaveLecturerCommand(mine.FullName, departments.Value.Other, null, mine.Email, null, null));

            result.Succeeded.Should().BeFalse();
            result.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }

    [Fact]
    public async Task DeleteLecturer_ShouldBeAdminOnly()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var lecturer = await db.Lecturers
                .FirstOrDefaultAsync(x => x.DepartmentId != null);
            if (lecturer is null) return;

            var result = await serviceFor(ManagerOf(lecturer.DepartmentId!.Value))
                .DeleteLecturerAsync(lecturer.LecturerId);

            result.Succeeded.Should().BeFalse("trưởng bộ môn được thêm và sửa nhưng không được xoá");
            result.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }

    [Fact]
    public async Task Imports_ShouldBeAdminOnly()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departmentId = await db.Departments.Select(x => x.DepartmentId).FirstOrDefaultAsync();
            if (departmentId == 0) return;
            var semesterId = await db.Semesters.Select(x => x.SemesterId).FirstOrDefaultAsync();
            var service = serviceFor(ManagerOf(departmentId));

            var lecturerImport = await service.ImportLecturersAsync([]);
            var sectionImport = await service.ImportCourseSectionsAsync(semesterId, []);

            lecturerImport.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
            sectionImport.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }

    [Fact]
    public async Task CreateCourseSection_ForAnotherDepartmentCourse_ShouldBeRejected()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departments = await TwoDepartmentsAsync(db);
            if (departments is null) return;

            var otherCourse = await db.Courses
                .FirstOrDefaultAsync(x => x.DepartmentId == departments.Value.Other);
            var semesterId = await db.Semesters.Select(x => x.SemesterId).FirstOrDefaultAsync();
            if (otherCourse is null || semesterId == 0) return;

            var result = await serviceFor(ManagerOf(departments.Value.Mine))
                .CreateCourseSectionAsync(new SaveCourseSectionCommand(
                    otherCourse.CourseId, semesterId, null, "GUARD01", 10, null));

            result.Succeeded.Should().BeFalse();
            result.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }

    [Fact]
    public async Task Admin_ShouldStillBeAbleToWriteAcrossDepartments()
    {
        await RunInRollbackAsync(async (db, serviceFor) =>
        {
            var departments = await TwoDepartmentsAsync(db);
            if (departments is null) return;

            var result = await serviceFor(Admin)
                .CreateLecturerAsync(LecturerCommand(departments.Value.Other));

            result.Succeeded.Should().BeTrue();
            result.Value!.DepartmentId.Should().Be(
                departments.Value.Other, "quản trị gửi bộ môn nào thì lưu bộ môn đó");
        });
    }

    [Fact]
    public async Task ScopeWithoutDepartment_ShouldNotBeAbleToCreate()
    {
        await RunInRollbackAsync(async (_, serviceFor) =>
        {
            var result = await serviceFor(UserScope.None with { RoleCode = RoleCodes.DepartmentManager })
                .CreateLecturerAsync(LecturerCommand(null));

            result.Succeeded.Should().BeFalse("không biết bộ môn nào thì không được ghi gì");
            result.ErrorCode.Should().Be(CatalogErrorCodes.OutOfScope);
        });
    }
}
