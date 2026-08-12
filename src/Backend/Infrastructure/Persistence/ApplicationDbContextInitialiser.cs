namespace Infrastructure.Persistence;

using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

public class ApplicationDbContextInitialiser
{
    private readonly ILogger<ApplicationDbContextInitialiser> _logger;
    private readonly ApplicationDbContext _context;

    public ApplicationDbContextInitialiser(ILogger<ApplicationDbContextInitialiser> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    public async Task InitialiseAsync()
    {
        try
        {
            if (_context.Database.IsNpgsql())
            {
                await _context.Database.MigrateAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while initialising the database.");
            throw;
        }
    }

    public async Task SeedAsync()
    {
        try
        {
            await TrySeedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while seeding the database.");
            throw;
        }
    }

    private async Task TrySeedAsync()
    {
        if (await _context.AcademicYears.AnyAsync())
        {
            return;
        }

        _logger.LogInformation("Seeding VMU survey domain data...");

        var academicYear = new AcademicYear
        {
            YearName = "2024-2025",
            StartDate = new DateTime(2024, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2025, 6, 30, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true
        };

        var semester1 = new Semester
        {
            SemesterName = "Học kỳ 1",
            AcademicYear = academicYear
        };

        var semester2 = new Semester
        {
            SemesterName = "Học kỳ 2",
            AcademicYear = academicYear
        };

        academicYear.Semesters.Add(semester1);
        academicYear.Semesters.Add(semester2);

        var campaign = new SurveyCampaign
        {
            Title = "Khảo sát chất lượng giảng dạy HK1 (2024-2025)",
            Description = "Khảo sát lấy ý kiến phản hồi của sinh viên về công tác giảng dạy của giảng viên thuộc Trường Đại học Hàng hải Việt Nam",
            Status = CampaignStatus.Active,
            StartDate = DateTime.UtcNow.AddDays(-7),
            EndDate = DateTime.UtcNow.AddDays(30),
            Semester = semester1
        };

        var form = new SurveyForm
        {
            Title = "Phiếu đánh giá ý kiến sinh viên về học phần",
            TargetAudience = "Sinh viên chính quy",
            SurveyCampaign = campaign
        };

        var q1 = new Question
        {
            Content = "Thầy/Cô cung cấp đầy đủ đề cương chi tiết học phần và phổ biến phương pháp đánh giá môn học?",
            QuestionType = QuestionType.SingleChoice,
            Order = 1,
            SurveyForm = form,
            Options = new List<Option>
            {
                new Option { Content = "Rất hài lòng", Order = 1 },
                new Option { Content = "Hài lòng", Order = 2 },
                new Option { Content = "Bình thường", Order = 3 },
                new Option { Content = "Không hài lòng", Order = 4 }
            }
        };

        var q2 = new Question
        {
            Content = "Đóng góp ý kiến bổ sung để nâng cao chất lượng giảng dạy học phần:",
            QuestionType = QuestionType.Text,
            Order = 2,
            SurveyForm = form
        };

        form.Questions.Add(q1);
        form.Questions.Add(q2);
        campaign.SurveyForms.Add(form);
        semester1.SurveyCampaigns.Add(campaign);

        _context.AcademicYears.Add(academicYear);
        await _context.SaveChangesAsync();

        _logger.LogInformation("VMU Survey domain data seeded successfully.");
    }
}
