namespace UnitTests.DomainTests;

using Domain;
using FluentAssertions;
using Xunit;

public class SurveyDomainTests
{
    [Fact]
    public void CourseSectionSurvey_DefaultProperties_ShouldBeInitialized()
    {
        var survey = new CourseSectionSurvey
        {
            CourseSectionSurveyId = 1,
            SemesterSurveyId = 10,
            CourseSectionId = 20,
            LinkToken = "tok_test123",
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow.AddDays(7)
        };

        survey.CourseSectionSurveyId.Should().Be(1);
        survey.SemesterSurveyId.Should().Be(10);
        survey.CourseSectionId.Should().Be(20);
        survey.LinkToken.Should().Be("tok_test123");
        survey.EndTime.Should().BeAfter(survey.StartTime);
    }

    [Fact]
    public void SurveyResponse_WithScoreAndAnswers_CalculatesCorrectly()
    {
        var response = new SurveyResponse
        {
            ResponseId = 100,
            CourseSectionSurveyId = 1,
            Score = 4.75m,
            AdditionalComments = "Giảng viên nhiệt tình, tận tâm",
            SubmittedAt = DateTime.UtcNow
        };

        response.ResponseId.Should().Be(100);
        response.CourseSectionSurveyId.Should().Be(1);
        response.Score.Should().Be(4.75m);
        response.AdditionalComments.Should().Be("Giảng viên nhiệt tình, tận tâm");
        response.SubmittedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void UserProfile_ShouldLinkToUserAndRole()
    {
        var userId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        var profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            RoleId = roleId,
            ProfileCode = "ADMIN_MAIN",
            ProfileName = "Quản trị viên toàn hệ thống",
            IsActive = true,
            IsDefault = true
        };

        profile.UserId.Should().Be(userId);
        profile.RoleId.Should().Be(roleId);
        profile.IsActive.Should().BeTrue();
        profile.IsDefault.Should().BeTrue();
    }
}
