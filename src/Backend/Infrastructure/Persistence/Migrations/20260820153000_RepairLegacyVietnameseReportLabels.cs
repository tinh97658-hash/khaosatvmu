using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations;

/// <summary>
/// Repairs the legacy catalogue labels used by the current survey report.
/// The predicates intentionally touch only values that still contain the
/// replacement question marks from the historical import.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260820153000_RepairLegacyVietnameseReportLabels")]
public sealed class RepairLegacyVietnameseReportLabels : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "Semesters" SET "SemesterName" = 'Học kỳ phụ'
            WHERE "SemesterId" = 1 AND "SemesterName" LIKE '%?%';
            UPDATE "Semesters" SET "SemesterName" = 'Học kỳ 1'
            WHERE "SemesterId" = 2 AND "SemesterName" LIKE '%?%';
            UPDATE "Semesters" SET "SemesterName" = 'Học kỳ 2'
            WHERE "SemesterId" = 3 AND "SemesterName" LIKE '%?%';

            UPDATE "Faculties" SET "FacultyName" = 'Công nghệ thông tin'
            WHERE "FacultyId" = 2 AND "FacultyName" LIKE '%?%';

            UPDATE "Departments" SET "DepartmentName" = 'Truyền thông và mạng máy tính'
            WHERE "DepartmentId" = 1 AND "DepartmentName" LIKE '%?%';
            UPDATE "Departments" SET "DepartmentName" = 'Hệ thống thông tin'
            WHERE "DepartmentId" = 2 AND "DepartmentName" LIKE '%?%';
            UPDATE "Departments" SET "DepartmentName" = 'Tin học đại cương'
            WHERE "DepartmentId" = 3 AND "DepartmentName" LIKE '%?%';
            UPDATE "Departments" SET "DepartmentName" = 'Khoa học máy tính'
            WHERE "DepartmentId" = 4 AND "DepartmentName" LIKE '%?%';
            UPDATE "Departments" SET "DepartmentName" = 'Kỹ thuật máy tính'
            WHERE "DepartmentId" = 5 AND "DepartmentName" LIKE '%?%';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Data-repair migrations are intentionally irreversible: restoring the
        // corrupted replacement characters would destroy valid catalogue text.
    }
}
