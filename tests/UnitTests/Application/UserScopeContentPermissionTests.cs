namespace UnitTests.ApplicationTests;

using Application.Auth;
using FluentAssertions;
using Xunit;

public class UserScopeContentPermissionTests
{
    private static readonly UserScope DepartmentManager =
        new(RoleCodes.DepartmentManager, 10, 20, 30, SeesEverything: false);

    private static readonly UserScope Lecturer =
        new(RoleCodes.Lecturer, 10, 20, 30, SeesEverything: false);

    [Fact]
    public void DepartmentManager_ShouldOnlyKeepExplicitContentActions()
    {
        DepartmentManager.CanManageSurveyCampaigns.Should().BeFalse();
        DepartmentManager.CanAddSurveyScope.Should().BeTrue();
        DepartmentManager.CanManageCourseSections.Should().BeFalse();
        DepartmentManager.CanResolveCourseSectionLecturer.Should().BeTrue();
    }

    [Fact]
    public void Lecturer_ShouldNotHaveAnyContentWriteAction()
    {
        Lecturer.CanManageSurveyCampaigns.Should().BeFalse();
        Lecturer.CanAddSurveyScope.Should().BeFalse();
        Lecturer.CanManageCourseSections.Should().BeFalse();
        Lecturer.CanResolveCourseSectionLecturer.Should().BeFalse();
    }

    [Theory]
    [InlineData(RoleCodes.Admin)]
    [InlineData(RoleCodes.SurveyAdmin)]
    public void UnrestrictedRoles_ShouldKeepAllContentActions(string roleCode)
    {
        var scope = UserScope.Unrestricted(roleCode);

        scope.CanManageSurveyCampaigns.Should().BeTrue();
        scope.CanAddSurveyScope.Should().BeTrue();
        scope.CanManageCourseSections.Should().BeTrue();
        scope.CanResolveCourseSectionLecturer.Should().BeTrue();
    }

    [Fact]
    public void DepartmentManagerWithoutDepartment_ShouldNotGainWriteExceptions()
    {
        var scope = DepartmentManager with { DepartmentId = null };

        scope.CanAddSurveyScope.Should().BeFalse();
        scope.CanResolveCourseSectionLecturer.Should().BeFalse();
    }
}
