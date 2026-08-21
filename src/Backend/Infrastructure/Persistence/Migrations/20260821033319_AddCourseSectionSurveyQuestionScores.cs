using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseSectionSurveyQuestionScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CourseSectionSurveyQuestionScores",
                columns: table => new
                {
                    CourseSectionSurveyId = table.Column<int>(type: "integer", nullable: false),
                    QuestionId = table.Column<int>(type: "integer", nullable: false),
                    AverageScore = table.Column<decimal>(type: "numeric(4,2)", nullable: false),
                    AnswerCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseSectionSurveyQuestionScores", x => new { x.CourseSectionSurveyId, x.QuestionId });
                    table.ForeignKey(
                        name: "FK_CourseSectionSurveyQuestionScores_CourseSectionSurveys_Cour~",
                        column: x => x.CourseSectionSurveyId,
                        principalTable: "CourseSectionSurveys",
                        principalColumn: "CourseSectionSurveyId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseSectionSurveyQuestionScores_SurveyQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "SurveyQuestions",
                        principalColumn: "QuestionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseSectionSurveyQuestionScores_QuestionId",
                table: "CourseSectionSurveyQuestionScores",
                column: "QuestionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CourseSectionSurveyQuestionScores");
        }
    }
}
