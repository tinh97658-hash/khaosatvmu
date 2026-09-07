using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSemesterSurveySchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndTime",
                table: "SemesterSurveys",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartTime",
                table: "SemesterSurveys",
                type: "timestamp with time zone",
                nullable: true);

            // Các đợt cũ chưa có lịch tổng riêng: lấy biên sớm nhất/muộn nhất của tất cả lớp.
            // Đợt không còn lớp dùng CreatedAt và CreatedAt + 1 ngày để vẫn có khoảng hợp lệ.
            migrationBuilder.Sql(
                """
                UPDATE "SemesterSurveys" AS ss
                SET
                    "StartTime" = COALESCE((
                        SELECT MIN(css."StartTime")
                        FROM "CourseSectionSurveys" AS css
                        WHERE css."SemesterSurveyId" = ss."SemesterSurveyId"
                    ), ss."CreatedAt"),
                    "EndTime" = COALESCE((
                        SELECT MAX(css."EndTime")
                        FROM "CourseSectionSurveys" AS css
                        WHERE css."SemesterSurveyId" = ss."SemesterSurveyId"
                    ), ss."CreatedAt" + INTERVAL '1 day');
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "EndTime",
                table: "SemesterSurveys",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartTime",
                table: "SemesterSurveys",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_SemesterSurveys_TimeRange",
                table: "SemesterSurveys",
                sql: "\"EndTime\" > \"StartTime\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_SemesterSurveys_TimeRange",
                table: "SemesterSurveys");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "SemesterSurveys");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "SemesterSurveys");
        }
    }
}
