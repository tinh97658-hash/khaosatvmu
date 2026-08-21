using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Nối tài khoản đăng nhập với hồ sơ giảng viên bằng khoá ngoại thay vì so email,
    /// rồi tạo sẵn tài khoản cho những giảng viên chưa có. Chỉ ghi vào "Users";
    /// việc cấp "UserProfiles" vẫn để admin làm tay nên chạy xong không ai có thêm
    /// quyền truy cập nào.
    /// </summary>
    public partial class LinkUsersToLecturers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LecturerId",
                table: "Users",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_LecturerId",
                table: "Users",
                column: "LecturerId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Lecturers_LecturerId",
                table: "Users",
                column: "LecturerId",
                principalTable: "Lecturers",
                principalColumn: "LecturerId",
                onDelete: ReferentialAction.Restrict);

            // Bước 1: nối các tài khoản đang có với giảng viên trùng email. Đây là
            // lần duy nhất email được dùng làm khoá nối; từ đây trở đi chỉ đọc
            // "LecturerId". Chỉ nối khi tìm được đúng một giảng viên khớp, để hai
            // tài khoản không bao giờ cùng trỏ vào một người và làm vỡ UNIQUE index.
            migrationBuilder.Sql(
                """
                WITH matched AS (
                    SELECT u."Id" AS "UserId", min(l."LecturerId") AS "LecturerId"
                      FROM "Users" u
                      JOIN "Lecturers" l
                        ON NULLIF(btrim(l."Email"), '') IS NOT NULL
                       AND lower(btrim(l."Email")) = lower(btrim(u."Email"))
                       AND l."IsDeleted" = FALSE
                     WHERE u."LecturerId" IS NULL
                     GROUP BY u."Id"
                    HAVING count(*) = 1
                )
                UPDATE "Users" u
                   SET "LecturerId" = matched."LecturerId",
                       "UpdatedAt" = now()
                  FROM matched
                 WHERE u."Id" = matched."UserId";
                """);

            // Bước 2: tạo tài khoản cho giảng viên chưa có. Bỏ qua ai email rỗng vì
            // "Users"."Email" là UNIQUE, hai bản ghi rỗng sẽ đụng nhau. Bỏ qua luôn
            // email đã thuộc về một tài khoản khác, kể cả tài khoản chưa nối được ở
            // bước 1. Cố tình KHÔNG tạo "UserProfiles": chưa có profile thì đăng nhập
            // vẫn bị từ chối, nên bước này không cấp quyền cho ai.
            migrationBuilder.Sql(
                """
                INSERT INTO "Users"
                    ("Id", "GoogleSubject", "Email", "DisplayName", "AvatarUrl",
                     "IsActive", "FirstLoginAt", "LastLoginAt", "CreatedAt",
                     "UpdatedAt", "LecturerId")
                SELECT gen_random_uuid(),
                       NULL,
                       btrim(l."Email"),
                       l."FullName",
                       NULL,
                       TRUE,
                       NULL,
                       NULL,
                       now(),
                       now(),
                       l."LecturerId"
                  FROM "Lecturers" l
                 WHERE l."IsDeleted" = FALSE
                   AND NULLIF(btrim(l."Email"), '') IS NOT NULL
                   AND NOT EXISTS (
                        SELECT 1 FROM "Users" u
                         WHERE u."LecturerId" = l."LecturerId")
                   AND NOT EXISTS (
                        SELECT 1 FROM "Users" u
                         WHERE lower(btrim(u."Email")) = lower(btrim(l."Email")));
                """);

            // Giảng viên đã bị xoá mềm thì tài khoản vừa nối cũng phải khoá lại, giữ
            // đúng quy tắc "xoá giảng viên là khoá tài khoản".
            migrationBuilder.Sql(
                """
                UPDATE "Users" u
                   SET "IsActive" = FALSE,
                       "UpdatedAt" = now()
                  FROM "Lecturers" l
                 WHERE l."LecturerId" = u."LecturerId"
                   AND l."IsDeleted" = TRUE
                   AND u."IsActive" = TRUE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Chỉ xoá đúng những tài khoản do bước 2 sinh ra. Ba điều kiện cộng lại
            // mới đủ nhận diện: có gắn giảng viên, chưa từng đăng nhập, và chưa được
            // cấp profile nào. Tài khoản có thật mà admin tạo tay đều đã đăng nhập
            // hoặc đã có profile nên không dính.
            migrationBuilder.Sql(
                """
                DELETE FROM "Users" u
                 WHERE u."LecturerId" IS NOT NULL
                   AND u."GoogleSubject" IS NULL
                   AND u."FirstLoginAt" IS NULL
                   AND u."LastLoginAt" IS NULL
                   AND NOT EXISTS (
                        SELECT 1 FROM "UserProfiles" p WHERE p."UserId" = u."Id");
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Lecturers_LecturerId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_LecturerId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LecturerId",
                table: "Users");
        }
    }
}
