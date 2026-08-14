using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MoveLecturerIntoCourseSection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourseSectionLecturers");

            migrationBuilder.AddColumn<int>(
                name: "LecturerId",
                table: "CourseSections",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_CourseSections_LecturerId",
                table: "CourseSections",
                column: "LecturerId");

            migrationBuilder.AddForeignKey(
                name: "FK_CourseSections_Lecturers_LecturerId",
                table: "CourseSections",
                column: "LecturerId",
                principalTable: "Lecturers",
                principalColumn: "LecturerId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CourseSections_Lecturers_LecturerId",
                table: "CourseSections");

            migrationBuilder.DropIndex(
                name: "IX_CourseSections_LecturerId",
                table: "CourseSections");

            migrationBuilder.DropColumn(
                name: "LecturerId",
                table: "CourseSections");

            migrationBuilder.CreateTable(
                name: "CourseSectionLecturers",
                columns: table => new
                {
                    CourseSectionId = table.Column<int>(type: "integer", nullable: false),
                    LecturerId = table.Column<int>(type: "integer", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseSectionLecturers", x => new { x.CourseSectionId, x.LecturerId });
                    table.ForeignKey(
                        name: "FK_CourseSectionLecturers_CourseSections_CourseSectionId",
                        column: x => x.CourseSectionId,
                        principalTable: "CourseSections",
                        principalColumn: "CourseSectionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseSectionLecturers_Lecturers_LecturerId",
                        column: x => x.LecturerId,
                        principalTable: "Lecturers",
                        principalColumn: "LecturerId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseSectionLecturers_LecturerId",
                table: "CourseSectionLecturers",
                column: "LecturerId");
        }
    }
}
