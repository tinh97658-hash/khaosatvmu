using Application.UserAdministration;
using FluentAssertions;
using Xunit;

namespace UnitTests.UserAdministrationTests;

public sealed class ProfileNamingTests
{
    [Fact]
    public void CodeFor_PadsSequenceAndAppendsRoleSuffix()
    {
        ProfileNaming.CodeFor(7, "AD").Should().Be("000007AD");
    }
}
