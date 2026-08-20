using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCourseSectionSurveyScoreColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AverageScore",
                table: "CourseSectionSurveys",
                type: "numeric(4,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InvalidResponseCount",
                table: "CourseSectionSurveys",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScoreCalculatedAt",
                table: "CourseSectionSurveys",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalResponseCount",
                table: "CourseSectionSurveys",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ValidResponseCount",
                table: "CourseSectionSurveys",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AverageScore",
                table: "CourseSectionSurveys");

            migrationBuilder.DropColumn(
                name: "InvalidResponseCount",
                table: "CourseSectionSurveys");

            migrationBuilder.DropColumn(
                name: "ScoreCalculatedAt",
                table: "CourseSectionSurveys");

            migrationBuilder.DropColumn(
                name: "TotalResponseCount",
                table: "CourseSectionSurveys");

            migrationBuilder.DropColumn(
                name: "ValidResponseCount",
                table: "CourseSectionSurveys");
        }
    }
}
