using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Chuyển thang trả lời từ cấp bộ câu hỏi xuống cấp từng câu hỏi, và đổi
    /// "SurveyResponseAnswers"."SelectedValue" (int 1..5) thành "AnswerValue" (chữ)
    /// để chứa được cả câu tự nhập.
    ///
    /// Migration này có bước chuyển dữ liệu nên chạy được trên CSDL đã có dữ liệu:
    /// - Mỗi câu hỏi thừa hưởng thang của bộ câu hỏi nó đang thuộc.
    /// - Mọi thang đang có được đánh dấu là thang có mức chọn ('Options').
    /// - Mỗi câu trả lời cũ chuyển từ số sang chuỗi cùng giá trị ('4' thay cho 4).
    /// </summary>
    public partial class MoveAnswerScaleToQuestionAndTextAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // --------------------------------------------- AnswerScales.ScaleKind

            // Thang đang có đều là thang chọn mức nên mặc định 'Options'; đặt trước
            // rồi mới gắn CHECK để dữ liệu cũ không vi phạm ràng buộc.
            migrationBuilder.AddColumn<string>(
                name: "ScaleKind",
                table: "AnswerScales",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Options");

            migrationBuilder.Sql(
                "ALTER TABLE \"AnswerScales\" ALTER COLUMN \"ScaleKind\" DROP DEFAULT;");

            migrationBuilder.AddCheckConstraint(
                name: "CK_AnswerScales_ScaleKind",
                table: "AnswerScales",
                sql: "\"ScaleKind\" IN ('Options', 'Text')");

            // ---------------------------------------- SurveyQuestions.AnswerScaleId

            migrationBuilder.AddColumn<int>(
                name: "AnswerScaleId",
                table: "SurveyQuestions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Kế thừa thang của bộ câu hỏi trước khi bỏ cột ở "SurveyTemplates",
            // nếu không khóa ngoại bên dưới sẽ gãy vì giá trị 0.
            migrationBuilder.Sql("""
                UPDATE "SurveyQuestions" AS q
                SET "AnswerScaleId" = t."AnswerScaleId"
                FROM "SurveyTemplates" AS t
                WHERE q."SurveyTemplateId" = t."SurveyTemplateId";
                """);

            migrationBuilder.Sql(
                "ALTER TABLE \"SurveyQuestions\" ALTER COLUMN \"AnswerScaleId\" DROP DEFAULT;");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyQuestions_AnswerScaleId",
                table: "SurveyQuestions",
                column: "AnswerScaleId");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyQuestions_AnswerScales_AnswerScaleId",
                table: "SurveyQuestions",
                column: "AnswerScaleId",
                principalTable: "AnswerScales",
                principalColumn: "AnswerScaleId",
                onDelete: ReferentialAction.Restrict);

            // -------------------------------------- SurveyTemplates.AnswerScaleId (bỏ)

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyTemplates_AnswerScales_AnswerScaleId",
                table: "SurveyTemplates");

            migrationBuilder.DropIndex(
                name: "IX_SurveyTemplates_AnswerScaleId",
                table: "SurveyTemplates");

            migrationBuilder.DropColumn(
                name: "AnswerScaleId",
                table: "SurveyTemplates");

            // ------------------------------- SurveyResponseAnswers.SelectedValue → AnswerValue

            migrationBuilder.AddColumn<string>(
                name: "AnswerValue",
                table: "SurveyResponseAnswers",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            // Phiếu đã thu giữ nguyên giá trị, chỉ đổi kiểu lưu: 4 → '4'.
            migrationBuilder.Sql(
                "UPDATE \"SurveyResponseAnswers\" SET \"AnswerValue\" = \"SelectedValue\"::text;");

            migrationBuilder.Sql(
                "ALTER TABLE \"SurveyResponseAnswers\" ALTER COLUMN \"AnswerValue\" DROP DEFAULT;");

            migrationBuilder.DropCheckConstraint(
                name: "CK_SurveyResponseAnswers_SelectedValue",
                table: "SurveyResponseAnswers");

            migrationBuilder.DropColumn(
                name: "SelectedValue",
                table: "SurveyResponseAnswers");
        }

        /// <summary>
        /// Quay lui được nhưng có mất mát vì lược đồ cũ không chứa nổi thông tin mới:
        /// - Bộ trộn nhiều thang bị quy về một thang duy nhất (thang có mã nhỏ nhất).
        /// - Thang loại 'Text' quay lại thành thang chọn mức.
        /// - Câu trả lời tự nhập không đổi ngược ra số được nên bị quy về mức 1.
        /// Hãy sao lưu CSDL trước khi chạy trên môi trường có dữ liệu thật.
        /// </summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ------------------------------- SurveyResponseAnswers.AnswerValue → SelectedValue

            migrationBuilder.AddColumn<int>(
                name: "SelectedValue",
                table: "SurveyResponseAnswers",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            // Câu trả lời tự nhập không có giá trị số tương ứng nên không khôi phục
            // được; quy về mức 1 để không vi phạm CHECK. Nội dung chữ sẽ mất.
            migrationBuilder.Sql("""
                UPDATE "SurveyResponseAnswers"
                SET "SelectedValue" = CASE
                    WHEN "AnswerValue" ~ '^[1-5]$' THEN "AnswerValue"::integer
                    ELSE 1
                END;
                """);

            migrationBuilder.Sql(
                "ALTER TABLE \"SurveyResponseAnswers\" ALTER COLUMN \"SelectedValue\" DROP DEFAULT;");

            migrationBuilder.AddCheckConstraint(
                name: "CK_SurveyResponseAnswers_SelectedValue",
                table: "SurveyResponseAnswers",
                sql: "\"SelectedValue\" BETWEEN 1 AND 5");

            migrationBuilder.DropColumn(
                name: "AnswerValue",
                table: "SurveyResponseAnswers");

            // -------------------------------------- SurveyTemplates.AnswerScaleId (khôi phục)

            migrationBuilder.AddColumn<int>(
                name: "AnswerScaleId",
                table: "SurveyTemplates",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Bộ trộn nhiều thang không quy ngược được về một thang; lấy thang nhỏ
            // nhất mà bộ đang dùng, bộ chưa có câu nào thì lấy thang đầu tiên.
            migrationBuilder.Sql("""
                UPDATE "SurveyTemplates" AS t
                SET "AnswerScaleId" = COALESCE(
                    (SELECT MIN(q."AnswerScaleId")
                     FROM "SurveyQuestions" AS q
                     WHERE q."SurveyTemplateId" = t."SurveyTemplateId"),
                    (SELECT MIN("AnswerScaleId") FROM "AnswerScales"),
                    0);
                """);

            migrationBuilder.Sql(
                "ALTER TABLE \"SurveyTemplates\" ALTER COLUMN \"AnswerScaleId\" DROP DEFAULT;");

            migrationBuilder.CreateIndex(
                name: "IX_SurveyTemplates_AnswerScaleId",
                table: "SurveyTemplates",
                column: "AnswerScaleId");

            migrationBuilder.AddForeignKey(
                name: "FK_SurveyTemplates_AnswerScales_AnswerScaleId",
                table: "SurveyTemplates",
                column: "AnswerScaleId",
                principalTable: "AnswerScales",
                principalColumn: "AnswerScaleId",
                onDelete: ReferentialAction.Restrict);

            // ---------------------------------------- SurveyQuestions.AnswerScaleId (bỏ)

            migrationBuilder.DropForeignKey(
                name: "FK_SurveyQuestions_AnswerScales_AnswerScaleId",
                table: "SurveyQuestions");

            migrationBuilder.DropIndex(
                name: "IX_SurveyQuestions_AnswerScaleId",
                table: "SurveyQuestions");

            migrationBuilder.DropColumn(
                name: "AnswerScaleId",
                table: "SurveyQuestions");

            // --------------------------------------------- AnswerScales.ScaleKind (bỏ)

            migrationBuilder.DropCheckConstraint(
                name: "CK_AnswerScales_ScaleKind",
                table: "AnswerScales");

            migrationBuilder.DropColumn(
                name: "ScaleKind",
                table: "AnswerScales");
        }
    }
}
