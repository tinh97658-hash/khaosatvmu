using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSurveyScoringSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SurveyScoringSettings",
                columns: table => new
                {
                    SurveyScoringSettingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MinimumResponseRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    MinimumValidRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SurveyScoringSettings", x => x.SurveyScoringSettingId);
                });

            // Bảng chỉ có đúng một dòng (Id = 1). Seed sẵn cặp mặc định 50% / 80%
            // để hệ thống có ngưỡng dùng ngay, không phải chờ ai vào bấm lưu.
            migrationBuilder.Sql("""
                INSERT INTO "SurveyScoringSettings"
                    ("SurveyScoringSettingId", "MinimumResponseRate", "MinimumValidRate", "UpdatedAt")
                VALUES (1, 50, 80, now() AT TIME ZONE 'utc')
                ON CONFLICT ("SurveyScoringSettingId") DO NOTHING
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SurveyScoringSettings");
        }
    }
}
