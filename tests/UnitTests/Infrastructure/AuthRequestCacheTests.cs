namespace UnitTests.InfrastructureTests;

using System.Data.Common;
using System.Security.Claims;
using FluentAssertions;
using global::Infrastructure.Auth;
using global::Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

public sealed class AuthRequestCacheTests
{
    [Fact]
    public async Task RepeatedPermissionChecks_LoadStateAndPermissionsOnlyOnce()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString)) return;

        var counter = new CommandCounter();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .AddInterceptors(counter)
            .Options;
        await using var db = new AppDbContext(options);
        var principalData = await (
            from user in db.Users.AsNoTracking()
            join profile in db.UserProfiles.AsNoTracking() on user.Id equals profile.UserId
            join rolePermission in db.RolePermissions.AsNoTracking() on profile.RoleId equals rolePermission.RoleId
            join permission in db.Permissions.AsNoTracking() on rolePermission.PermissionId equals permission.Id
            where user.IsActive && profile.IsActive && rolePermission.IsGranted
            select new { UserId = user.Id, ProfileId = profile.Id, permission.Code })
            .FirstOrDefaultAsync();
        if (principalData is null) return;

        var principal = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, principalData.UserId.ToString()),
            new Claim("active_profile_id", principalData.ProfileId.ToString()),
        ], "test"));
        var service = new EfAuthService(db);
        counter.Reset();

        var first = await service.HasPermissionAsync(principal, principalData.Code);
        var second = await service.HasAnyPermissionAsync(
            principal,
            [principalData.Code, "A_PERMISSION_THAT_DOES_NOT_EXIST"]);

        first.Should().BeTrue();
        second.Should().BeTrue();
        counter.ReaderCommandCount.Should().Be(2,
            "principal state and the granted permission set are each loaded once per scoped service");
    }

    private sealed class CommandCounter : DbCommandInterceptor
    {
        public int ReaderCommandCount { get; private set; }

        public void Reset() => ReaderCommandCount = 0;

        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result)
        {
            ReaderCommandCount++;
            return result;
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            ReaderCommandCount++;
            return ValueTask.FromResult(result);
        }
    }
}
