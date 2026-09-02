-- Chạy read-only trên bản sao production trước migration UpgradeGraduationAnalyticsPeriods.
-- Mọi result set nên rỗng, ngoại trừ repeated analytical keys chỉ là cảnh báo đối chiếu.

BEGIN TRANSACTION READ ONLY;

-- 1. Dataset legacy chứa nhiều hơn một đợt; migration sẽ tách theo tháng/năm.
SELECT
    dataset."DatasetId",
    dataset."DatasetName",
    count(DISTINCT (row_data."ReviewYear", row_data."ReviewMonth")) AS "PeriodCount",
    string_agg(
        DISTINCT format('T%s - %s', row_data."ReviewMonth", row_data."ReviewYear"),
        ', ' ORDER BY format('T%s - %s', row_data."ReviewMonth", row_data."ReviewYear")) AS "Periods"
FROM "GraduationAnalyticsDatasets" dataset
JOIN "GraduationAnalyticsRows" row_data ON row_data."DatasetId" = dataset."DatasetId"
GROUP BY dataset."DatasetId", dataset."DatasetName"
HAVING count(DISTINCT (row_data."ReviewYear", row_data."ReviewMonth")) > 1
ORDER BY dataset."DatasetId";

-- 2. Cùng một đợt xuất hiện trong nhiều dataset; đây là lỗi chặn cần chọn bản đúng.
SELECT
    row_data."ReviewYear",
    row_data."ReviewMonth",
    string_agg(DISTINCT row_data."DatasetId"::text, ', ' ORDER BY row_data."DatasetId"::text) AS "DatasetIds"
FROM "GraduationAnalyticsRows" row_data
GROUP BY row_data."ReviewYear", row_data."ReviewMonth"
HAVING count(DISTINCT row_data."DatasetId") > 1
ORDER BY row_data."ReviewYear", row_data."ReviewMonth";

-- 3. Khóa phân tích lặp trong cùng đợt; chỉ cảnh báo, không chặn migration/import.
SELECT
    row_data."ReviewYear",
    row_data."ReviewMonth",
    row_data."FacultyName",
    row_data."ProgramCode",
    row_data."ProgramName",
    row_data."Cohort",
    count(*) AS "RowCount",
    string_agg(
        format('%s:%s', row_data."SourceSheetName", row_data."SourceRowNumber"),
        ', ' ORDER BY row_data."SourceSheetName", row_data."SourceRowNumber") AS "SourceRows"
FROM "GraduationAnalyticsRows" row_data
GROUP BY
    row_data."ReviewYear", row_data."ReviewMonth", row_data."FacultyName",
    row_data."ProgramCode", row_data."ProgramName", row_data."Cohort"
HAVING count(*) > 1
ORDER BY row_data."ReviewYear", row_data."ReviewMonth", row_data."FacultyName", row_data."Cohort";

-- 4. Row thiếu ít nhất một trong năm cột số lượng; vẫn được giữ nhưng không vào tỉ lệ tổng hợp.
SELECT
    row_data."DatasetId",
    row_data."SourceSheetName",
    row_data."SourceRowNumber",
    row_data."ReviewPeriodText",
    row_data."FacultyName",
    row_data."ProgramCode",
    row_data."Cohort"
FROM "GraduationAnalyticsRows" row_data
WHERE row_data."ExcellentCount" IS NULL
   OR row_data."VeryGoodCount" IS NULL
   OR row_data."GoodCount" IS NULL
   OR row_data."AverageCount" IS NULL
   OR row_data."WorkStudyTransferCount" IS NULL
ORDER BY row_data."DatasetId", row_data."SourceSheetName", row_data."SourceRowNumber";

ROLLBACK;
