using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyTemplateEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnswerScales",
                columns: table => new
                {
                    AnswerScaleId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AnswerScaleName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnswerScales", x => x.AnswerScaleId);
                });

            migrationBuilder.CreateTable(
                name: "AnswerScaleOptions",
                columns: table => new
                {
                    AnswerScaleOptionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AnswerScaleId = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false),
                    DisplayText = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnswerScaleOptions", x => x.AnswerScaleOptionId);
                    table.CheckConstraint("CK_AnswerScaleOptions_Value", "\"Value\" BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_AnswerScaleOptions_AnswerScales_AnswerScaleId",
                        column: x => x.AnswerScaleId,
                        principalTable: "AnswerScales",
                        principalColumn: "AnswerScaleId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SurveyTemplates",
                columns: table => new
                {
                    SurveyTemplateId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TemplateName = table.Column<string>(type: "text", nullable: false),
                    AnswerScaleId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyTemplates", x => x.SurveyTemplateId);
                    table.ForeignKey(
                        name: "FK_SurveyTemplates_AnswerScales_AnswerScaleId",
                        column: x => x.AnswerScaleId,
                        principalTable: "AnswerScales",
                        principalColumn: "AnswerScaleId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SurveyQuestions",
                columns: table => new
                {
                    QuestionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SurveyTemplateId = table.Column<int>(type: "integer", nullable: false),
                    QuestionText = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestions", x => x.QuestionId);
                    table.ForeignKey(
                        name: "FK_SurveyQuestions_SurveyTemplates_SurveyTemplateId",
                        column: x => x.SurveyTemplateId,
                        principalTable: "SurveyTemplates",
                        principalColumn: "SurveyTemplateId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnswerScaleOptions_AnswerScaleId_Value",
                table: "AnswerScaleOptions",
                columns: new[] { "AnswerScaleId", "Value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyTemplateId",
                table: "SurveyQuestions",
                column: "SurveyTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyTemplates_AnswerScaleId",
                table: "SurveyTemplates",
                column: "AnswerScaleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnswerScaleOptions");

            migrationBuilder.DropTable(
                name: "SurveyQuestions");

            migrationBuilder.DropTable(
                name: "SurveyTemplates");

            migrationBuilder.DropTable(
                name: "AnswerScales");
        }
    }
}
