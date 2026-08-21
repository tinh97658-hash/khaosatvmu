using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260820223000_SplitCatalogAccessPermission")]
public partial class SplitCatalogAccessPermission : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO "Permissions" ("Id", "Code", "Name", "Description", "Category")
            VALUES
                ('d2100101-0000-4000-8000-000000000001', 'FACULTIES_ACCESS', 'Khoa / Viện', 'Truy cập module quản lý khoa và viện', 'Danh mục đào tạo'),
                ('d2100101-0000-4000-8000-000000000002', 'DEPARTMENTS_ACCESS', 'Bộ môn', 'Truy cập module quản lý bộ môn', 'Danh mục đào tạo'),
                ('d2100101-0000-4000-8000-000000000003', 'LECTURERS_ACCESS', 'Giảng viên', 'Truy cập module quản lý giảng viên và chức vụ', 'Danh mục đào tạo'),
                ('d2100101-0000-4000-8000-000000000004', 'MAJORS_ACCESS', 'Ngành đào tạo', 'Truy cập module quản lý ngành đào tạo', 'Danh mục đào tạo'),
                ('d2100101-0000-4000-8000-000000000005', 'COURSES_ACCESS', 'Học phần', 'Truy cập module quản lý học phần', 'Danh mục đào tạo'),
                ('d2100101-0000-4000-8000-000000000006', 'COURSE_SECTIONS_ACCESS', 'Lớp học phần', 'Truy cập module quản lý lớp học phần, năm học và học kỳ', 'Danh mục đào tạo')
            ON CONFLICT ("Code") DO UPDATE SET
                "Name" = EXCLUDED."Name",
                "Description" = EXCLUDED."Description",
                "Category" = EXCLUDED."Category";

            INSERT INTO "RolePermissions" ("Id", "RoleId", "PermissionId", "IsGranted", "CreatedAt")
            SELECT gen_random_uuid(), legacy."RoleId", replacement."Id", TRUE, CURRENT_TIMESTAMP
            FROM "RolePermissions" AS legacy
            JOIN "Permissions" AS old_permission
                ON old_permission."Id" = legacy."PermissionId"
               AND old_permission."Code" = 'CATALOG_ACCESS'
            CROSS JOIN "Permissions" AS replacement
            WHERE legacy."IsGranted" = TRUE
              AND replacement."Code" IN (
                  'FACULTIES_ACCESS',
                  'DEPARTMENTS_ACCESS',
                  'LECTURERS_ACCESS',
                  'MAJORS_ACCESS',
                  'COURSES_ACCESS',
                  'COURSE_SECTIONS_ACCESS')
              AND NOT EXISTS (
                  SELECT 1
                  FROM "RolePermissions" AS existing
                  WHERE existing."RoleId" = legacy."RoleId"
                    AND existing."PermissionId" = replacement."Id");

            DELETE FROM "RolePermissions"
            WHERE "PermissionId" IN (
                SELECT "Id" FROM "Permissions" WHERE "Code" = 'CATALOG_ACCESS');

            DELETE FROM "Permissions" WHERE "Code" = 'CATALOG_ACCESS';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO "Permissions" ("Id", "Code", "Name", "Description", "Category")
            VALUES (
                'd2100101-0000-4000-8000-000000000000',
                'CATALOG_ACCESS',
                'Danh mục đào tạo',
                'Truy cập module danh mục đào tạo',
                'Danh mục đào tạo')
            ON CONFLICT ("Code") DO NOTHING;

            INSERT INTO "RolePermissions" ("Id", "RoleId", "PermissionId", "IsGranted", "CreatedAt")
            SELECT gen_random_uuid(), child_grant."RoleId", legacy."Id", TRUE, CURRENT_TIMESTAMP
            FROM "Permissions" AS legacy
            CROSS JOIN (
                SELECT DISTINCT rp."RoleId"
                FROM "RolePermissions" AS rp
                JOIN "Permissions" AS permission ON permission."Id" = rp."PermissionId"
                WHERE rp."IsGranted" = TRUE
                  AND permission."Code" IN (
                      'FACULTIES_ACCESS',
                      'DEPARTMENTS_ACCESS',
                      'LECTURERS_ACCESS',
                      'MAJORS_ACCESS',
                      'COURSES_ACCESS',
                      'COURSE_SECTIONS_ACCESS')
            ) AS child_grant
            WHERE legacy."Code" = 'CATALOG_ACCESS'
              AND NOT EXISTS (
                  SELECT 1 FROM "RolePermissions" AS existing
                  WHERE existing."RoleId" = child_grant."RoleId"
                    AND existing."PermissionId" = legacy."Id");

            DELETE FROM "RolePermissions"
            WHERE "PermissionId" IN (
                SELECT "Id" FROM "Permissions"
                WHERE "Code" IN (
                    'FACULTIES_ACCESS',
                    'DEPARTMENTS_ACCESS',
                    'LECTURERS_ACCESS',
                    'MAJORS_ACCESS',
                    'COURSES_ACCESS',
                    'COURSE_SECTIONS_ACCESS'));

            DELETE FROM "Permissions"
            WHERE "Code" IN (
                'FACULTIES_ACCESS',
                'DEPARTMENTS_ACCESS',
                'LECTURERS_ACCESS',
                'MAJORS_ACCESS',
                'COURSES_ACCESS',
                'COURSE_SECTIONS_ACCESS');
            """);
    }
}
