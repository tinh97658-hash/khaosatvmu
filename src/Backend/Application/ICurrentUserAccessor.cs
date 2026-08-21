namespace Application;

public interface ICurrentUserAccessor
{
    Guid? UserId { get; }
    string? UserEmail { get; }

    /// <summary>
    /// Profile đang hoạt động của phiên này. Cần vì vai trò gắn với profile chứ không
    /// gắn với user: một người có thể vừa là giảng viên vừa là trưởng bộ môn, đổi
    /// profile là đổi cả quyền lẫn phạm vi dữ liệu.
    /// </summary>
    Guid? ProfileId { get; }
}
