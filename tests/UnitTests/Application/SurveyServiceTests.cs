namespace UnitTests.ApplicationTests;

using Application.Surveys;
using Domain;
using FluentAssertions;
using Xunit;

public class SurveyServiceTests
{
    private static SaveSurveyQuestionCommand Question(string text, int answerScaleId = 1) =>
        new(text, answerScaleId);

    [Fact]
    public void SurveyRules_MaximumQuestionsPerTemplate_ShouldBeThirty()
    {
        SurveyRules.MaximumQuestionsPerTemplate.Should().Be(30);
    }

    [Fact]
    public void SaveSurveyTemplateCommand_WithValidQuestions_ShouldPassCountCheck()
    {
        var questions = Enumerable.Range(1, 15)
            .Select(i => Question($"Tiêu chí đánh giá số {i}"))
            .ToList();
        var command = new SaveSurveyTemplateCommand("Phiếu khảo sát chuẩn VMU", questions);

        command.Questions.Should().HaveCount(15);
        command.Questions.Count.Should().BeLessThanOrEqualTo(SurveyRules.MaximumQuestionsPerTemplate);
    }

    [Fact]
    public void SaveSurveyTemplateCommand_WithMoreThan30Questions_ShouldExceedLimit()
    {
        var questions = Enumerable.Range(1, 35).Select(i => Question($"Câu hỏi số {i}")).ToList();
        var command = new SaveSurveyTemplateCommand("Bộ câu hỏi kiểm thử", questions);

        var isValid = command.Questions.Count <= SurveyRules.MaximumQuestionsPerTemplate;
        isValid.Should().BeFalse();
    }

    [Fact]
    public void SaveSurveyTemplateCommand_MixesAnswerScalesPerQuestion()
    {
        var command = new SaveSurveyTemplateCommand("Phiếu trộn thang", [
            Question("Giảng viên trình bày rõ ràng, dễ hiểu.", 1),
            Question("Bạn có biết về chuẩn đầu ra học phần không?", 2),
            Question("Ý kiến của bạn về học phần?", 4),
        ]);

        command.Questions.Select(x => x.AnswerScaleId).Should().Equal(1, 2, 4);
    }

    [Fact]
    public void SubmitSurveyResponseCommand_AverageScoreSkipsTextAnswers()
    {
        // Câu 4 thuộc thang 'Điền từ' nên không có giá trị số và không vào điểm.
        var answers = new List<SubmitSurveyAnswerCommand>
        {
            new(1, "5"),
            new(2, "4"),
            new(3, "5"),
            new(4, "Học phần rất bổ ích"),
        };
        var command = new SubmitSurveyResponseCommand(answers, "Bài giảng rất hay");

        var scored = command.Answers
            .Select(a => int.TryParse(a.AnswerValue, out var value) ? value : (int?)null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToList();

        scored.Should().HaveCount(3);
        ((decimal)scored.Average()).Should().BeApproximately(4.67m, 0.01m);
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
        var scale = new SaveAnswerScaleCommand("Thang đo Likert 5 mức", AnswerScaleKinds.Options, options);

        scale.Options.Should().HaveCount(5);
        scale.Options.Select(o => o.Value).Should().BeEquivalentTo([1, 2, 3, 4, 5]);
    }

    [Fact]
    public void SaveAnswerScaleCommand_YesNoUsesValuesOneAndFive()
    {
        // Có/Không dùng 1 và 5 để cùng dải điểm với thang mức độ hài lòng.
        var scale = new SaveAnswerScaleCommand("Có không", AnswerScaleKinds.Options, [
            new(1, "Không"),
            new(5, "Có"),
        ]);

        scale.Options.Select(o => o.Value).Should().Equal(1, 5);
    }

    [Fact]
    public void SaveAnswerScaleCommand_TextScaleHasNoOptions()
    {
        var scale = new SaveAnswerScaleCommand("Điền từ", AnswerScaleKinds.Text, []);

        scale.ScaleKind.Should().Be(AnswerScaleKinds.Text);
        scale.Options.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Options", true)]
    [InlineData("Text", true)]
    [InlineData("options", false)]
    [InlineData("", false)]
    public void AnswerScaleKinds_IsValid_AcceptsOnlyKnownKinds(string kind, bool expected)
    {
        AnswerScaleKinds.IsValid(kind).Should().Be(expected);
    }
}
