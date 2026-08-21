namespace UnitTests.InfrastructureTests;

using Application;
using Application.Auth;
using FluentAssertions;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Kiểm chứng lớp phân quyền thứ hai: ai được thấy dữ liệu nào. Sai ở đây thì hoặc
/// người ta thấy dữ liệu của bộ môn khác, hoặc thấy trắng trơn — nên test kỹ từng
/// nhánh, nhất là nhánh "không tra ra giảng viên" phải trả rỗng chứ không được rơi
/// vào nhánh không lọc.
///
/// Chạy trên cơ sở dữ liệu thật, bọc transaction rồi rollback. Không đặt biến môi
/// trường <c>ConnectionStrings__DefaultConnection</c> thì tự bỏ qua.
/// </summary>
public class UserScopeResolverTests
{
    /// <summary>
    /// Người đăng nhập giả lập, đổi được giữa các lần gọi để thử nhiều vai trò trong
    /// cùng một transaction.
    /// </summary>
    private sealed class MutableCurrentUser : ICurrentUserAccessor
    {
        public Guid? UserId { get; set; }
        public Guid? ProfileId { get; set; }
        public string? UserEmail => null;
    }

    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private static async Task RunInRollbackAsync(Func<AppDbContext, Func<Guid?, Guid?, Task<UserScope>>, Task> body)
    {
        var connectionString = ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
            })
            .Build();

        // Resolver là internal nên phải dựng qua DI của chính Infrastructure, đúng
        // cách production chạy. Đăng ký AddPersistence trước rồi ĐÈ ICurrentUserAccessor
        // bằng bản giả — đăng ký sau thắng đăng ký trước.
        var currentUser = new MutableCurrentUser();
        var services = new ServiceCollection();
        services.AddHttpContextAccessor();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddPersistence(configuration);
        services.AddScoped<ICurrentUserAccessor>(_ => currentUser);

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var resolver = scope.ServiceProvider.GetRequiredService<IUserScopeResolver>();

        // Một provider, một DbContext, một transaction. Đổi người đăng nhập giữa các
        // lần gọi bằng cách gán lại vào bản giả.
        async Task<UserScope> Resolve(Guid? userId, Guid? profileId)
        {
            currentUser.UserId = userId;
            currentUser.ProfileId = profileId;
            return await resolver.ResolveAsync();
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await body(db, Resolve);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    /// <summary>
    /// Tìm một tài khoản THẬT đang có profile với vai trò cho trước và đã gắn hồ sơ
    /// giảng viên. Dùng dữ liệu thật thay vì seed giả, vì sau nhóm G thì cả 112 giảng
    /// viên đều đã có tài khoản — gán thêm một tài khoản nữa sẽ đụng UNIQUE index
    /// trên <c>Users.LecturerId</c>.
    /// </summary>
    private static Task<AccountFixture?> FindAccountAsync(AppDbContext db, string roleCode) =>
        (from user in db.Users
         join profile in db.UserProfiles on user.Id equals profile.UserId
         join role in db.Roles on profile.RoleId equals role.Id
         join lecturer in db.Lecturers on user.LecturerId equals lecturer.LecturerId
         where role.Code == roleCode && profile.IsActive && user.IsActive
         orderby user.Email
         select new AccountFixture(
             user.Id,
             profile.Id,
             lecturer.LecturerId,
             lecturer.DepartmentId,
             lecturer.FacultyId))
        .FirstOrDefaultAsync();

    private sealed record AccountFixture(
        Guid UserId,
        Guid ProfileId,
        int LecturerId,
        int? DepartmentId,
        int? FacultyId);

    private static async Task<(Guid UserId, Guid ProfileId)> SeedAccountAsync(
        AppDbContext db,
        string roleCode,
        int? lecturerId)
    {
        var role = await db.Roles.SingleAsync(x => x.Code == roleCode);
        var now = DateTime.UtcNow;
        var userId = Guid.NewGuid();
        var profileId = Guid.NewGuid();

        db.Users.Add(new Domain.User
        {
            Id = userId,
            Email = $"scope-{userId:N}@vimaru.edu.vn",
            DisplayName = "Kiem Thu Pham Vi",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            LecturerId = lecturerId,
        });
        db.UserProfiles.Add(new Domain.UserProfile
        {
            Id = profileId,
            UserId = userId,
            RoleId = role.Id,
            ProfileName = "Kiem thu",
            ProfileCode = $"TEST_{userId:N}"[..20],
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        });
        await db.SaveChangesAsync();
        return (userId, profileId);
    }

    [Fact]
    public async Task DepartmentManager_ShouldBeScopedToOwnDepartment()
    {
        await RunInRollbackAsync(async (db, resolve) =>
        {
            var account = await FindAccountAsync(db, RoleCodes.DepartmentManager);
            if (account is null) return; // chưa cấu hình trưởng bộ môn nào thì bỏ qua

            var scope = await resolve(account.UserId, account.ProfileId);

            scope.RoleCode.Should().Be(RoleCodes.DepartmentManager);
            scope.SeesEverything.Should().BeFalse();
            scope.SeesNothing.Should().BeFalse();
            scope.LecturerId.Should().Be(account.LecturerId);
            scope.DepartmentId.Should().Be(account.DepartmentId);
            scope.FacultyId.Should().Be(account.FacultyId);
        });
    }

    [Fact]
    public async Task Admin_ShouldSeeEverything()
    {
        await RunInRollbackAsync(async (db, resolve) =>
        {
            var (userId, profileId) = await SeedAccountAsync(db, RoleCodes.Admin, lecturerId: null);

            var scope = await resolve(userId, profileId);

            scope.SeesEverything.Should().BeTrue();
            scope.SeesNothing.Should().BeFalse();
            scope.DepartmentId.Should().BeNull();
        });
    }

    [Fact]
    public async Task SurveyAdmin_ShouldSeeEverything()
    {
        await RunInRollbackAsync(async (db, resolve) =>
        {
            var (userId, profileId) = await SeedAccountAsync(db, RoleCodes.SurveyAdmin, lecturerId: null);

            var scope = await resolve(userId, profileId);

            scope.SeesEverything.Should().BeTrue();
        });
    }

    [Fact]
    public async Task DepartmentManager_WithoutLecturerRecord_ShouldSeeNothing()
    {
        await RunInRollbackAsync(async (db, resolve) =>
        {
            var (userId, profileId) = await SeedAccountAsync(
                db, RoleCodes.DepartmentManager, lecturerId: null);

            var scope = await resolve(userId, profileId);

            scope.SeesEverything.Should().BeFalse("không bao giờ được nới thành thấy hết");
            scope.SeesNothing.Should().BeTrue("không tra ra bộ môn thì phải trả danh sách rỗng");
            scope.DepartmentId.Should().BeNull();
        });
    }

    [Fact]
    public async Task SignedOut_ShouldSeeNothing()
    {
        await RunInRollbackAsync(async (_, resolve) =>
        {
            var scope = await resolve(null, null);

            scope.Should().Be(UserScope.None);
            scope.SeesEverything.Should().BeFalse();
        });
    }

    [Fact]
    public async Task SwitchingProfile_ShouldSwitchScope_ForTheSameUser()
    {
        await RunInRollbackAsync(async (db, resolve) =>
        {
            // Cùng một người, hai profile: trưởng bộ môn và giảng viên. Đúng mô hình
            // mục 12 của tài liệu, và tài khoản thật đang dùng để thử có sẵn cả hai.
            var account = await FindAccountAsync(db, RoleCodes.DepartmentManager);
            if (account is null) return;

            var lecturerProfileId = await (
                from profile in db.UserProfiles
                join role in db.Roles on profile.RoleId equals role.Id
                where profile.UserId == account.UserId
                      && role.Code == RoleCodes.Lecturer
                      && profile.IsActive
                select (Guid?)profile.Id).FirstOrDefaultAsync();
            if (lecturerProfileId is null) return; // người này chưa có profile giảng viên

            var asManager = await resolve(account.UserId, account.ProfileId);
            var asLecturer = await resolve(account.UserId, lecturerProfileId);

            asManager.RoleCode.Should().Be(RoleCodes.DepartmentManager);
            asLecturer.RoleCode.Should().Be(RoleCodes.Lecturer);
            asLecturer.LecturerId.Should().Be(
                account.LecturerId, "đổi profile thì đổi vai trò nhưng vẫn là cùng một người");
        });
    }
}
