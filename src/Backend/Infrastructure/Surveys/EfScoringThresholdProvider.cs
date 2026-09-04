using Application.Auth;
using Application.Surveys;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Surveys;

/// <summary>
/// Đọc cặp ngưỡng tính điểm từ bảng một dòng "SurveyScoringSettings". Bảng chưa
/// có dòng nào — cơ sở dữ liệu cũ chưa chạy seed — thì trả về mặc định của hệ
/// thống chứ không ném lỗi, để mọi báo cáo vẫn chạy được.
/// </summary>
public sealed class EfScoringThresholdProvider(AppDbContext db, IUserScopeResolver userScope)
    : IScoringThresholdProvider
{
    /// <summary>Bảng cấu hình chỉ có đúng một dòng, khoá cố định.</summary>
    private const int SettingId = 1;

    public async Task<ScoringThresholds> GetAsync(CancellationToken cancellationToken = default)
    {
        var setting = await db.SurveyScoringSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SurveyScoringSettingId == SettingId, cancellationToken);

        return setting is null
            ? ScoringThresholds.Default
            : new ScoringThresholds(setting.MinimumResponseRate, setting.MinimumValidRate);
    }

    public async Task<SurveyOperationResult<ScoringThresholds>> UpdateAsync(
        ScoringThresholds thresholds,
        CancellationToken cancellationToken = default)
    {
        // Đổi ngưỡng là đổi tập lớp được tính điểm của cả trường, nên chỉ quản trị.
        var scope = await userScope.ResolveAsync(cancellationToken);
        if (!scope.SeesEverything)
        {
            return new SurveyOperationResult<ScoringThresholds>(
                false, SurveyErrorCodes.OutOfScope, default);
        }

        if (!thresholds.IsValid)
        {
            return new SurveyOperationResult<ScoringThresholds>(
                false, SurveyErrorCodes.ScoringThresholdInvalid, default);
        }

        var setting = await db.SurveyScoringSettings
            .FirstOrDefaultAsync(x => x.SurveyScoringSettingId == SettingId, cancellationToken);

        if (setting is null)
        {
            setting = new SurveyScoringSetting { SurveyScoringSettingId = SettingId };
            db.SurveyScoringSettings.Add(setting);
        }

        setting.MinimumResponseRate = thresholds.MinimumResponseRate;
        setting.MinimumValidRate = thresholds.MinimumValidRate;
        setting.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new SurveyOperationResult<ScoringThresholds>(true, null, thresholds);
    }
}
