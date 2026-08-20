using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyResponseFilteringColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsValid",
                table: "SurveyResponses",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReasons",
                table: "SurveyResponses",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttentionCheckValue",
                table: "SurveyQuestions",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_CourseSectionSurveyId_IsValid",
                table: "SurveyResponses",
                columns: new[] { "CourseSectionSurveyId", "IsValid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SurveyResponses_CourseSectionSurveyId_IsValid",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "IsValid",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "RejectionReasons",
                table: "SurveyResponses");

            migrationBuilder.DropColumn(
                name: "AttentionCheckValue",
                table: "SurveyQuestions");
        }
    }
}
