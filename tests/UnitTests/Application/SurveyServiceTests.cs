namespace UnitTests.ApplicationTests;

using Application.Surveys;
using FluentAssertions;
using Xunit;

public class SurveyServiceTests
{
    [Fact]
    public void SurveyRules_MaximumQuestionsPerTemplate_ShouldBeThirty()
    {
        SurveyRules.MaximumQuestionsPerTemplate.Should().Be(30);
    }

    [Fact]
    public void SaveSurveyTemplateCommand_WithValidQuestions_ShouldPassCountCheck()
    {
        var questions = Enumerable.Range(1, 15).Select(i => $"Tiêu chí đánh giá số {i}").ToList();
        var command = new SaveSurveyTemplateCommand("Phiếu khảo sát chuẩn VMU", 1, questions);

        command.Questions.Should().HaveCount(15);
        command.Questions.Count.Should().BeLessThanOrEqualTo(SurveyRules.MaximumQuestionsPerTemplate);
    }

    [Fact]
    public void SaveSurveyTemplateCommand_WithMoreThan30Questions_ShouldExceedLimit()
    {
        var questions = Enumerable.Range(1, 35).Select(i => $"Câu hỏi số {i}").ToList();
        var command = new SaveSurveyTemplateCommand("Bộ câu hỏi kiểm thử", 1, questions);

        var isValid = command.Questions.Count <= SurveyRules.MaximumQuestionsPerTemplate;
        isValid.Should().BeFalse();
    }

    [Fact]
    public void SubmitSurveyResponseCommand_AverageScoreCalculation_IsAccurate()
    {
        var answers = new List<SubmitSurveyAnswerCommand>
        {
            new(1, 5),
            new(2, 4),
            new(3, 5),
            new(4, 4),
        };
        var command = new SubmitSurveyResponseCommand(answers, "Bài giảng rất hay");

        var averageScore = (decimal)command.Answers.Average(a => a.SelectedValue);
        averageScore.Should().Be(4.5m);
    }

    [Fact]
    public void SaveAnswerScaleCommand_WithFiveOptions_ShouldHaveCorrectScaleValues()
    {
        var options = new List<SaveAnswerScaleOptionCommand>
        {
            new(1, "Rất không hài lòng"),
            new(2, "Không hài lòng"),
            new(3, "Bình thường"),
            new(4, "Hài lòng"),
            new(5, "Rất hài lòng")
        };
        var scale = new SaveAnswerScaleCommand("Thang đo Likert 5 mức", options);

        scale.Options.Should().HaveCount(5);
        scale.Options.Select(o => o.Value).Should().BeEquivalentTo([1, 2, 3, 4, 5]);
    }
}
