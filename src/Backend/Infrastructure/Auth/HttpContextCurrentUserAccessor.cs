using Application;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace Infrastructure.Auth;

internal sealed class HttpContextCurrentUserAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentUserAccessor
{
    public Guid? UserId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return value != null && Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public string? UserEmail =>
        httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Email)?.Value;

    public Guid? ProfileId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User?.FindFirst("active_profile_id")?.Value;
            return value != null && Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
