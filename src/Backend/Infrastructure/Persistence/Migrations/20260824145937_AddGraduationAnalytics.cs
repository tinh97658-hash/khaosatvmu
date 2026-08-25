using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGraduationAnalytics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GraduationAnalyticsDatasets",
                columns: table => new
                {
                    DatasetId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DatasetName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentHash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    ImportedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImportedByName = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    ImportedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    MinimumReviewDate = table.Column<DateOnly>(type: "date", nullable: true),
                    MaximumReviewDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GraduationAnalyticsDatasets", x => x.DatasetId);
                });

            migrationBuilder.CreateTable(
                name: "GraduationAnalyticsRows",
                columns: table => new
                {
                    RowId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DatasetId = table.Column<long>(type: "bigint", nullable: false),
                    SourceSheetName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SourceRowNumber = table.Column<int>(type: "integer", nullable: false),
                    FacultyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ProgramCode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ProgramName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Cohort = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InitialEnrollmentCount = table.Column<int>(type: "integer", nullable: true),
                    ReviewPeriodText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ReviewMonth = table.Column<int>(type: "integer", nullable: true),
                    ReviewYear = table.Column<int>(type: "integer", nullable: true),
                    EligibleGraduateCount = table.Column<int>(type: "integer", nullable: true),
                    OnTimeGraduateCount = table.Column<int>(type: "integer", nullable: true),
                    OnTimeGraduateRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true),
                    ExcellentCount = table.Column<int>(type: "integer", nullable: true),
                    ExcellentRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true),
                    VeryGoodCount = table.Column<int>(type: "integer", nullable: true),
                    VeryGoodRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true),
                    GoodCount = table.Column<int>(type: "integer", nullable: true),
                    GoodRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true),
                    AverageCount = table.Column<int>(type: "integer", nullable: true),
                    AverageRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true),
                    WorkStudyTransferCount = table.Column<int>(type: "integer", nullable: true),
                    WorkStudyTransferRate = table.Column<decimal>(type: "numeric(9,4)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GraduationAnalyticsRows", x => x.RowId);
                    table.ForeignKey(
                        name: "FK_GraduationAnalyticsRows_GraduationAnalyticsDatasets_Dataset~",
                        column: x => x.DatasetId,
                        principalTable: "GraduationAnalyticsDatasets",
                        principalColumn: "DatasetId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsDatasets_ContentHash",
                table: "GraduationAnalyticsDatasets",
                column: "ContentHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsDatasets_ImportedAtUtc",
                table: "GraduationAnalyticsDatasets",
                column: "ImportedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_FacultyName",
                table: "GraduationAnalyticsRows",
                columns: new[] { "DatasetId", "FacultyName" });

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_ProgramCode_ProgramName",
                table: "GraduationAnalyticsRows",
                columns: new[] { "DatasetId", "ProgramCode", "ProgramName" });

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_ReviewYear_ReviewMonth",
                table: "GraduationAnalyticsRows",
                columns: new[] { "DatasetId", "ReviewYear", "ReviewMonth" });

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_SourceSheetName_SourceRow~",
                table: "GraduationAnalyticsRows",
                columns: new[] { "DatasetId", "SourceSheetName", "SourceRowNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GraduationAnalyticsRows");

            migrationBuilder.DropTable(
                name: "GraduationAnalyticsDatasets");
        }
    }
}
