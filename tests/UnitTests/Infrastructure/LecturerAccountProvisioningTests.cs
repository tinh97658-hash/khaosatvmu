namespace UnitTests.InfrastructureTests;

using Application.Catalog;
using FluentAssertions;
using global::Infrastructure.Catalog;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

/// <summary>
/// Kiểm chứng luật của nhóm G: thêm giảng viên thì sinh luôn một tài khoản đăng nhập
/// gắn qua <c>Users.LecturerId</c>, nhưng KHÔNG sinh <c>UserProfiles</c> nên chưa ai
/// vào được hệ thống cho tới khi admin cấp quyền.
///
/// Các test này chạy trên cơ sở dữ liệu thật vì phần cần kiểm nằm ở tầng EF và ở
/// interceptor xoá mềm — dùng provider giả thì không kiểm được gì. Mỗi test bọc trong
/// một transaction rồi rollback nên không để lại dấu vết. Không đặt biến môi trường
/// <c>ConnectionStrings__DefaultConnection</c> thì test tự bỏ qua.
/// </summary>
public class LecturerAccountProvisioningTests
{
    private static string? ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

    private static ServiceProvider BuildProvider(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddHttpContextAccessor();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
            })
            .Build());
        services.AddPersistence(services.BuildServiceProvider().GetRequiredService<IConfiguration>());
        return services.BuildServiceProvider();
    }

    private static async Task RunInRollbackAsync(Func<AppDbContext, EfCatalogService, Task> body)
    {
        var connectionString = ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        await using var provider = BuildProvider(connectionString);
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = new EfCatalogService(db);

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await body(db, service);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    private static SaveLecturerCommand NewLecturer(string email) =>
        new($"Kiem Thu {Guid.NewGuid():N}"[..24], null, null, email, null, null);

    [Fact]
    public async Task CreateLecturer_ShouldCreateLinkedAccount_WithoutAnyProfile()
    {
        await RunInRollbackAsync(async (db, service) =>
        {
            var email = $"kiemthu-{Guid.NewGuid():N}@vimaru.edu.vn";

            var result = await service.CreateLecturerAsync(NewLecturer(email));

            result.Succeeded.Should().BeTrue();
            var lecturerId = result.Value!.LecturerId;

            var user = await db.Users.SingleOrDefaultAsync(x => x.LecturerId == lecturerId);
            user.Should().NotBeNull("thêm giảng viên phải sinh kèm một tài khoản");
            user!.Email.Should().Be(email);
            user.IsActive.Should().BeTrue();
            user.GoogleSubject.Should().BeNull("tài khoản chưa đăng nhập lần nào");

            var profileCount = await db.UserProfiles.CountAsync(x => x.UserId == user.Id);
            profileCount.Should().Be(0, "cấp quyền là việc riêng của admin, xem G1-b");
        });
    }

    [Fact]
    public async Task CreateLecturer_WithoutEmail_ShouldBeRejected()
    {
        await RunInRollbackAsync(async (_, service) =>
        {
            var result = await service.CreateLecturerAsync(NewLecturer(string.Empty));

            result.Succeeded.Should().BeFalse();
            result.ErrorCode.Should().Be(CatalogErrorCodes.LecturerEmailRequired);
        });
    }

    [Fact]
    public async Task UpdateLecturerEmail_ShouldFollowThrough_WhenAccountNeverSignedIn()
    {
        await RunInRollbackAsync(async (db, service) =>
        {
            var created = await service.CreateLecturerAsync(
                NewLecturer($"truoc-{Guid.NewGuid():N}@vimaru.edu.vn"));
            var lecturerId = created.Value!.LecturerId;
            var newEmail = $"sau-{Guid.NewGuid():N}@vimaru.edu.vn";

            var updated = await service.UpdateLecturerAsync(
                lecturerId,
                new SaveLecturerCommand(created.Value.FullName, null, null, newEmail, null, null));

            updated.Succeeded.Should().BeTrue();
            var user = await db.Users.SingleAsync(x => x.LecturerId == lecturerId);
            user.Email.Should().Be(newEmail, "chưa đăng nhập thì đổi email theo được");
        });
    }

    [Fact]
    public async Task UpdateLecturerEmail_ShouldNotTouchAccount_AfterFirstSignIn()
    {
        await RunInRollbackAsync(async (db, service) =>
        {
            var loginEmail = $"dadangnhap-{Guid.NewGuid():N}@vimaru.edu.vn";
            var created = await service.CreateLecturerAsync(NewLecturer(loginEmail));
            var lecturerId = created.Value!.LecturerId;

            // Giả lập người này đã đăng nhập một lần: Google đã gắn subject vào.
            var user = await db.Users.SingleAsync(x => x.LecturerId == lecturerId);
            user.GoogleSubject = $"google-{Guid.NewGuid():N}";
            await db.SaveChangesAsync();

            await service.UpdateLecturerAsync(
                lecturerId,
                new SaveLecturerCommand(
                    created.Value.FullName, null, null,
                    $"doi-{Guid.NewGuid():N}@vimaru.edu.vn", null, null));

            var after = await db.Users.SingleAsync(x => x.LecturerId == lecturerId);
            after.Email.Should().Be(loginEmail, "đã đăng nhập rồi thì email là danh tính, không sửa");
        });
    }

    [Fact]
    public async Task DeleteThenRestoreLecturer_ShouldLockThenUnlockAccount()
    {
        await RunInRollbackAsync(async (db, service) =>
        {
            var created = await service.CreateLecturerAsync(
                NewLecturer($"xoamem-{Guid.NewGuid():N}@vimaru.edu.vn"));
            var lecturerId = created.Value!.LecturerId;

            var deleted = await service.DeleteLecturerAsync(lecturerId);
            deleted.Succeeded.Should().BeTrue();

            db.ChangeTracker.Clear();
            var afterDelete = await db.Users.SingleAsync(x => x.LecturerId == lecturerId);
            afterDelete.IsActive.Should().BeFalse("xoá giảng viên thì khoá tài khoản");

            var restored = await service.RestoreLecturerAsync(lecturerId);
            restored.Succeeded.Should().BeTrue();

            db.ChangeTracker.Clear();
            var afterRestore = await db.Users.SingleAsync(x => x.LecturerId == lecturerId);
            afterRestore.IsActive.Should().BeTrue("khôi phục giảng viên thì mở lại tài khoản");
        });
    }
}
