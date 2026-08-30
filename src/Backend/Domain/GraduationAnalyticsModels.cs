namespace Domain;

/// <summary>Một snapshot dữ liệu tốt nghiệp được import từ một file Excel.</summary>
public sealed class GraduationAnalyticsDataset
{
    public long DatasetId { get; set; }
    public string DatasetName { get; set; } = string.Empty;
    public string ReviewPeriodText { get; set; } = string.Empty;
    public int ReviewMonth { get; set; }
    public int ReviewYear { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentHash { get; set; } = string.Empty;
    public Guid ImportedByUserId { get; set; }
    public string ImportedByName { get; set; } = string.Empty;
    public DateTime ImportedAtUtc { get; set; }
    public int RowCount { get; set; }
    public DateOnly? MinimumReviewDate { get; set; }
    public DateOnly? MaximumReviewDate { get; set; }
}

/// <summary>Một dòng C-R giữ nguyên từ workbook nguồn.</summary>
public sealed class GraduationAnalyticsRow
{
    public long RowId { get; set; }
    public long DatasetId { get; set; }
    public string SourceSheetName { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public string FacultyName { get; set; } = string.Empty;
    public string? ProgramCode { get; set; }
    public string ProgramName { get; set; } = string.Empty;
    public string Cohort { get; set; } = string.Empty;
    public int? InitialEnrollmentCount { get; set; }
    public string ReviewPeriodText { get; set; } = string.Empty;
    public int? ReviewMonth { get; set; }
    public int? ReviewYear { get; set; }
    public int? EligibleGraduateCount { get; set; }
    public int? OnTimeGraduateCount { get; set; }
    public decimal? OnTimeGraduateRate { get; set; }
    public int? ExcellentCount { get; set; }
    public decimal? ExcellentRate { get; set; }
    public int? VeryGoodCount { get; set; }
    public decimal? VeryGoodRate { get; set; }
    public int? GoodCount { get; set; }
    public decimal? GoodRate { get; set; }
    public int? AverageCount { get; set; }
    public decimal? AverageRate { get; set; }
    public int? WorkStudyTransferCount { get; set; }
    public decimal? WorkStudyTransferRate { get; set; }
}
