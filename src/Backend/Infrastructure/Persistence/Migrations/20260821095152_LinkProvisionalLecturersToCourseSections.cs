using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkProvisionalLecturersToCourseSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Lecturers",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            // Mỗi tên chưa xác định theo đơn vị được chuyển thành một giảng viên tạm có
            // LecturerId thật. PostgreSQL UNIQUE cho phép nhiều giá trị NULL ở cột Email.
            migrationBuilder.Sql(
                """
                INSERT INTO "Lecturers"
                    ("FullName", "DepartmentId", "FacultyId", "Email", "PhoneNumber",
                     "PositionId", "IsDeleted", "DeletedAt")
                SELECT pending."FullName",
                       pending."DepartmentId",
                       pending."FacultyId",
                       NULL,
                       NULL,
                       (SELECT "PositionId"
                          FROM "Positions"
                         WHERE lower(trim("PositionName")) = lower('Giảng viên')
                         ORDER BY "PositionId"
                         LIMIT 1),
                       FALSE,
                       NULL
                  FROM (
                        SELECT trim(cs."UnidentifiedLecturerName") AS "FullName",
                               c."DepartmentId",
                               c."FacultyId"
                          FROM "CourseSections" cs
                          JOIN "Courses" c ON c."CourseId" = cs."CourseId"
                         WHERE cs."LecturerId" IS NULL
                           AND NULLIF(trim(cs."UnidentifiedLecturerName"), '') IS NOT NULL
                         GROUP BY trim(cs."UnidentifiedLecturerName"),
                                  c."DepartmentId",
                                  c."FacultyId"
                       ) pending
                 WHERE NOT EXISTS (
                        SELECT 1
                          FROM "Lecturers" l
                         WHERE l."Email" IS NULL
                           AND lower(trim(l."FullName")) = lower(pending."FullName")
                           AND l."DepartmentId" IS NOT DISTINCT FROM pending."DepartmentId"
                           AND l."FacultyId" IS NOT DISTINCT FROM pending."FacultyId"
                       );

                WITH matched AS (
                    SELECT cs."CourseSectionId", min(l."LecturerId") AS "LecturerId"
                      FROM "CourseSections" cs
                      JOIN "Courses" c ON c."CourseId" = cs."CourseId"
                      JOIN "Lecturers" l
                        ON l."Email" IS NULL
                       AND lower(trim(l."FullName")) = lower(trim(cs."UnidentifiedLecturerName"))
                       AND l."DepartmentId" IS NOT DISTINCT FROM c."DepartmentId"
                       AND l."FacultyId" IS NOT DISTINCT FROM c."FacultyId"
                     WHERE cs."LecturerId" IS NULL
                       AND NULLIF(trim(cs."UnidentifiedLecturerName"), '') IS NOT NULL
                     GROUP BY cs."CourseSectionId"
                )
                UPDATE "CourseSections" cs
                   SET "LecturerId" = matched."LecturerId",
                       "UnidentifiedLecturerName" = NULL
                  FROM matched
                 WHERE cs."CourseSectionId" = matched."CourseSectionId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Khôi phục biểu diễn cũ trước khi đưa Email về NOT NULL.
            migrationBuilder.Sql(
                """
                UPDATE "CourseSections" cs
                   SET "UnidentifiedLecturerName" = l."FullName",
                       "LecturerId" = NULL
                  FROM "Lecturers" l
                 WHERE cs."LecturerId" = l."LecturerId"
                   AND l."Email" IS NULL;

                DELETE FROM "Lecturers" WHERE "Email" IS NULL;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Lecturers",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
