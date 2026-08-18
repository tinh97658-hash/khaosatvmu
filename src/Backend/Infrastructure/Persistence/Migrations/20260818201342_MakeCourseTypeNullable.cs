using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeCourseTypeNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "CourseType",
                table: "Courses",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "");

            // Chuỗi rỗng trước đây mang nghĩa "chưa xác định", nay dùng NULL.
            migrationBuilder.Sql(
                "UPDATE \"Courses\" SET \"CourseType\" = NULL WHERE \"CourseType\" = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Phải dọn NULL trước, nếu không lệnh SET NOT NULL bên dưới sẽ lỗi.
            migrationBuilder.Sql(
                "UPDATE \"Courses\" SET \"CourseType\" = '' WHERE \"CourseType\" IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "CourseType",
                table: "Courses",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);
        }
    }
}
