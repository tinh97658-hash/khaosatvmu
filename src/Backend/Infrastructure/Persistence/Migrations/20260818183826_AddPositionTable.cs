using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Positions",
                columns: table => new
                {
                    PositionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PositionName = table.Column<string>(type: "text", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Positions", x => x.PositionId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_PositionName",
                table: "Positions",
                column: "PositionName",
                unique: true);

            // Danh sách chức vụ khởi tạo. Dùng InsertData để chạy lại được trên mọi môi trường.
            migrationBuilder.InsertData(
                table: "Positions",
                columns: new[] { "PositionId", "PositionName", "IsDeleted", "DeletedAt" },
                values: new object[,]
                {
                    { 1, "Giảng viên", false, null },
                    { 2, "Giảng viên chính", false, null },
                    { 3, "Giảng viên cao cấp", false, null },
                    { 4, "Trợ giảng", false, null },
                    { 5, "Trưởng khoa", false, null },
                    { 6, "Phó Trưởng khoa", false, null },
                    { 7, "Trưởng Bộ môn", false, null },
                    { 8, "Phó Trưởng Bộ môn", false, null }
                });

            // PositionId là identity BY DEFAULT nên phải đẩy sequence qua các id vừa chèn tay.
            migrationBuilder.Sql(
                "SELECT setval(pg_get_serial_sequence('\"Positions\"', 'PositionId'), 8, true);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Positions");
        }
    }
}
