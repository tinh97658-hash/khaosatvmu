using Domain;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuthAuditLog> AuthAuditLogs => Set<AuthAuditLog>();
    public DbSet<AuthSession> AuthSessions => Set<AuthSession>();
    public DbSet<Faculty> Faculties => Set<Faculty>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Major> Majors => Set<Major>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Lecturer> Lecturers => Set<Lecturer>();
    public DbSet<AcademicYear> AcademicYears => Set<AcademicYear>();
    public DbSet<Semester> Semesters => Set<Semester>();
    public DbSet<CourseSection> CourseSections => Set<CourseSection>();
    public DbSet<AnswerScale> AnswerScales => Set<AnswerScale>();
    public DbSet<AnswerScaleOption> AnswerScaleOptions => Set<AnswerScaleOption>();
    public DbSet<SurveyTemplate> SurveyTemplates => Set<SurveyTemplate>();
    public DbSet<SurveyQuestion> SurveyQuestions => Set<SurveyQuestion>();
    public DbSet<SemesterSurvey> SemesterSurveys => Set<SemesterSurvey>();
    public DbSet<CourseSectionSurvey> CourseSectionSurveys => Set<CourseSectionSurvey>();
    public DbSet<SurveyResponse> SurveyResponses => Set<SurveyResponse>();
    public DbSet<SurveyResponseAnswer> SurveyResponseAnswers => Set<SurveyResponseAnswer>();
    public DbSet<ChangeAuditLog> ChangeAuditLogs => Set<ChangeAuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Global soft-delete filters — excluded from queries unless .IgnoreQueryFilters() is used
        modelBuilder.Entity<Role>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Faculty>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Department>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Major>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<AcademicYear>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Semester>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CourseSection>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Lecturer>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<Course>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<AnswerScale>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<SurveyTemplate>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<SemesterSurvey>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<CourseSectionSurvey>().HasQueryFilter(e => !e.IsDeleted);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(320).IsRequired();
            entity.Property(x => x.GoogleSubject).HasMaxLength(255);
            entity.Property(x => x.DisplayName).HasMaxLength(200);
            entity.Property(x => x.AvatarUrl).HasMaxLength(2048);
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.GoogleSubject).IsUnique();
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.ToTable("UserProfiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProfileName).HasMaxLength(200).IsRequired();
            entity.Property(x => x.ProfileCode).HasMaxLength(100).IsRequired();
            entity.Property(x => x.OrganizationUnitCode).HasMaxLength(100);
            entity.Property(x => x.OrganizationUnitName).HasMaxLength(200);
            entity.HasIndex(x => x.ProfileCode).IsUnique();
            entity.HasIndex(x => new { x.UserId, x.IsActive });
            entity.HasIndex(x => x.UserId)
                .HasDatabaseName("UX_UserProfiles_UserId_ActiveDefault")
                .IsUnique()
                .HasFilter("\"IsActive\" = TRUE AND \"IsDefault\" = TRUE");
            entity.HasIndex(x => new { x.UserId, x.RoleId, x.OrganizationUnitCode }).IsUnique();
            entity.HasOne<User>().WithMany(x => x.Profiles).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("Permissions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.Category).HasMaxLength(100).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("RolePermissions");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => new { x.RoleId, x.PermissionId }).IsUnique();
            entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Permission>().WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuthAuditLog>(entity =>
        {
            entity.ToTable("AuthAuditLogs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Event).HasMaxLength(100).IsRequired();
            entity.Property(x => x.IpAddress).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.HasIndex(x => new { x.UserId, x.CreatedAt });
            entity.HasIndex(x => new { x.Event, x.CreatedAt });
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AuthSession>(entity =>
        {
            entity.ToTable("AuthSessions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RevokedReason).HasMaxLength(200);
            entity.HasIndex(x => new { x.UserId, x.RevokedAt, x.ExpiresAt });
            entity.HasIndex(x => new { x.ActiveProfileId, x.RevokedAt });
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<UserProfile>().WithMany().HasForeignKey(x => x.ActiveProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        // Danh mục đào tạo. Tên bảng, tên cột và ràng buộc khớp dtb.md.
        modelBuilder.Entity<Faculty>(entity =>
        {
            entity.ToTable("Faculties");
            entity.HasKey(x => x.FacultyId);
            entity.Property(x => x.FacultyName).IsRequired();
            entity.HasIndex(x => x.FacultyName).IsUnique();
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Departments");
            entity.HasKey(x => x.DepartmentId);
            entity.Property(x => x.DepartmentName).IsRequired();
            entity.HasIndex(x => x.FacultyId);
            entity.HasOne<Faculty>()
                .WithMany()
                .HasForeignKey(x => x.FacultyId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Major>(entity =>
        {
            entity.ToTable("Majors");
            entity.HasKey(x => x.MajorId);
            entity.Property(x => x.MajorName).IsRequired();
            entity.HasIndex(x => x.FacultyId);
            entity.HasOne<Faculty>()
                .WithMany()
                .HasForeignKey(x => x.FacultyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AcademicYear>(entity =>
        {
            entity.ToTable("AcademicYears");
            entity.HasKey(x => x.AcademicYearId);
            entity.Property(x => x.AcademicYearName).IsRequired();
            entity.HasIndex(x => x.AcademicYearName).IsUnique();
        });

        modelBuilder.Entity<Semester>(entity =>
        {
            entity.ToTable("Semesters");
            entity.HasKey(x => x.SemesterId);
            entity.Property(x => x.SemesterName).IsRequired();
            entity.HasIndex(x => new { x.AcademicYearId, x.SemesterName }).IsUnique();
            entity.HasOne<AcademicYear>()
                .WithMany()
                .HasForeignKey(x => x.AcademicYearId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CourseSection>(entity =>
        {
            entity.ToTable("CourseSections");
            entity.HasKey(x => x.CourseSectionId);
            entity.Property(x => x.SectionName).IsRequired();
            entity.HasIndex(x => new { x.CourseId, x.SemesterId, x.SectionName }).IsUnique();
            entity.HasIndex(x => x.SemesterId);
            entity.HasIndex(x => x.LecturerId);
            entity.HasOne<Course>()
                .WithMany()
                .HasForeignKey(x => x.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Semester>()
                .WithMany()
                .HasForeignKey(x => x.SemesterId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Lecturer>()
                .WithMany()
                .HasForeignKey(x => x.LecturerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Lecturer>(entity =>
        {
            entity.ToTable("Lecturers");
            entity.HasKey(x => x.LecturerId);
            entity.Property(x => x.FullName).IsRequired();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.DepartmentId);
            entity.HasIndex(x => x.FacultyId);
            entity.HasOne<Department>()
                .WithMany()
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Faculty>()
                .WithMany()
                .HasForeignKey(x => x.FacultyId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Course>(entity =>
        {
            entity.ToTable("Courses");
            entity.HasKey(x => x.CourseId);
            entity.Property(x => x.CourseCode).IsRequired();
            entity.Property(x => x.CourseName).IsRequired();
            entity.Property(x => x.CourseType).IsRequired().HasDefaultValue(string.Empty);
            entity.HasIndex(x => x.CourseCode).IsUnique();
            entity.HasIndex(x => x.DepartmentId);
            entity.HasIndex(x => x.FacultyId);
            entity.HasIndex(x => x.PrerequisiteCourseId);
            entity.HasOne<Department>()
                .WithMany()
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Faculty>()
                .WithMany()
                .HasForeignKey(x => x.FacultyId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Course>()
                .WithMany()
                .HasForeignKey(x => x.PrerequisiteCourseId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Bộ câu hỏi khảo sát. Giới hạn 30 câu mỗi bộ được kiểm tra ở tầng
        // service (dtb.md cho phép bỏ trigger và validate trong backend).
        modelBuilder.Entity<AnswerScale>(entity =>
        {
            entity.ToTable("AnswerScales");
            entity.HasKey(x => x.AnswerScaleId);
            entity.Property(x => x.AnswerScaleName).IsRequired();
        });

        modelBuilder.Entity<AnswerScaleOption>(entity =>
        {
            entity.ToTable("AnswerScaleOptions", table =>
                table.HasCheckConstraint("CK_AnswerScaleOptions_Value", "\"Value\" BETWEEN 1 AND 5"));
            entity.HasKey(x => x.AnswerScaleOptionId);
            entity.Property(x => x.DisplayText).IsRequired();
            entity.HasIndex(x => new { x.AnswerScaleId, x.Value }).IsUnique();
            entity.HasOne<AnswerScale>()
                .WithMany()
                .HasForeignKey(x => x.AnswerScaleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SurveyTemplate>(entity =>
        {
            entity.ToTable("SurveyTemplates");
            entity.HasKey(x => x.SurveyTemplateId);
            entity.Property(x => x.TemplateName).IsRequired();
            entity.HasIndex(x => x.AnswerScaleId);
            entity.HasOne<AnswerScale>()
                .WithMany()
                .HasForeignKey(x => x.AnswerScaleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SurveyQuestion>(entity =>
        {
            entity.ToTable("SurveyQuestions");
            entity.HasKey(x => x.QuestionId);
            entity.Property(x => x.QuestionText).IsRequired();
            entity.HasIndex(x => x.SurveyTemplateId);
            entity.HasOne<SurveyTemplate>()
                .WithMany()
                .HasForeignKey(x => x.SurveyTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Đợt khảo sát theo học kỳ và bài khảo sát riêng của từng lớp học phần.
        modelBuilder.Entity<SemesterSurvey>(entity =>
        {
            entity.ToTable("SemesterSurveys");
            entity.HasKey(x => x.SemesterSurveyId);
            entity.HasIndex(x => x.SemesterId);
            entity.HasIndex(x => x.SurveyTemplateId);
            entity.HasOne<Semester>()
                .WithMany()
                .HasForeignKey(x => x.SemesterId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<SurveyTemplate>()
                .WithMany()
                .HasForeignKey(x => x.SurveyTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CourseSectionSurvey>(entity =>
        {
            entity.ToTable("CourseSectionSurveys", table =>
                table.HasCheckConstraint(
                    "CK_CourseSectionSurveys_TimeRange",
                    "\"EndTime\" > \"StartTime\""));
            entity.HasKey(x => x.CourseSectionSurveyId);
            entity.Property(x => x.LinkToken).IsRequired();
            entity.HasIndex(x => x.LinkToken).IsUnique();
            entity.HasIndex(x => new { x.SemesterSurveyId, x.CourseSectionId }).IsUnique();
            entity.HasIndex(x => x.CourseSectionId);
            entity.HasOne<SemesterSurvey>()
                .WithMany()
                .HasForeignKey(x => x.SemesterSurveyId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<CourseSection>()
                .WithMany()
                .HasForeignKey(x => x.CourseSectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SurveyResponse>(entity =>
        {
            entity.ToTable("SurveyResponses");
            entity.HasKey(x => x.ResponseId);
            entity.Property(x => x.Score).HasColumnType("numeric(4,2)");
            entity.HasIndex(x => x.CourseSectionSurveyId);
            entity.HasOne<CourseSectionSurvey>()
                .WithMany()
                .HasForeignKey(x => x.CourseSectionSurveyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SurveyResponseAnswer>(entity =>
        {
            entity.ToTable("SurveyResponseAnswers", table =>
                table.HasCheckConstraint(
                    "CK_SurveyResponseAnswers_SelectedValue",
                    "\"SelectedValue\" BETWEEN 1 AND 5"));
            entity.HasKey(x => new { x.ResponseId, x.QuestionId });
            entity.HasIndex(x => x.QuestionId);
            entity.HasOne(x => x.SurveyResponse)
                .WithMany()
                .HasForeignKey(x => x.ResponseId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<SurveyQuestion>()
                .WithMany()
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ChangeAuditLog>(entity =>
        {
            entity.ToTable("ChangeAuditLogs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.TableName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.RecordId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Action).HasMaxLength(20).IsRequired();
            entity.Property(x => x.ChangedByEmail).HasMaxLength(320);
            entity.HasIndex(x => new { x.TableName, x.RecordId });
            entity.HasIndex(x => new { x.ChangedBy, x.ChangedAt });
            entity.HasIndex(x => x.ChangedAt);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.ChangedBy).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
