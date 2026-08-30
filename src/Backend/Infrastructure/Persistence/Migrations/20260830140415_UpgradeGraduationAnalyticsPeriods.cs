using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpgradeGraduationAnalyticsPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReviewMonth",
                table: "GraduationAnalyticsDatasets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewPeriodText",
                table: "GraduationAnalyticsDatasets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewYear",
                table: "GraduationAnalyticsDatasets",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_Cohort",
                table: "GraduationAnalyticsRows",
                columns: new[] { "DatasetId", "Cohort" });

            migrationBuilder.Sql(
                """
                DO $graduation_period_migration$
                DECLARE
                    source_dataset record;
                    period_row record;
                    first_period boolean;
                    target_dataset_id bigint;
                    period_label text;
                    payload text;
                    migrated_hash text;
                    problem_details text;
                BEGIN
                    SELECT string_agg(format('row %s (dataset %s)', "RowId", "DatasetId"), ', ' ORDER BY "DatasetId", "RowId")
                    INTO problem_details
                    FROM "GraduationAnalyticsRows"
                    WHERE "ReviewMonth" IS NULL OR "ReviewMonth" NOT BETWEEN 1 AND 12
                       OR "ReviewYear" IS NULL OR "ReviewYear" NOT BETWEEN 1900 AND 2200;

                    IF problem_details IS NOT NULL THEN
                        RAISE EXCEPTION USING MESSAGE =
                            'Graduation analytics migration stopped: invalid review periods at ' || problem_details;
                    END IF;

                    SELECT string_agg("DatasetId"::text, ', ' ORDER BY "DatasetId")
                    INTO problem_details
                    FROM "GraduationAnalyticsDatasets" dataset
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM "GraduationAnalyticsRows" row_data
                        WHERE row_data."DatasetId" = dataset."DatasetId");

                    IF problem_details IS NOT NULL THEN
                        RAISE EXCEPTION USING MESSAGE =
                            'Graduation analytics migration stopped: datasets without rows: ' || problem_details;
                    END IF;

                    SELECT string_agg(
                        format('T%s - %s (datasets: %s)', duplicate_period."ReviewMonth", duplicate_period."ReviewYear", duplicate_period.dataset_ids),
                        '; ' ORDER BY duplicate_period."ReviewYear", duplicate_period."ReviewMonth")
                    INTO problem_details
                    FROM (
                        SELECT
                            "ReviewMonth",
                            "ReviewYear",
                            string_agg(DISTINCT "DatasetId"::text, ', ' ORDER BY "DatasetId"::text) AS dataset_ids
                        FROM "GraduationAnalyticsRows"
                        GROUP BY "ReviewMonth", "ReviewYear"
                        HAVING count(DISTINCT "DatasetId") > 1
                    ) duplicate_period;

                    IF problem_details IS NOT NULL THEN
                        RAISE EXCEPTION USING MESSAGE =
                            'Graduation analytics migration stopped: duplicate periods require manual selection: ' || problem_details;
                    END IF;

                    FOR source_dataset IN
                        SELECT * FROM "GraduationAnalyticsDatasets" ORDER BY "DatasetId"
                    LOOP
                        first_period := true;

                        FOR period_row IN
                            SELECT "ReviewMonth", "ReviewYear", count(*)::integer AS row_count
                            FROM "GraduationAnalyticsRows"
                            WHERE "DatasetId" = source_dataset."DatasetId"
                            GROUP BY "ReviewMonth", "ReviewYear"
                            ORDER BY "ReviewYear", "ReviewMonth"
                        LOOP
                            period_label := format('T%s - %s', period_row."ReviewMonth", period_row."ReviewYear");

                            SELECT string_agg(
                                concat_ws(E'\x1f',
                                    btrim(row_data."SourceSheetName"), row_data."SourceRowNumber"::text,
                                    btrim(row_data."FacultyName"), coalesce(btrim(row_data."ProgramCode"), ''),
                                    btrim(row_data."ProgramName"), btrim(row_data."Cohort"),
                                    coalesce(row_data."InitialEnrollmentCount"::text, 'null'),
                                    row_data."ReviewMonth"::text, row_data."ReviewYear"::text,
                                    coalesce(row_data."ExcellentCount"::text, 'null'), coalesce(row_data."ExcellentRate"::text, 'null'),
                                    coalesce(row_data."VeryGoodCount"::text, 'null'), coalesce(row_data."VeryGoodRate"::text, 'null'),
                                    coalesce(row_data."GoodCount"::text, 'null'), coalesce(row_data."GoodRate"::text, 'null'),
                                    coalesce(row_data."AverageCount"::text, 'null'), coalesce(row_data."AverageRate"::text, 'null'),
                                    coalesce(row_data."WorkStudyTransferCount"::text, 'null'), coalesce(row_data."WorkStudyTransferRate"::text, 'null')),
                                E'\x1e' ORDER BY row_data."SourceSheetName", row_data."SourceRowNumber")
                            INTO payload
                            FROM "GraduationAnalyticsRows" row_data
                            WHERE row_data."DatasetId" = source_dataset."DatasetId"
                              AND row_data."ReviewMonth" = period_row."ReviewMonth"
                              AND row_data."ReviewYear" = period_row."ReviewYear";

                            migrated_hash := md5(payload) || md5('graduation-period-v2|' || payload);

                            IF first_period THEN
                                target_dataset_id := source_dataset."DatasetId";
                                UPDATE "GraduationAnalyticsDatasets"
                                SET "DatasetName" = 'Đợt ' || period_label,
                                    "ReviewPeriodText" = period_label,
                                    "ReviewMonth" = period_row."ReviewMonth",
                                    "ReviewYear" = period_row."ReviewYear",
                                    "RowCount" = period_row.row_count,
                                    "MinimumReviewDate" = make_date(period_row."ReviewYear", period_row."ReviewMonth", 1),
                                    "MaximumReviewDate" = make_date(period_row."ReviewYear", period_row."ReviewMonth", 1),
                                    "ContentHash" = migrated_hash
                                WHERE "DatasetId" = target_dataset_id;
                                first_period := false;
                            ELSE
                                INSERT INTO "GraduationAnalyticsDatasets" (
                                    "DatasetName", "ReviewPeriodText", "ReviewMonth", "ReviewYear",
                                    "OriginalFileName", "ContentHash", "ImportedByUserId", "ImportedByName",
                                    "ImportedAtUtc", "RowCount", "MinimumReviewDate", "MaximumReviewDate")
                                VALUES (
                                    'Đợt ' || period_label, period_label, period_row."ReviewMonth", period_row."ReviewYear",
                                    source_dataset."OriginalFileName", migrated_hash, source_dataset."ImportedByUserId",
                                    source_dataset."ImportedByName", source_dataset."ImportedAtUtc", period_row.row_count,
                                    make_date(period_row."ReviewYear", period_row."ReviewMonth", 1),
                                    make_date(period_row."ReviewYear", period_row."ReviewMonth", 1))
                                RETURNING "DatasetId" INTO target_dataset_id;

                                UPDATE "GraduationAnalyticsRows"
                                SET "DatasetId" = target_dataset_id
                                WHERE "DatasetId" = source_dataset."DatasetId"
                                  AND "ReviewMonth" = period_row."ReviewMonth"
                                  AND "ReviewYear" = period_row."ReviewYear";
                            END IF;
                        END LOOP;
                    END LOOP;
                END $graduation_period_migration$;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "ReviewMonth",
                table: "GraduationAnalyticsDatasets",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ReviewPeriodText",
                table: "GraduationAnalyticsDatasets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ReviewYear",
                table: "GraduationAnalyticsDatasets",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GraduationAnalyticsDatasets_ReviewYear_ReviewMonth",
                table: "GraduationAnalyticsDatasets",
                columns: new[] { "ReviewYear", "ReviewMonth" },
                unique: true,
                descending: new bool[0]);

            migrationBuilder.AddCheckConstraint(
                name: "CK_GraduationAnalyticsDatasets_ReviewMonth",
                table: "GraduationAnalyticsDatasets",
                sql: "\"ReviewMonth\" BETWEEN 1 AND 12");

            migrationBuilder.AddCheckConstraint(
                name: "CK_GraduationAnalyticsDatasets_ReviewYear",
                table: "GraduationAnalyticsDatasets",
                sql: "\"ReviewYear\" BETWEEN 1900 AND 2200");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GraduationAnalyticsRows_DatasetId_Cohort",
                table: "GraduationAnalyticsRows");

            migrationBuilder.DropIndex(
                name: "IX_GraduationAnalyticsDatasets_ReviewYear_ReviewMonth",
                table: "GraduationAnalyticsDatasets");

            migrationBuilder.DropCheckConstraint(
                name: "CK_GraduationAnalyticsDatasets_ReviewMonth",
                table: "GraduationAnalyticsDatasets");

            migrationBuilder.DropCheckConstraint(
                name: "CK_GraduationAnalyticsDatasets_ReviewYear",
                table: "GraduationAnalyticsDatasets");

            migrationBuilder.DropColumn(
                name: "ReviewMonth",
                table: "GraduationAnalyticsDatasets");

            migrationBuilder.DropColumn(
                name: "ReviewPeriodText",
                table: "GraduationAnalyticsDatasets");

            migrationBuilder.DropColumn(
                name: "ReviewYear",
                table: "GraduationAnalyticsDatasets");
        }
    }
}
