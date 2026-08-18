using API.Auth;
using API.Catalog;
using API.Surveys;
using Application.Catalog;
using Application.Surveys;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace UnitTests.API;

public sealed class EndpointAuthorizationTests
{
    [Theory]
    [InlineData("/api/catalog")]
    [InlineData("/api/surveys")]
    public void ManagementEndpoints_RequireSurveyManagePermission(string routePrefix)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(Mock.Of<ICatalogService>());
        builder.Services.AddSingleton(Mock.Of<ISurveyService>());
        var app = builder.Build();
        app.MapCatalogEndpoints();
        app.MapSurveyEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith(routePrefix) == true)
            .ToList();

        endpoints.Should().NotBeEmpty();
        endpoints.Should().OnlyContain(endpoint => endpoint.Metadata
            .GetOrderedMetadata<IAuthorizeData>()
            .Any(data => data.Policy == AuthPolicies.SurveyManage));
    }
}
