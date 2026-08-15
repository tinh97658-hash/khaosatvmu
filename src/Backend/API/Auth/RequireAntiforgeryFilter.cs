using Microsoft.AspNetCore.Antiforgery;

namespace API.Auth;

public sealed class RequireAntiforgeryFilter(IAntiforgery antiforgery) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return Results.Json(
                new { errorCode = "AUTH_CSRF_INVALID" },
                statusCode: StatusCodes.Status400BadRequest);
        }

        return await next(context);
    }
}
