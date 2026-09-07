using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileCodeSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "UserProfileCodeSequence");

            // Giữ liên tục với các mã số đã tồn tại khi nâng cấp database đang chạy.
            // Tham số false khiến nextval() đầu tiên trả đúng giá trị max + 1.
            migrationBuilder.Sql(
                """
                SELECT setval(
                    '"UserProfileCodeSequence"',
                    COALESCE((
                        SELECT MAX(substring("ProfileCode" FROM '^([0-9]+)')::bigint)
                        FROM "UserProfiles"
                        WHERE "ProfileCode" ~ '^[0-9]+'
                    ), 0) + 1,
                    false
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropSequence(
                name: "UserProfileCodeSequence");
        }
    }
}
