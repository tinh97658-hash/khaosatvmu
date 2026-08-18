namespace UnitTests.ApplicationTests;

using Application.Catalog;
using FluentAssertions;
using Xunit;

public class CatalogValidationTests
{
    [Fact]
    public void SaveFacultyCommand_WithValidName_ShouldRetainName()
    {
        var command = new SaveFacultyCommand("Khoa Công nghệ thông tin");
        command.FacultyName.Should().Be("Khoa Công nghệ thông tin");
    }

    [Fact]
    public void SaveDepartmentCommand_WithFacultyId_ShouldLinkCorrectly()
    {
        var command = new SaveDepartmentCommand("Bộ môn Hệ thống thông tin", 5);
        command.DepartmentName.Should().Be("Bộ môn Hệ thống thông tin");
        command.FacultyId.Should().Be(5);
    }

    [Fact]
    public void SaveCourseCommand_CreditsValidation_ShouldRetainValidValues()
    {
        var command = new SaveCourseCommand("19783", "Kỹ thuật lập trình", 3, "Required", 1, 1, null);
        command.CourseCode.Should().Be("19783");
        command.Credits.Should().Be(3);
        command.CourseType.Should().Be("Required");
    }

    [Fact]
    public void SaveLecturerCommand_WithValidEmail_ShouldHoldProperties()
    {
        var command = new SaveLecturerCommand(
            "TS. Lê Hoàng C",
            1,
            1,
            "lehoangc@vimaru.edu.vn",
            "0901234567"
        );
        command.FullName.Should().Be("TS. Lê Hoàng C");
        command.Email.Should().Be("lehoangc@vimaru.edu.vn");
        command.PhoneNumber.Should().Be("0901234567");
        command.FacultyId.Should().Be(1);
        command.DepartmentId.Should().Be(1);
    }

    [Fact]
    public void SaveAcademicYearCommand_DatesComparison_ShouldBeChronological()
    {
        var start = new DateOnly(2025, 9, 1);
        var end = new DateOnly(2026, 6, 30);
        var command = new SaveAcademicYearCommand("2025-2026", start, end);

        command.EndDate.Should().BeAfter(command.StartDate);
        command.AcademicYearName.Should().Be("2025-2026");
    }
}
