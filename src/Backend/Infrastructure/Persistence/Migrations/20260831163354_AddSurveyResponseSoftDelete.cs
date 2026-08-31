using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyResponseSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "SurveyResponses",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "SurveyResponses",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_CourseSectionSurveyId_IsDeleted",
                table: "SurveyResponses",
                columns: new[] { "CourseSectionSurveyId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_CourseSectionSurveyId_IsDeleted",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "SurveyResponses");
        }
    }
}
