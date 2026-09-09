using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Chia bộ câu hỏi thành mục. Câu hỏi bỏ khoá ngoại thẳng tới "SurveyTemplates"
    /// và trỏ vào "SurveyQuestionSections" — bộ của một câu suy ra từ mục.
    ///
    /// KHÔNG dùng RenameColumn để biến "SurveyTemplateId" thành "SectionId" như bản
    /// EF tự sinh: hai cột cùng kiểu int nhưng giá trị đang nằm trong đó là mã BỘ,
    /// đổi tên là mọi câu trỏ sang mục mang số trùng với mã bộ. Phải thêm cột mới,
    /// chuyển dữ liệu qua, rồi mới bỏ cột cũ.
    /// </summary>
    public partial class AddSurveyQuestionSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Chốt chặn 30 câu nằm trong CSDL dưới dạng trigger, do bản dump dựng ra
            // chứ không phải migration nào, nên EF không biết mà bỏ. Nó đọc
            // NEW."SurveyTemplateId" — cột sắp bị gỡ — nên để lại thì mọi lần thêm
            // câu hỏi đều lỗi. Giới hạn 30 câu cũng đã bỏ hẳn.
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_limit_survey_questions ON "SurveyQuestions"
                """);
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS fn_limit_survey_questions()");

            migrationBuilder.CreateTable(
                name: "SurveyQuestionSections",
                columns: table => new
                {
                    SectionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SurveyTemplateId = table.Column<int>(type: "integer", nullable: false),
                    SectionName = table.Column<string>(type: "text", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyQuestionSections", x => x.SectionId);
                    table.ForeignKey(
                        name: "FK_SurveyQuestionSections_SurveyTemplates_SurveyTemplateId",
                        column: x => x.SurveyTemplateId,
                        principalTable: "SurveyTemplates",
                        principalColumn: "SurveyTemplateId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestionSections_SurveyTemplateId_SectionName",
                table: "SurveyQuestionSections",
                columns: new[] { "SurveyTemplateId", "SectionName" },
                unique: true,
                filter: "NOT \"IsDeleted\"");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "SurveyQuestions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "SurveyQuestions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Cột nhận dữ liệu chuyển sang, tạm cho phép NULL vì lúc này chưa có mục nào.
            migrationBuilder.AddColumn<int>(
                name: "SectionId",
                table: "SurveyQuestions",
                type: "integer",
                nullable: true);

            // Bộ nào cũng được một mục mang đúng tên bộ, kể cả bộ chưa có câu nào và
            // bộ đã xoá mềm: mọi câu đều phải có mục, và bộ không mục thì lần sửa đầu
            // tiên sẽ bị ValidateTemplateAsync chặn vì thiếu mục.
            // Ai muốn chia lại theo mẫu phiếu thì vào trình soạn sửa tên và tách mục.
            migrationBuilder.Sql("""
                INSERT INTO "SurveyQuestionSections" ("SurveyTemplateId", "SectionName", "IsDeleted")
                SELECT t."SurveyTemplateId", t."TemplateName", FALSE
                FROM "SurveyTemplates" AS t
                """);

            migrationBuilder.Sql("""
                UPDATE "SurveyQuestions" AS q
                SET "SectionId" = s."SectionId"
                FROM "SurveyQuestionSections" AS s
                WHERE s."SurveyTemplateId" = q."SurveyTemplateId"
                """);

            migrationBuilder.AlterColumn<int>(
                name: "SectionId",
                table: "SurveyQuestions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyQuestions_SurveyTemplates_SurveyTemplateId",
                table: "SurveyQuestions");

            migrationBuilder.DropIndex(
                name: "IX_SurveyQuestions_SurveyTemplateId",
                table: "SurveyQuestions");

            migrationBuilder.DropColumn(
                name: "SurveyTemplateId",
                table: "SurveyQuestions");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SectionId",
                table: "SurveyQuestions",
                column: "SectionId");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyQuestions_SurveyQuestionSections_SectionId",
                table: "SurveyQuestions",
                column: "SectionId",
                principalTable: "SurveyQuestionSections",
                principalColumn: "SectionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SurveyTemplateId",
                table: "SurveyQuestions",
                type: "integer",
                nullable: true);

            // Lấy lại mã bộ từ mục. Câu thuộc mục đã xoá mềm vẫn lần ra được bộ nên
            // không dòng nào rơi lại NULL.
            migrationBuilder.Sql("""
                UPDATE "SurveyQuestions" AS q
                SET "SurveyTemplateId" = s."SurveyTemplateId"
                FROM "SurveyQuestionSections" AS s
                WHERE s."SectionId" = q."SectionId"
                """);

            migrationBuilder.AlterColumn<int>(
                name: "SurveyTemplateId",
                table: "SurveyQuestions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyQuestions_SurveyQuestionSections_SectionId",
                table: "SurveyQuestions");

            migrationBuilder.DropIndex(
                name: "IX_SurveyQuestions_SectionId",
                table: "SurveyQuestions");

            migrationBuilder.DropColumn(
                name: "SectionId",
                table: "SurveyQuestions");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "SurveyQuestions");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "SurveyQuestions");

            migrationBuilder.DropTable(
                name: "SurveyQuestionSections");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_SurveyTemplateId",
                table: "SurveyQuestions",
                column: "SurveyTemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyQuestions_SurveyTemplates_SurveyTemplateId",
                table: "SurveyQuestions",
                column: "SurveyTemplateId",
                principalTable: "SurveyTemplates",
                principalColumn: "SurveyTemplateId",
                onDelete: ReferentialAction.Cascade);

            // Dựng lại trigger giới hạn 30 câu cho khớp trạng thái trước migration.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION fn_limit_survey_questions()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $function$
                BEGIN
                    IF (SELECT COUNT(*) FROM public."SurveyQuestions"
                        WHERE "SurveyTemplateId" = NEW."SurveyTemplateId") >= 30 THEN
                        RAISE EXCEPTION 'A survey template can have at most 30 questions';
                    END IF;
                    RETURN NEW;
                END;
                $function$
                """);
            migrationBuilder.Sql("""
                CREATE TRIGGER trg_limit_survey_questions
                BEFORE INSERT ON "SurveyQuestions"
                FOR EACH ROW EXECUTE FUNCTION fn_limit_survey_questions()
                """);
        }
    }
}
