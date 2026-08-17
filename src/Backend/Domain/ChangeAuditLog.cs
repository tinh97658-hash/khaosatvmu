namespace Domain;

/// <summary>Ghi lại mọi thao tác CREATE/UPDATE/DELETE/RESTORE trên các entity quan trọng.</summary>
public sealed class ChangeAuditLog
{
    public Guid Id { get; set; }

    /// <summary>Tên entity, vd "Faculty", "Course", "SurveyTemplate".</summary>
    public string TableName { get; set; } = string.Empty;

    /// <summary>Giá trị khóa chính dạng string.</summary>
    public string RecordId { get; set; } = string.Empty;

    /// <summary>CREATE | UPDATE | DELETE | RESTORE</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>FK → Users.Id, SET NULL khi user bị xóa.</summary>
    public Guid? ChangedBy { get; set; }

    /// <summary>Denormalized để hiển thị khi user đã bị xóa.</summary>
    public string? ChangedByEmail { get; set; }

    /// <summary>JSON snapshot trạng thái trước khi thay đổi (null với CREATE).</summary>
    public string? OldValues { get; set; }

    /// <summary>JSON snapshot trạng thái sau khi thay đổi (null với DELETE).</summary>
    public string? NewValues { get; set; }

    public DateTime ChangedAt { get; set; }
}
