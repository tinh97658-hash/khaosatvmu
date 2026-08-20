using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUnidentifiedLecturerToCourseSection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "LecturerId",
                table: "CourseSections",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "UnidentifiedLecturerName",
                table: "CourseSections",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseSections_UnidentifiedLecturerName",
                table: "CourseSections",
                column: "UnidentifiedLecturerName",
                filter: "\"UnidentifiedLecturerName\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CourseSections_UnidentifiedLecturerName",
                table: "CourseSections");

            migrationBuilder.DropColumn(
                name: "UnidentifiedLecturerName",
                table: "CourseSections");

            migrationBuilder.AlterColumn<int>(
                name: "LecturerId",
                table: "CourseSections",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
