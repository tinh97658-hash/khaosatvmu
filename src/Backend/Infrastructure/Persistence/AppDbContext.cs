using Domain;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuthAuditLog> AuthAuditLogs => Set<AuthAuditLog>();
    public DbSet<AuthSession> AuthSessions => Set<AuthSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(320).IsRequired();
            entity.Property(x => x.GoogleSubject).HasMaxLength(255);
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.AvatarUrl).HasMaxLength(2048);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.GoogleSubject).IsUnique();
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.ToTable("UserProfiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProfileName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ProfileCode).HasMaxLength(100).IsRequired();
            entity.Property(x => x.OrganizationUnitCode).HasMaxLength(100);
            entity.Property(x => x.OrganizationUnitName).HasMaxLength(200);
            entity.HasIndex(x => x.ProfileCode).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.IsActive });
            entity.HasIndex(x => x.UserId)
                .HasDatabaseName("UX_UserProfiles_UserId_ActiveDefault")
                .IsUnique()
                .HasFilter("\"IsActive\" = TRUE AND \"IsDefault\" = TRUE");
            entity.HasIndex(x => new { x.UserId, x.RoleId, x.OrganizationUnitCode }).IsUnique();
            entity.HasOne<User>().WithMany(x => x.Profiles).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("Permissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("RolePermissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.RoleId, x.PermissionId }).IsUnique();
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Permission>().WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuthAuditLog>(entity =>
        {
            entity.ToTable("AuthAuditLogs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Event).HasMaxLength(100).IsRequired();
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.HasIndex(x => new { x.UserId, x.CreatedAt });
            entity.HasIndex(x => new { x.Event, x.CreatedAt });
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AuthSession>(entity =>
        {
            entity.ToTable("AuthSessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RevokedReason).HasMaxLength(200);
            entity.HasIndex(x => new { x.UserId, x.RevokedAt, x.ExpiresAt });
            entity.HasIndex(x => new { x.ActiveProfileId, x.RevokedAt });
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.ActiveProfileId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
