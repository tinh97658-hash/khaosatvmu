using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyRunEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SemesterSurveys",
                columns: table => new
                {
                    SemesterSurveyId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SemesterId = table.Column<int>(type: "integer", nullable: false),
                    SurveyTemplateId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SemesterSurveys", x => x.SemesterSurveyId);
                    table.ForeignKey(
                        name: "FK_SemesterSurveys_Semesters_SemesterId",
                        column: x => x.SemesterId,
                        principalTable: "Semesters",
                        principalColumn: "SemesterId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SemesterSurveys_SurveyTemplates_SurveyTemplateId",
                        column: x => x.SurveyTemplateId,
                        principalTable: "SurveyTemplates",
                        principalColumn: "SurveyTemplateId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CourseSectionSurveys",
                columns: table => new
                {
                    CourseSectionSurveyId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SemesterSurveyId = table.Column<int>(type: "integer", nullable: false),
                    CourseSectionId = table.Column<int>(type: "integer", nullable: false),
                    LinkToken = table.Column<string>(type: "text", nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseSectionSurveys", x => x.CourseSectionSurveyId);
                    table.CheckConstraint("CK_CourseSectionSurveys_TimeRange", "\"EndTime\" > \"StartTime\"");
                    table.ForeignKey(
                        name: "FK_CourseSectionSurveys_CourseSections_CourseSectionId",
                        column: x => x.CourseSectionId,
                        principalTable: "CourseSections",
                        principalColumn: "CourseSectionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseSectionSurveys_SemesterSurveys_SemesterSurveyId",
                        column: x => x.SemesterSurveyId,
                        principalTable: "SemesterSurveys",
                        principalColumn: "SemesterSurveyId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyResponses",
                columns: table => new
                {
                    ResponseId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CourseSectionSurveyId = table.Column<int>(type: "integer", nullable: false),
                    AdditionalComments = table.Column<string>(type: "text", nullable: true),
                    Score = table.Column<decimal>(type: "numeric(4,2)", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyResponses", x => x.ResponseId);
                    table.ForeignKey(
                        name: "FK_SurveyResponses_CourseSectionSurveys_CourseSectionSurveyId",
                        column: x => x.CourseSectionSurveyId,
                        principalTable: "CourseSectionSurveys",
                        principalColumn: "CourseSectionSurveyId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyResponseAnswers",
                columns: table => new
                {
                    ResponseId = table.Column<int>(type: "integer", nullable: false),
                    QuestionId = table.Column<int>(type: "integer", nullable: false),
                    SelectedValue = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyResponseAnswers", x => new { x.ResponseId, x.QuestionId });
                    table.CheckConstraint("CK_SurveyResponseAnswers_SelectedValue", "\"SelectedValue\" BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_SurveyResponseAnswers_SurveyQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "SurveyQuestions",
                        principalColumn: "QuestionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SurveyResponseAnswers_SurveyResponses_ResponseId",
                        column: x => x.ResponseId,
                        principalTable: "SurveyResponses",
                        principalColumn: "ResponseId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CourseSectionSurveys_CourseSectionId",
                table: "CourseSectionSurveys",
                column: "CourseSectionId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseSectionSurveys_LinkToken",
                table: "CourseSectionSurveys",
                column: "LinkToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CourseSectionSurveys_SemesterSurveyId_CourseSectionId",
                table: "CourseSectionSurveys",
                columns: new[] { "SemesterSurveyId", "CourseSectionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SemesterSurveys_SemesterId",
                table: "SemesterSurveys",
                column: "SemesterId");

            migrationBuilder.CreateIndex(
                name: "IX_SemesterSurveys_SurveyTemplateId",
                table: "SemesterSurveys",
                column: "SurveyTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponseAnswers_QuestionId",
                table: "SurveyResponseAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyResponses_CourseSectionSurveyId",
                table: "SurveyResponses",
                column: "CourseSectionSurveyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyResponseAnswers");

            migrationBuilder.DropTable(
                name: "SurveyResponses");

            migrationBuilder.DropTable(
                name: "CourseSectionSurveys");

            migrationBuilder.DropTable(
                name: "SemesterSurveys");
        }
    }
}
