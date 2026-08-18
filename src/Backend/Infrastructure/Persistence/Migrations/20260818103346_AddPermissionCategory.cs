using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPermissionCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Permissions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE "Permissions"
                SET "Category" = CASE "Code"
                    WHEN 'ADMIN_ACCESS'             THEN 'Quản trị hệ thống'
                    WHEN 'SURVEY_MANAGE'            THEN 'Khảo sát'
                    WHEN 'VIEW_REPORTS'             THEN 'Báo cáo'
                    WHEN 'VIEW_REPORTS_OPERATIONAL' THEN 'Báo cáo'
                    WHEN 'VIEW_REPORTS_LECTURERS'   THEN 'Báo cáo'
                    WHEN 'VIEW_REPORTS_FACULTIES'   THEN 'Báo cáo'
                    WHEN 'VIEW_REPORTS_QUESTIONS'   THEN 'Báo cáo'
                    ELSE ''
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Permissions");
        }
    }
}
