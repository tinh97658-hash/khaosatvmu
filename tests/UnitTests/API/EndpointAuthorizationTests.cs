using API.Auth;
using API.Catalog;
using API.Reports;
using API.Surveys;
using API.UserAdministration;
using Application.Catalog;
using Application.Reports;
using Application.Surveys;
using Application.UserAdministration;
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
    [InlineData("/api/admin", AuthPolicies.UserAdminAccess)]
    [InlineData("/api/v1/reports", AuthPolicies.ReportsAccess)]
    public void ModuleEndpoints_RequireTheirModulePermission(string routePrefix, string expectedPolicy)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(Mock.Of<IUserAdministrationService>());
        builder.Services.AddSingleton(Mock.Of<IReportService>());
        var app = builder.Build();
        app.MapUserAdministrationEndpoints();
        app.MapReportEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith(routePrefix) == true)
            .ToList();

        endpoints.Should().NotBeEmpty();
        endpoints.Should().OnlyContain(endpoint => endpoint.Metadata
            .GetOrderedMetadata<IAuthorizeData>()
            .Any(data => data.Policy == expectedPolicy));
    }

    [Fact]
    public void CatalogEndpoints_RequireCatalogAccessPermission()
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
            .Where(endpoint => endpoint.RoutePattern.RawText?.StartsWith("/api/catalog") == true)
            .ToList();

        endpoints.Should().NotBeEmpty();
        endpoints.Should().OnlyContain(endpoint => endpoint.Metadata
            .GetOrderedMetadata<IAuthorizeData>()
            .Any(data => data.Policy == AuthPolicies.CatalogAccess));
    }

    [Theory]
    [InlineData("/api/surveys/answer-scales", "GET", AuthPolicies.CourseQuestionSetsAccess)]
    [InlineData("/api/surveys/templates", "POST", AuthPolicies.CourseQuestionSetsAccess)]
    [InlineData("/api/surveys/semester-surveys", "GET", AuthPolicies.SurveyOperationalRead)]
    [InlineData("/api/surveys/semester-surveys", "POST", AuthPolicies.CourseCampaignsAccess)]
    [InlineData("/api/surveys/semester-surveys/{semesterSurveyId:int}/sections", "GET", AuthPolicies.SurveyOperationalRead)]
    public void SurveyEndpoints_RequireTheirModulePermission(
        string route,
        string method,
        string expectedPolicy)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(Mock.Of<ISurveyService>());
        var app = builder.Build();
        app.MapSurveyEndpoints();

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(candidate => candidate.RoutePattern.RawText == route
                && candidate.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains(method) == true);

        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(data => data.Policy == expectedPolicy);
    }
}
