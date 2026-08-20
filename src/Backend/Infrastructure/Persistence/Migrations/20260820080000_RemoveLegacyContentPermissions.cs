using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260820080000_RemoveLegacyContentPermissions")]
public partial class RemoveLegacyContentPermissions : Migration
{
    private static readonly string[] LegacyPermissionCodes =
    [
        "ADMIN_ACCESS",
        "SURVEY_MANAGE",
        "VIEW_REPORTS",
        "VIEW_REPORTS_OPERATIONAL",
        "VIEW_REPORTS_LECTURERS",
        "VIEW_REPORTS_FACULTIES",
        "VIEW_REPORTS_QUESTIONS"
    ];

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        var quotedCodes = string.Join(", ", LegacyPermissionCodes.Select(code => $"'{code}'"));

        migrationBuilder.Sql($$"""
            DELETE FROM "RolePermissions"
            WHERE "PermissionId" IN (
                SELECT "Id"
                FROM "Permissions"
                WHERE "Code" IN ({{quotedCodes}})
            );

            DELETE FROM "Permissions"
            WHERE "Code" IN ({{quotedCodes}});
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Deleted grants cannot be reconstructed reliably. The legacy permission
        // model must not be restored by an automatic rollback.
    }
}
