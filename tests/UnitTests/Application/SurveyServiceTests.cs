namespace UnitTests.ApplicationTests;

using global::Application.Surveys;
using FluentAssertions;
using Xunit;

public class SurveyServiceTests
{
    [Fact]
    public void SurveyRules_MaximumQuestionsPerTemplate_ShouldBeThirty()
    {
        // Act & Assert
        SurveyRules.MaximumQuestionsPerTemplate.Should().Be(30);
    }

    [Fact]
    public void SaveSurveyTemplateCommand_WithMoreThan30Questions_ShouldBeInvalid()
    {
        // Arrange
        var questions = Enumerable.Range(1, 31).Select(i => $"Câu hỏi số {i}").ToList();
        var command = new SaveSurveyTemplateCommand("Bộ câu hỏi kiểm thử", 1, questions);

        // Act
        var isValid = command.Questions.Count <= SurveyRules.MaximumQuestionsPerTemplate;

        // Assert
        isValid.Should().BeFalse();
    }
}
