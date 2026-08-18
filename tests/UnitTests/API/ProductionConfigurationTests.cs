using API.Auth;
using FluentAssertions;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using Xunit;

namespace UnitTests.API;

public sealed class ProductionConfigurationTests
{
    [Fact]
    public void ProductionAuthentication_RejectsMissingGoogleCredentials()
    {
        var act = () => new ServiceCollection().AddApplicationAuthentication(
            Configuration(("Authentication:FrontendBaseUrl", "https://survey.example.edu")),
            Environment(Environments.Production));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*ClientId and ClientSecret*");
    }

    [Fact]
    public void ProductionAuthentication_RejectsRemoteHttpFrontend()
    {
        var act = () => new ServiceCollection().AddApplicationAuthentication(
            Configuration(
                ("Authentication:FrontendBaseUrl", "http://survey.example.edu"),
                ("Authentication:Google:ClientId", "client"),
                ("Authentication:Google:ClientSecret", "secret")),
            Environment(Environments.Production));

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*absolute HTTPS URL*");
    }

    [Fact]
    public void Persistence_RejectsMissingConnectionString()
    {
        var act = () => new ServiceCollection().AddPersistence(Configuration());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("ConnectionStrings:DefaultConnection is required.");
    }

    private static IConfiguration Configuration(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(x => x.Key, x => (string?)x.Value))
            .Build();

    private static IWebHostEnvironment Environment(string name)
    {
        var environment = new Mock<IWebHostEnvironment>();
        environment.SetupGet(x => x.EnvironmentName).Returns(name);
        return environment.Object;
    }
}
