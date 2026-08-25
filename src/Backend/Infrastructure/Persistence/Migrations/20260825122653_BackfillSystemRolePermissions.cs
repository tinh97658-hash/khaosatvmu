using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BackfillSystemRolePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // These permissions were originally introduced only through DatabaseSeeder.
            // Production deployments must not depend on the application seed path to make
            // a newly deployed endpoint or navigation item usable, so backfill them here.
            migrationBuilder.Sql(
                """
                INSERT INTO "Permissions" ("Id", "Code", "Name", "Description", "Category")
                VALUES
                    (gen_random_uuid(), 'GRADUATION_ANALYTICS_ACCESS', 'Thống kê sinh viên tốt nghiệp', 'Truy cập module thống kê sinh viên tốt nghiệp đúng hạn', 'Báo cáo'),
                    (gen_random_uuid(), 'USER_ADMIN_ACCOUNTS_ACCESS', 'Quản trị · tab Tài khoản và hồ sơ', 'Xem và sửa tài khoản, hồ sơ người dùng', 'Quản trị hệ thống'),
                    (gen_random_uuid(), 'USER_ADMIN_AUDIT_ACCESS', 'Quản trị · tab Nhật ký hệ thống', 'Xem nhật ký đăng nhập và nhật ký thay đổi dữ liệu', 'Quản trị hệ thống'),
                    (gen_random_uuid(), 'USER_ADMIN_PERMISSIONS_ACCESS', 'Quản trị · tab Phân quyền Module', 'Xem và sửa ma trận phân quyền của các vai trò', 'Quản trị hệ thống')
                ON CONFLICT ("Code") DO NOTHING;

                INSERT INTO "RolePermissions" ("Id", "RoleId", "PermissionId", "IsGranted", "CreatedAt")
                SELECT gen_random_uuid(), role."Id", permission."Id", TRUE, NOW()
                FROM "Roles" AS role
                CROSS JOIN "Permissions" AS permission
                WHERE role."Code" = 'ADMIN'
                  AND role."IsDeleted" = FALSE
                  AND permission."Code" IN (
                      'GRADUATION_ANALYTICS_ACCESS',
                      'USER_ADMIN_ACCOUNTS_ACCESS',
                      'USER_ADMIN_AUDIT_ACCESS',
                      'USER_ADMIN_PERMISSIONS_ACCESS'
                  )
                ON CONFLICT ("RoleId", "PermissionId") DO NOTHING;

                INSERT INTO "RolePermissions" ("Id", "RoleId", "PermissionId", "IsGranted", "CreatedAt")
                SELECT gen_random_uuid(), role."Id", permission."Id", TRUE, NOW()
                FROM "Roles" AS role
                CROSS JOIN "Permissions" AS permission
                WHERE role."Code" = 'SURVEY_ADMIN'
                  AND role."IsDeleted" = FALSE
                  AND permission."Code" = 'GRADUATION_ANALYTICS_ACCESS'
                ON CONFLICT ("RoleId", "PermissionId") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally keep authorization data on rollback. Removing grants here could
            // revoke permissions that an administrator assigned independently of this migration.
        }
    }
}
