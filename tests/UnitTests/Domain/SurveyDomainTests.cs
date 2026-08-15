namespace UnitTests.DomainTests;

using global::Domain.Entities;
using global::Domain.Enums;
using FluentAssertions;
using Xunit;

public class SurveyDomainTests
{
    [Fact]
    public void SurveyCampaign_DefaultStatus_ShouldBeDraft()
    {
        // Arrange & Act
        var campaign = new SurveyCampaign
        {
            Title = "Khảo sát giảng dạy Học kỳ I năm học 2025-2026",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(14)
        };

        // Assert
        campaign.Status.Should().Be(CampaignStatus.Draft);
        campaign.SurveyForms.Should().BeEmpty();
    }

    [Fact]
    public void SurveyResponse_WithAnswers_ShouldBelongToForm()
    {
        // Arrange
        var formId = Guid.NewGuid();
        var response = new SurveyResponse
        {
            SurveyFormId = formId,
            RespondentId = "SV12345",
            SubmittedAt = DateTime.UtcNow
        };

        var answer = new SurveyAnswer
        {
            SurveyResponseId = response.Id,
            QuestionId = Guid.NewGuid(),
            TextAnswer = "Hài lòng với phương pháp giảng dạy"
        };

        response.Answers.Add(answer);

        // Act & Assert
        response.SurveyFormId.Should().Be(formId);
        response.RespondentId.Should().Be("SV12345");
        response.Answers.Should().HaveCount(1);
        response.Answers.First().TextAnswer.Should().Be("Hài lòng với phương pháp giảng dạy");
    }
}
