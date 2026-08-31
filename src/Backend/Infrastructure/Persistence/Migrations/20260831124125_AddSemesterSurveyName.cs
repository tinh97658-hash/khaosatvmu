using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSemesterSurveyName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SurveyName",
                table: "SemesterSurveys",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Cột NOT NULL nên các đợt đã tạo trước đây nhận chuỗi rỗng — đặt tên lại
            // cho chúng, nếu không màn hình Khảo sát học phần sẽ hiện tiêu đề trống.
            // Ghép từ chính học kỳ và năm học của đợt: "Học kỳ 1" + "2025-2026" ra
            // "Khảo sát kết thúc học phần học kỳ 1 năm học 2025-2026".
            migrationBuilder.Sql("""
                UPDATE "SemesterSurveys" ss
                SET "SurveyName" =
                    'Khảo sát kết thúc học phần ' || lower(s."SemesterName")
                    || ' năm học ' || ay."AcademicYearName"
                FROM "Semesters" s
                JOIN "AcademicYears" ay ON ay."AcademicYearId" = s."AcademicYearId"
                WHERE s."SemesterId" = ss."SemesterId" AND ss."SurveyName" = '';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SurveyName",
                table: "SemesterSurveys");
        }
    }
}
