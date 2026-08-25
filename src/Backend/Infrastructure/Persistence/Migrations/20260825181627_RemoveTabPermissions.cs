using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTabPermissions : Migration
    {
        /// <summary>
        /// Mười quyền cấp tab đã bị gỡ khỏi mã nguồn: không endpoint nào đòi chúng nữa
        /// và giao diện cũng không đọc tới. Để lại trong bảng "Permissions" thì màn
        /// Phân quyền Module vẫn hiện mười công tắc không còn tác dụng, nên xoá hẳn.
        /// Xoá "RolePermissions" trước vì có khoá ngoại trỏ sang "Permissions".
        /// </summary>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "RolePermissions"
                WHERE "PermissionId" IN (
                    SELECT "Id" FROM "Permissions" WHERE "Code" IN (
                        'REPORTS_OVERVIEW_ACCESS',
                        'REPORTS_DETAILS_ACCESS',
                        'REPORTS_RANKINGS_ACCESS',
                        'SURVEY_ANALYSIS_NORMALIZATION_ACCESS',
                        'SURVEY_ANALYSIS_DEPARTMENTS_ACCESS',
                        'SURVEY_ANALYSIS_COURSES_ACCESS',
                        'SURVEY_ANALYSIS_LECTURER_ACCESS',
                        'USER_ADMIN_ACCOUNTS_ACCESS',
                        'USER_ADMIN_AUDIT_ACCESS',
                        'USER_ADMIN_PERMISSIONS_ACCESS'
                    )
                );

                DELETE FROM "Permissions"
                WHERE "Code" IN (
                    'REPORTS_OVERVIEW_ACCESS',
                    'REPORTS_DETAILS_ACCESS',
                    'REPORTS_RANKINGS_ACCESS',
                    'SURVEY_ANALYSIS_NORMALIZATION_ACCESS',
                    'SURVEY_ANALYSIS_DEPARTMENTS_ACCESS',
                    'SURVEY_ANALYSIS_COURSES_ACCESS',
                    'SURVEY_ANALYSIS_LECTURER_ACCESS',
                    'USER_ADMIN_ACCOUNTS_ACCESS',
                    'USER_ADMIN_AUDIT_ACCESS',
                    'USER_ADMIN_PERMISSIONS_ACCESS'
                );
                """);
        }

        /// <summary>
        /// Không dựng lại các quyền đã xoá: mã nguồn không còn chỗ nào dùng tới chúng,
        /// nên tạo lại chỉ sinh ra dữ liệu chết. Muốn có lại thì revert cả tính năng.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
