using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLecturerPosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PositionId",
                table: "Lecturers",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Lecturers_PositionId",
                table: "Lecturers",
                column: "PositionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Lecturers_Positions_PositionId",
                table: "Lecturers",
                column: "PositionId",
                principalTable: "Positions",
                principalColumn: "PositionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Lecturers_Positions_PositionId",
                table: "Lecturers");

            migrationBuilder.DropIndex(
                name: "IX_Lecturers_PositionId",
                table: "Lecturers");

            migrationBuilder.DropColumn(
                name: "PositionId",
                table: "Lecturers");
        }
    }
}
