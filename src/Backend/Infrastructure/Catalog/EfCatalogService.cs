using Application.Catalog;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Catalog;

public sealed class EfCatalogService(AppDbContext db) : ICatalogService
{
    private const int MaximumImportRows = 500;

    // ---------------------------------------------------------------- Faculties

    public async Task<IReadOnlyList<FacultyDto>> GetFacultiesAsync(CancellationToken cancellationToken = default) =>
        await db.Faculties
            .OrderBy(x => x.FacultyName)
            .Select(x => new FacultyDto(x.FacultyId, x.FacultyName))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<FacultyDto>> CreateFacultyAsync(
        SaveFacultyCommand command,
        CancellationToken cancellationToken = default)
    {
        var name = command.FacultyName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<FacultyDto>(CatalogErrorCodes.FacultyNameRequired);
        }
        if (await FacultyNameTakenAsync(name, null, cancellationToken))
        {
            return Failed<FacultyDto>(CatalogErrorCodes.FacultyNameExists);
        }

        var faculty = new Faculty { FacultyName = name };
        db.Faculties.Add(faculty);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new FacultyDto(faculty.FacultyId, faculty.FacultyName));
    }

    public async Task<CatalogOperationResult<FacultyDto>> UpdateFacultyAsync(
        int facultyId,
        SaveFacultyCommand command,
        CancellationToken cancellationToken = default)
    {
        var faculty = await db.Faculties.FirstOrDefaultAsync(x => x.FacultyId == facultyId, cancellationToken);
        if (faculty is null)
        {
            return Failed<FacultyDto>(CatalogErrorCodes.FacultyNotFound);
        }

        var name = command.FacultyName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<FacultyDto>(CatalogErrorCodes.FacultyNameRequired);
        }
        if (await FacultyNameTakenAsync(name, facultyId, cancellationToken))
        {
            return Failed<FacultyDto>(CatalogErrorCodes.FacultyNameExists);
        }

        faculty.FacultyName = name;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new FacultyDto(faculty.FacultyId, faculty.FacultyName));
    }

    public async Task<CatalogOperationResult<bool>> DeleteFacultyAsync(
        int facultyId,
        CancellationToken cancellationToken = default)
    {
        var faculty = await db.Faculties.FirstOrDefaultAsync(x => x.FacultyId == facultyId, cancellationToken);
        if (faculty is null)
        {
            return Failed<bool>(CatalogErrorCodes.FacultyNotFound);
        }

        db.Faculties.Remove(faculty);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Lecturers và Courses tham chiếu Faculties với ON DELETE RESTRICT.
            db.ChangeTracker.Clear();
            return Failed<bool>(CatalogErrorCodes.FacultyInUse);
        }

        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportFacultiesAsync(
        IReadOnlyList<ImportFacultyRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }

        var existingNames = (await db.Faculties.Select(x => x.FacultyName).ToListAsync(cancellationToken))
            .Select(NormalizeKey)
            .ToHashSet();
        var seenInFile = new HashSet<string>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Faculty>();

        foreach (var row in rows)
        {
            var name = row.FacultyName?.Trim() ?? string.Empty;
            if (name.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, null, false, CatalogErrorCodes.FacultyNameRequired));
                continue;
            }

            var key = NormalizeKey(name);
            if (existingNames.Contains(key))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, null, false, CatalogErrorCodes.FacultyNameExists));
                continue;
            }
            if (!seenInFile.Add(key))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, null, false, CatalogErrorCodes.FacultyDuplicateInFile));
                continue;
            }

            created.Add(new Faculty { FacultyName = name });
            items.Add(new CatalogImportItemDto(row.RowNumber, name, null, true, null));
        }

        if (created.Count > 0)
        {
            db.Faculties.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // -------------------------------------------------------------- Departments

    public async Task<IReadOnlyList<DepartmentDto>> GetDepartmentsAsync(CancellationToken cancellationToken = default) =>
        await db.Departments
            .OrderBy(x => x.DepartmentName)
            .Select(x => new DepartmentDto(x.DepartmentId, x.DepartmentName, x.FacultyId))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<DepartmentDto>> CreateDepartmentAsync(
        SaveDepartmentCommand command,
        CancellationToken cancellationToken = default)
    {
        var name = command.DepartmentName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentNameRequired);
        }
        if (command.FacultyId is { } facultyId && !await FacultyExistsAsync(facultyId, cancellationToken))
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.FacultyNotFound);
        }

        var department = new Department { DepartmentName = name, FacultyId = command.FacultyId };
        db.Departments.Add(department);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new DepartmentDto(department.DepartmentId, department.DepartmentName, department.FacultyId));
    }

    public async Task<CatalogOperationResult<DepartmentDto>> UpdateDepartmentAsync(
        int departmentId,
        SaveDepartmentCommand command,
        CancellationToken cancellationToken = default)
    {
        var department = await db.Departments.FirstOrDefaultAsync(x => x.DepartmentId == departmentId, cancellationToken);
        if (department is null)
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentNotFound);
        }

        var name = command.DepartmentName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentNameRequired);
        }
        if (command.FacultyId is { } facultyId && !await FacultyExistsAsync(facultyId, cancellationToken))
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.FacultyNotFound);
        }

        department.DepartmentName = name;
        department.FacultyId = command.FacultyId;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new DepartmentDto(department.DepartmentId, department.DepartmentName, department.FacultyId));
    }

    public async Task<CatalogOperationResult<bool>> DeleteDepartmentAsync(
        int departmentId,
        CancellationToken cancellationToken = default)
    {
        var department = await db.Departments.FirstOrDefaultAsync(x => x.DepartmentId == departmentId, cancellationToken);
        if (department is null)
        {
            return Failed<bool>(CatalogErrorCodes.DepartmentNotFound);
        }

        db.Departments.Remove(department);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Lecturers và Courses tham chiếu Departments với ON DELETE RESTRICT.
            db.ChangeTracker.Clear();
            return Failed<bool>(CatalogErrorCodes.DepartmentInUse);
        }

        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportDepartmentsAsync(
        IReadOnlyList<ImportDepartmentRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }

        var facultyIdByName = await LoadFacultyIdByNameAsync(cancellationToken);
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Department>();

        foreach (var row in rows)
        {
            var name = row.DepartmentName?.Trim() ?? string.Empty;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;

            if (name.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.DepartmentNameRequired));
                continue;
            }

            int? facultyId = null;
            if (facultyName.Length > 0)
            {
                if (!facultyIdByName.TryGetValue(NormalizeKey(facultyName), out var found))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.FacultyNotFound));
                    continue;
                }
                facultyId = found;
            }

            created.Add(new Department { DepartmentName = name, FacultyId = facultyId });
            items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Departments.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // ------------------------------------------------------------------ Majors

    public async Task<IReadOnlyList<MajorDto>> GetMajorsAsync(CancellationToken cancellationToken = default) =>
        await db.Majors
            .OrderBy(x => x.MajorName)
            .Select(x => new MajorDto(x.MajorId, x.MajorName, x.FacultyId))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<MajorDto>> CreateMajorAsync(
        SaveMajorCommand command,
        CancellationToken cancellationToken = default)
    {
        var name = command.MajorName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<MajorDto>(CatalogErrorCodes.MajorNameRequired);
        }
        if (!await FacultyExistsAsync(command.FacultyId, cancellationToken))
        {
            return Failed<MajorDto>(CatalogErrorCodes.FacultyNotFound);
        }

        var major = new Major { MajorName = name, FacultyId = command.FacultyId };
        db.Majors.Add(major);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new MajorDto(major.MajorId, major.MajorName, major.FacultyId));
    }

    public async Task<CatalogOperationResult<MajorDto>> UpdateMajorAsync(
        int majorId,
        SaveMajorCommand command,
        CancellationToken cancellationToken = default)
    {
        var major = await db.Majors.FirstOrDefaultAsync(x => x.MajorId == majorId, cancellationToken);
        if (major is null)
        {
            return Failed<MajorDto>(CatalogErrorCodes.MajorNotFound);
        }

        var name = command.MajorName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<MajorDto>(CatalogErrorCodes.MajorNameRequired);
        }
        if (!await FacultyExistsAsync(command.FacultyId, cancellationToken))
        {
            return Failed<MajorDto>(CatalogErrorCodes.FacultyNotFound);
        }

        major.MajorName = name;
        major.FacultyId = command.FacultyId;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new MajorDto(major.MajorId, major.MajorName, major.FacultyId));
    }

    public async Task<CatalogOperationResult<bool>> DeleteMajorAsync(
        int majorId,
        CancellationToken cancellationToken = default)
    {
        var major = await db.Majors.FirstOrDefaultAsync(x => x.MajorId == majorId, cancellationToken);
        if (major is null)
        {
            return Failed<bool>(CatalogErrorCodes.MajorNotFound);
        }

        db.Majors.Remove(major);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportMajorsAsync(
        IReadOnlyList<ImportMajorRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }

        var facultyIdByName = await LoadFacultyIdByNameAsync(cancellationToken);
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Major>();

        foreach (var row in rows)
        {
            var name = row.MajorName?.Trim() ?? string.Empty;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;

            if (name.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.MajorNameRequired));
                continue;
            }
            // "Majors"."FacultyId" là NOT NULL nên bắt buộc phải tra được khoa viện.
            if (facultyName.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.MajorFacultyRequired));
                continue;
            }
            if (!facultyIdByName.TryGetValue(NormalizeKey(facultyName), out var facultyId))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.FacultyNotFound));
                continue;
            }

            created.Add(new Major { MajorName = name, FacultyId = facultyId });
            items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Majors.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // ----------------------------------------------- Năm học và học kỳ

    /// <summary>Ba học kỳ được sinh tự động cho mỗi năm học mới.</summary>
    private static readonly string[] DefaultSemesterNames = ["Học kỳ phụ", "Học kỳ 1", "Học kỳ 2"];

    public async Task<IReadOnlyList<AcademicYearDto>> GetAcademicYearsAsync(
        CancellationToken cancellationToken = default)
    {
        var years = await db.AcademicYears
            .OrderByDescending(x => x.StartDate)
            .ThenBy(x => x.AcademicYearName)
            .ToListAsync(cancellationToken);
        var semesters = await db.Semesters
            .OrderBy(x => x.SemesterId)
            .ToListAsync(cancellationToken);

        return years
            .Select(year => new AcademicYearDto(
                year.AcademicYearId,
                year.AcademicYearName,
                year.StartDate,
                year.EndDate,
                semesters
                    .Where(semester => semester.AcademicYearId == year.AcademicYearId)
                    .Select(ToDto)
                    .ToList()))
            .ToList();
    }

    public async Task<CatalogOperationResult<AcademicYearDto>> CreateAcademicYearAsync(
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateAcademicYearAsync(null, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<AcademicYearDto>(validation);
        }

        var year = new AcademicYear
        {
            AcademicYearName = command.AcademicYearName.Trim(),
            StartDate = command.StartDate,
            EndDate = command.EndDate
        };
        db.AcademicYears.Add(year);
        await db.SaveChangesAsync(cancellationToken);

        var semesters = DefaultSemesterNames
            .Select(name => new Semester { SemesterName = name, AcademicYearId = year.AcademicYearId })
            .ToList();
        db.Semesters.AddRange(semesters);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new AcademicYearDto(
            year.AcademicYearId,
            year.AcademicYearName,
            year.StartDate,
            year.EndDate,
            semesters.Select(ToDto).ToList()));
    }

    public async Task<CatalogOperationResult<AcademicYearDto>> UpdateAcademicYearAsync(
        int academicYearId,
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken = default)
    {
        var year = await db.AcademicYears
            .FirstOrDefaultAsync(x => x.AcademicYearId == academicYearId, cancellationToken);
        if (year is null)
        {
            return Failed<AcademicYearDto>(CatalogErrorCodes.AcademicYearNotFound);
        }

        var validation = await ValidateAcademicYearAsync(academicYearId, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<AcademicYearDto>(validation);
        }

        year.AcademicYearName = command.AcademicYearName.Trim();
        year.StartDate = command.StartDate;
        year.EndDate = command.EndDate;
        await db.SaveChangesAsync(cancellationToken);

        var semesters = await db.Semesters
            .Where(x => x.AcademicYearId == academicYearId)
            .OrderBy(x => x.SemesterId)
            .ToListAsync(cancellationToken);

        return Succeeded(new AcademicYearDto(
            year.AcademicYearId,
            year.AcademicYearName,
            year.StartDate,
            year.EndDate,
            semesters.Select(ToDto).ToList()));
    }

    public async Task<CatalogOperationResult<bool>> DeleteAcademicYearAsync(
        int academicYearId,
        CancellationToken cancellationToken = default)
    {
        var year = await db.AcademicYears
            .FirstOrDefaultAsync(x => x.AcademicYearId == academicYearId, cancellationToken);
        if (year is null)
        {
            return Failed<bool>(CatalogErrorCodes.AcademicYearNotFound);
        }

        // Semesters và CourseSections cascade theo năm học.
        db.AcademicYears.Remove(year);
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<SemesterDto>> CreateSemesterAsync(
        SaveSemesterCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateSemesterAsync(null, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<SemesterDto>(validation);
        }

        var semester = new Semester
        {
            SemesterName = command.SemesterName.Trim(),
            AcademicYearId = command.AcademicYearId
        };
        db.Semesters.Add(semester);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(semester));
    }

    public async Task<CatalogOperationResult<SemesterDto>> UpdateSemesterAsync(
        int semesterId,
        SaveSemesterCommand command,
        CancellationToken cancellationToken = default)
    {
        var semester = await db.Semesters.FirstOrDefaultAsync(x => x.SemesterId == semesterId, cancellationToken);
        if (semester is null)
        {
            return Failed<SemesterDto>(CatalogErrorCodes.SemesterNotFound);
        }

        var validation = await ValidateSemesterAsync(semesterId, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<SemesterDto>(validation);
        }

        semester.SemesterName = command.SemesterName.Trim();
        semester.AcademicYearId = command.AcademicYearId;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(semester));
    }

    public async Task<CatalogOperationResult<bool>> DeleteSemesterAsync(
        int semesterId,
        CancellationToken cancellationToken = default)
    {
        var semester = await db.Semesters.FirstOrDefaultAsync(x => x.SemesterId == semesterId, cancellationToken);
        if (semester is null)
        {
            return Failed<bool>(CatalogErrorCodes.SemesterNotFound);
        }

        db.Semesters.Remove(semester);
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    // ----------------------------------------------------------- Lớp học phần

    public async Task<IReadOnlyList<CourseSectionDto>> GetCourseSectionsAsync(
        int? semesterId,
        CancellationToken cancellationToken = default)
    {
        var query = db.CourseSections.AsQueryable();
        if (semesterId is { } id)
        {
            query = query.Where(x => x.SemesterId == id);
        }

        var sections = await query.OrderBy(x => x.SectionName).ToListAsync(cancellationToken);
        return sections.Select(ToDto).ToList();
    }

    public async Task<CatalogOperationResult<CourseSectionDto>> CreateCourseSectionAsync(
        SaveCourseSectionCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateCourseSectionAsync(null, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<CourseSectionDto>(validation);
        }

        var section = new CourseSection
        {
            CourseId = command.CourseId,
            SemesterId = command.SemesterId,
            LecturerId = command.LecturerId,
            SectionName = command.SectionName.Trim(),
            ClassSize = command.ClassSize
        };
        db.CourseSections.Add(section);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(section));
    }

    public async Task<CatalogOperationResult<CourseSectionDto>> UpdateCourseSectionAsync(
        int courseSectionId,
        SaveCourseSectionCommand command,
        CancellationToken cancellationToken = default)
    {
        var section = await db.CourseSections
            .FirstOrDefaultAsync(x => x.CourseSectionId == courseSectionId, cancellationToken);
        if (section is null)
        {
            return Failed<CourseSectionDto>(CatalogErrorCodes.CourseSectionNotFound);
        }

        var validation = await ValidateCourseSectionAsync(courseSectionId, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<CourseSectionDto>(validation);
        }

        section.CourseId = command.CourseId;
        section.SemesterId = command.SemesterId;
        section.LecturerId = command.LecturerId;
        section.SectionName = command.SectionName.Trim();
        section.ClassSize = command.ClassSize;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(section));
    }

    public async Task<CatalogOperationResult<bool>> DeleteCourseSectionAsync(
        int courseSectionId,
        CancellationToken cancellationToken = default)
    {
        var section = await db.CourseSections
            .FirstOrDefaultAsync(x => x.CourseSectionId == courseSectionId, cancellationToken);
        if (section is null)
        {
            return Failed<bool>(CatalogErrorCodes.CourseSectionNotFound);
        }

        db.CourseSections.Remove(section);
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportCourseSectionsAsync(
        int semesterId,
        IReadOnlyList<ImportCourseSectionRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }
        if (!await db.Semesters.AnyAsync(x => x.SemesterId == semesterId, cancellationToken))
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.SemesterNotFound);
        }

        var courses = await db.Courses
            .Select(x => new { x.CourseId, x.CourseCode })
            .ToListAsync(cancellationToken);
        var courseIdByCode = new Dictionary<string, int>();
        foreach (var course in courses)
        {
            courseIdByCode[NormalizeKey(course.CourseCode)] = course.CourseId;
        }

        var lecturerIndex = await LoadLecturerIndexAsync(cancellationToken);

        // Trùng theo UNIQUE ("CourseId", "SemesterId", "SectionName").
        var existingKeys = (await db.CourseSections
                .Where(x => x.SemesterId == semesterId)
                .Select(x => new { x.CourseId, x.SectionName })
                .ToListAsync(cancellationToken))
            .Select(x => $"{x.CourseId}|{NormalizeKey(x.SectionName)}")
            .ToHashSet();
        var seenInFile = new HashSet<string>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<CourseSection>();

        foreach (var row in rows)
        {
            var courseCode = row.CourseCode?.Trim() ?? string.Empty;
            var sectionName = row.SectionName?.Trim() ?? string.Empty;

            if (courseCode.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, null, false, CatalogErrorCodes.CourseCodeRequired));
                continue;
            }
            if (sectionName.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionNameRequired));
                continue;
            }
            if (!courseIdByCode.TryGetValue(NormalizeKey(courseCode), out var courseId))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseNotFound));
                continue;
            }

            var classSizeText = row.ClassSize?.Trim() ?? string.Empty;
            var classSize = 0;
            if (classSizeText.Length > 0 && (!int.TryParse(classSizeText, out classSize) || classSize < 0))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionSizeInvalid));
                continue;
            }

            var lecturerLookup = ResolveLecturer(lecturerIndex, row);
            if (lecturerLookup.ErrorCode is not null)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, lecturerLookup.ErrorCode));
                continue;
            }

            var key = $"{courseId}|{NormalizeKey(sectionName)}";
            if (existingKeys.Contains(key))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionExists));
                continue;
            }
            if (!seenInFile.Add(key))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionDuplicateInFile));
                continue;
            }

            created.Add(new CourseSection
            {
                CourseId = courseId,
                SemesterId = semesterId,
                LecturerId = lecturerLookup.LecturerId,
                SectionName = sectionName,
                ClassSize = classSize
            });
            items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, true, null));
        }

        if (created.Count > 0)
        {
            db.CourseSections.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    /// <summary>Bản ghi giảng viên rút gọn dùng để tra khi import.</summary>
    private sealed record LecturerIndexRow(
        int LecturerId,
        string FullName,
        string? Email,
        string? DepartmentName,
        string? FacultyName);

    private async Task<IReadOnlyList<LecturerIndexRow>> LoadLecturerIndexAsync(
        CancellationToken cancellationToken)
    {
        var lecturers = await db.Lecturers.ToListAsync(cancellationToken);
        var departments = await db.Departments.ToListAsync(cancellationToken);
        var faculties = await db.Faculties.ToListAsync(cancellationToken);

        return lecturers
            .Select(lecturer => new LecturerIndexRow(
                lecturer.LecturerId,
                lecturer.FullName,
                lecturer.Email,
                departments
                    .FirstOrDefault(x => x.DepartmentId == lecturer.DepartmentId)?.DepartmentName,
                faculties.FirstOrDefault(x => x.FacultyId == lecturer.FacultyId)?.FacultyName))
            .ToList();
    }

    /// <summary>
    /// Tra giảng viên cho một dòng import. Ưu tiên email vì UNIQUE; nếu dòng
    /// không ghi email thì tra theo họ tên, thu hẹp thêm bằng bộ môn và khoa
    /// viện khi tệp có ghi. Còn nhiều hơn một kết quả thì báo không xác định.
    /// </summary>
    private static (int LecturerId, string? ErrorCode) ResolveLecturer(
        IReadOnlyList<LecturerIndexRow> index,
        ImportCourseSectionRowCommand row)
    {
        var email = row.LecturerEmail?.Trim() ?? string.Empty;
        if (email.Length > 0)
        {
            var byEmail = index
                .Where(x => x.Email != null && NormalizeKey(x.Email) == NormalizeKey(email))
                .ToList();
            return byEmail.Count == 1
                ? (byEmail[0].LecturerId, null)
                : (0, CatalogErrorCodes.LecturerNotFound);
        }

        var fullName = row.LecturerFullName?.Trim() ?? string.Empty;
        if (fullName.Length == 0)
        {
            return (0, CatalogErrorCodes.SectionLecturerRequired);
        }

        var candidates = index
            .Where(x => NormalizeKey(x.FullName) == NormalizeKey(fullName))
            .ToList();

        var departmentName = row.LecturerDepartmentName?.Trim() ?? string.Empty;
        if (departmentName.Length > 0)
        {
            candidates = candidates
                .Where(x => x.DepartmentName != null
                    && NormalizeKey(x.DepartmentName) == NormalizeKey(departmentName))
                .ToList();
        }

        var facultyName = row.LecturerFacultyName?.Trim() ?? string.Empty;
        if (facultyName.Length > 0)
        {
            candidates = candidates
                .Where(x => x.FacultyName != null
                    && NormalizeKey(x.FacultyName) == NormalizeKey(facultyName))
                .ToList();
        }

        return candidates.Count switch
        {
            1 => (candidates[0].LecturerId, null),
            0 => (0, CatalogErrorCodes.LecturerNotFound),
            _ => (0, CatalogErrorCodes.LecturerAmbiguous)
        };
    }

    // ---------------------------------------------------------------- Lecturers

    public async Task<IReadOnlyList<LecturerDto>> GetLecturersAsync(CancellationToken cancellationToken = default) =>
        await db.Lecturers
            .OrderBy(x => x.FullName)
            .Select(x => new LecturerDto(
                x.LecturerId,
                x.FullName,
                x.DepartmentId,
                x.FacultyId,
                x.Email,
                x.PhoneNumber))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<LecturerDto>> CreateLecturerAsync(
        SaveLecturerCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateLecturerAsync(null, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<LecturerDto>(validation);
        }

        var lecturer = new Lecturer
        {
            FullName = command.FullName.Trim(),
            Email = NullIfBlank(command.Email),
            PhoneNumber = NullIfBlank(command.PhoneNumber),
            DepartmentId = command.DepartmentId,
            FacultyId = command.FacultyId
        };
        db.Lecturers.Add(lecturer);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(lecturer));
    }

    public async Task<CatalogOperationResult<LecturerDto>> UpdateLecturerAsync(
        int lecturerId,
        SaveLecturerCommand command,
        CancellationToken cancellationToken = default)
    {
        var lecturer = await db.Lecturers.FirstOrDefaultAsync(x => x.LecturerId == lecturerId, cancellationToken);
        if (lecturer is null)
        {
            return Failed<LecturerDto>(CatalogErrorCodes.LecturerNotFound);
        }

        var validation = await ValidateLecturerAsync(lecturerId, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<LecturerDto>(validation);
        }

        lecturer.FullName = command.FullName.Trim();
        lecturer.Email = NullIfBlank(command.Email);
        lecturer.PhoneNumber = NullIfBlank(command.PhoneNumber);
        lecturer.DepartmentId = command.DepartmentId;
        lecturer.FacultyId = command.FacultyId;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(lecturer));
    }

    public async Task<CatalogOperationResult<bool>> DeleteLecturerAsync(
        int lecturerId,
        CancellationToken cancellationToken = default)
    {
        var lecturer = await db.Lecturers.FirstOrDefaultAsync(x => x.LecturerId == lecturerId, cancellationToken);
        if (lecturer is null)
        {
            return Failed<bool>(CatalogErrorCodes.LecturerNotFound);
        }

        db.Lecturers.Remove(lecturer);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            return Failed<bool>(CatalogErrorCodes.LecturerInUse);
        }

        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportLecturersAsync(
        IReadOnlyList<ImportLecturerRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }

        var facultyIdByName = await LoadFacultyIdByNameAsync(cancellationToken);
        var departmentIdByName = await LoadDepartmentIdByNameAsync(cancellationToken);
        var existingEmails = (await db.Lecturers.Select(x => x.Email).ToListAsync(cancellationToken))
            .Where(x => x != null)
            .Select(x => NormalizeKey(x!))
            .ToHashSet();
        var seenInFile = new HashSet<string>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Lecturer>();

        foreach (var row in rows)
        {
            var fullName = row.FullName?.Trim() ?? string.Empty;
            var email = row.Email?.Trim() ?? string.Empty;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;

            if (fullName.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.LecturerNameRequired));
                continue;
            }

            // Email bỏ trống thì lưu NULL, chỉ dòng có email mới kiểm tra trùng.
            if (email.Length > 0)
            {
                var emailKey = NormalizeKey(email);
                if (existingEmails.Contains(emailKey))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.LecturerEmailExists));
                    continue;
                }
                if (!seenInFile.Add(emailKey))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.LecturerEmailDuplicateInFile));
                    continue;
                }
            }

            int? facultyId = null;
            if (facultyName.Length > 0)
            {
                if (!facultyIdByName.TryGetValue(NormalizeKey(facultyName), out var foundFaculty))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.FacultyNotFound));
                    continue;
                }
                facultyId = foundFaculty;
            }

            int? departmentId = null;
            var departmentName = row.DepartmentName?.Trim() ?? string.Empty;
            if (departmentName.Length > 0)
            {
                if (!departmentIdByName.TryGetValue(NormalizeKey(departmentName), out var foundDepartment))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.DepartmentNotFound));
                    continue;
                }
                departmentId = foundDepartment;
            }

            created.Add(new Lecturer
            {
                FullName = fullName,
                Email = NullIfBlank(email),
                PhoneNumber = NullIfBlank(row.PhoneNumber),
                DepartmentId = departmentId,
                FacultyId = facultyId
            });
            items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Lecturers.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // ------------------------------------------------------------------ Courses

    public async Task<IReadOnlyList<CourseDto>> GetCoursesAsync(CancellationToken cancellationToken = default) =>
        await db.Courses
            .OrderBy(x => x.CourseCode)
            .Select(x => new CourseDto(
                x.CourseId,
                x.CourseCode,
                x.CourseName,
                x.Credits,
                x.CourseType,
                x.DepartmentId,
                x.FacultyId,
                x.PrerequisiteCourseId))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<CourseDto>> CreateCourseAsync(
        SaveCourseCommand command,
        CancellationToken cancellationToken = default)
    {
        var validation = await ValidateCourseAsync(null, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<CourseDto>(validation);
        }

        var course = new Course
        {
            CourseCode = command.CourseCode.Trim(),
            CourseName = command.CourseName.Trim(),
            Credits = command.Credits,
            CourseType = NormalizeCourseType(command.CourseType),
            DepartmentId = command.DepartmentId,
            FacultyId = command.FacultyId,
            PrerequisiteCourseId = command.PrerequisiteCourseId
        };
        db.Courses.Add(course);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(course));
    }

    public async Task<CatalogOperationResult<CourseDto>> UpdateCourseAsync(
        int courseId,
        SaveCourseCommand command,
        CancellationToken cancellationToken = default)
    {
        var course = await db.Courses.FirstOrDefaultAsync(x => x.CourseId == courseId, cancellationToken);
        if (course is null)
        {
            return Failed<CourseDto>(CatalogErrorCodes.CourseNotFound);
        }
        // Không cho học phần tự làm tiên quyết của chính nó.
        if (command.PrerequisiteCourseId == courseId)
        {
            return Failed<CourseDto>(CatalogErrorCodes.PrerequisiteNotFound);
        }

        var validation = await ValidateCourseAsync(courseId, command, cancellationToken);
        if (validation is not null)
        {
            return Failed<CourseDto>(validation);
        }

        course.CourseCode = command.CourseCode.Trim();
        course.CourseName = command.CourseName.Trim();
        course.Credits = command.Credits;
        course.CourseType = NormalizeCourseType(command.CourseType);
        course.DepartmentId = command.DepartmentId;
        course.FacultyId = command.FacultyId;
        course.PrerequisiteCourseId = command.PrerequisiteCourseId;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(ToDto(course));
    }

    public async Task<CatalogOperationResult<bool>> DeleteCourseAsync(
        int courseId,
        CancellationToken cancellationToken = default)
    {
        var course = await db.Courses.FirstOrDefaultAsync(x => x.CourseId == courseId, cancellationToken);
        if (course is null)
        {
            return Failed<bool>(CatalogErrorCodes.CourseNotFound);
        }

        db.Courses.Remove(course);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Học phần khác đang dùng làm tiên quyết (ON DELETE RESTRICT).
            db.ChangeTracker.Clear();
            return Failed<bool>(CatalogErrorCodes.CourseInUse);
        }

        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CatalogImportDto>> ImportCoursesAsync(
        IReadOnlyList<ImportCourseRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CatalogImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }

        var facultyIdByName = await LoadFacultyIdByNameAsync(cancellationToken);
        var departmentIdByName = await LoadDepartmentIdByNameAsync(cancellationToken);
        var existingCodes = (await db.Courses.Select(x => x.CourseCode).ToListAsync(cancellationToken))
            .Select(NormalizeKey)
            .ToHashSet();
        var seenInFile = new HashSet<string>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Course>();

        foreach (var row in rows)
        {
            var code = row.CourseCode?.Trim() ?? string.Empty;
            var name = row.CourseName?.Trim() ?? string.Empty;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;

            if (code.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.CourseCodeRequired));
                continue;
            }
            if (name.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, code, facultyName, false, CatalogErrorCodes.CourseNameRequired));
                continue;
            }

            var codeKey = NormalizeKey(code);
            if (existingCodes.Contains(codeKey))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.CourseCodeExists));
                continue;
            }
            if (!seenInFile.Add(codeKey))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.CourseDuplicateInFile));
                continue;
            }

            if (!int.TryParse(row.Credits?.Trim(), out var credits) || credits < 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.CourseCreditsInvalid));
                continue;
            }

            var courseType = NormalizeCourseType(row.CourseType);
            if (courseType.Length == 0 && !string.IsNullOrWhiteSpace(row.CourseType))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.CourseTypeInvalid));
                continue;
            }

            int? facultyId = null;
            if (facultyName.Length > 0)
            {
                if (!facultyIdByName.TryGetValue(NormalizeKey(facultyName), out var foundFaculty))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.FacultyNotFound));
                    continue;
                }
                facultyId = foundFaculty;
            }

            int? departmentId = null;
            var departmentName = row.DepartmentName?.Trim() ?? string.Empty;
            if (departmentName.Length > 0)
            {
                if (!departmentIdByName.TryGetValue(NormalizeKey(departmentName), out var foundDepartment))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.DepartmentNotFound));
                    continue;
                }
                departmentId = foundDepartment;
            }

            // Học phần tiên quyết chỉ tra trong dữ liệu đã có, không tra sang dòng
            // khác trong cùng tệp vì những dòng đó chưa có id.
            int? prerequisiteId = null;
            var prerequisiteCode = row.PrerequisiteCourseCode?.Trim() ?? string.Empty;
            if (prerequisiteCode.Length > 0)
            {
                var prerequisite = await db.Courses
                    .Where(x => x.CourseCode.ToLower() == prerequisiteCode.ToLower())
                    .Select(x => (int?)x.CourseId)
                    .FirstOrDefaultAsync(cancellationToken);
                if (prerequisite is null)
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.PrerequisiteNotFound));
                    continue;
                }
                prerequisiteId = prerequisite;
            }

            created.Add(new Course
            {
                CourseCode = code,
                CourseName = name,
                Credits = credits,
                CourseType = courseType,
                DepartmentId = departmentId,
                FacultyId = facultyId,
                PrerequisiteCourseId = prerequisiteId
            });
            items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Courses.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // ------------------------------------------------------------------ Helpers

    private static string NormalizeKey(string value) => value.Trim().ToLowerInvariant();

    private static SemesterDto ToDto(Semester semester) =>
        new(semester.SemesterId, semester.SemesterName, semester.AcademicYearId);

    private static CourseSectionDto ToDto(CourseSection section) =>
        new(
            section.CourseSectionId,
            section.CourseId,
            section.SemesterId,
            section.LecturerId,
            section.SectionName,
            section.ClassSize);

    private async Task<string?> ValidateAcademicYearAsync(
        int? academicYearId,
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken)
    {
        var name = command.AcademicYearName?.Trim() ?? string.Empty;
        if (name.Length == 0) return CatalogErrorCodes.AcademicYearNameRequired;
        if (command.EndDate <= command.StartDate) return CatalogErrorCodes.AcademicYearRangeInvalid;

        var names = await db.AcademicYears
            .Where(x => academicYearId == null || x.AcademicYearId != academicYearId)
            .Select(x => x.AcademicYearName)
            .ToListAsync(cancellationToken);
        return names.Any(x => NormalizeKey(x) == NormalizeKey(name))
            ? CatalogErrorCodes.AcademicYearNameExists
            : null;
    }

    private async Task<string?> ValidateSemesterAsync(
        int? semesterId,
        SaveSemesterCommand command,
        CancellationToken cancellationToken)
    {
        var name = command.SemesterName?.Trim() ?? string.Empty;
        if (name.Length == 0) return CatalogErrorCodes.SemesterNameRequired;
        if (!await db.AcademicYears.AnyAsync(x => x.AcademicYearId == command.AcademicYearId, cancellationToken))
        {
            return CatalogErrorCodes.AcademicYearNotFound;
        }

        var names = await db.Semesters
            .Where(x => x.AcademicYearId == command.AcademicYearId)
            .Where(x => semesterId == null || x.SemesterId != semesterId)
            .Select(x => x.SemesterName)
            .ToListAsync(cancellationToken);
        return names.Any(x => NormalizeKey(x) == NormalizeKey(name))
            ? CatalogErrorCodes.SemesterNameExists
            : null;
    }

    private async Task<string?> ValidateCourseSectionAsync(
        int? courseSectionId,
        SaveCourseSectionCommand command,
        CancellationToken cancellationToken)
    {
        var name = command.SectionName?.Trim() ?? string.Empty;
        if (name.Length == 0) return CatalogErrorCodes.CourseSectionNameRequired;
        if (command.ClassSize < 0) return CatalogErrorCodes.CourseSectionSizeInvalid;
        if (!await db.Courses.AnyAsync(x => x.CourseId == command.CourseId, cancellationToken))
        {
            return CatalogErrorCodes.CourseNotFound;
        }
        if (!await db.Semesters.AnyAsync(x => x.SemesterId == command.SemesterId, cancellationToken))
        {
            return CatalogErrorCodes.SemesterNotFound;
        }
        if (!await db.Lecturers.AnyAsync(x => x.LecturerId == command.LecturerId, cancellationToken))
        {
            return CatalogErrorCodes.LecturerNotFound;
        }

        var names = await db.CourseSections
            .Where(x => x.CourseId == command.CourseId && x.SemesterId == command.SemesterId)
            .Where(x => courseSectionId == null || x.CourseSectionId != courseSectionId)
            .Select(x => x.SectionName)
            .ToListAsync(cancellationToken);
        return names.Any(x => NormalizeKey(x) == NormalizeKey(name))
            ? CatalogErrorCodes.CourseSectionExists
            : null;
    }

    private static string? NullIfBlank(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    private static LecturerDto ToDto(Lecturer lecturer) => new(
        lecturer.LecturerId,
        lecturer.FullName,
        lecturer.DepartmentId,
        lecturer.FacultyId,
        lecturer.Email,
        lecturer.PhoneNumber);

    private async Task<string?> ValidateLecturerAsync(
        int? lecturerId,
        SaveLecturerCommand command,
        CancellationToken cancellationToken)
    {
        var fullName = command.FullName?.Trim() ?? string.Empty;
        var email = command.Email?.Trim() ?? string.Empty;

        if (fullName.Length == 0) return CatalogErrorCodes.LecturerNameRequired;

        // Email để trống thì lưu NULL; UNIQUE chỉ áp cho email có giá trị.
        if (email.Length > 0)
        {
            var emails = await db.Lecturers
                .Where(x => lecturerId == null || x.LecturerId != lecturerId)
                .Select(x => x.Email)
                .ToListAsync(cancellationToken);
            if (emails.Any(x => x != null && NormalizeKey(x) == NormalizeKey(email)))
            {
                return CatalogErrorCodes.LecturerEmailExists;
            }
        }

        if (command.FacultyId is { } facultyId && !await FacultyExistsAsync(facultyId, cancellationToken))
        {
            return CatalogErrorCodes.FacultyNotFound;
        }
        if (command.DepartmentId is { } departmentId
            && !await db.Departments.AnyAsync(x => x.DepartmentId == departmentId, cancellationToken))
        {
            return CatalogErrorCodes.DepartmentNotFound;
        }

        return null;
    }

    private async Task<Dictionary<string, int>> LoadDepartmentIdByNameAsync(CancellationToken cancellationToken)
    {
        var departments = await db.Departments
            .Select(x => new { x.DepartmentId, x.DepartmentName })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, int>();
        foreach (var department in departments)
        {
            map[NormalizeKey(department.DepartmentName)] = department.DepartmentId;
        }
        return map;
    }

    private static CourseDto ToDto(Course course) => new(
        course.CourseId,
        course.CourseCode,
        course.CourseName,
        course.Credits,
        course.CourseType,
        course.DepartmentId,
        course.FacultyId,
        course.PrerequisiteCourseId);

    /// <summary>Chấp nhận cả tiếng Anh lẫn tiếng Việt, trả về giá trị lưu xuống cột.</summary>
    private static string NormalizeCourseType(string? value)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Length == 0) return string.Empty;

        return NormalizeKey(text) switch
        {
            "required" or "bat buoc" or "bắt buộc" => "Required",
            "elective" or "tu chon" or "tự chọn" => "Elective",
            _ => string.Empty
        };
    }

    private async Task<string?> ValidateCourseAsync(
        int? courseId,
        SaveCourseCommand command,
        CancellationToken cancellationToken)
    {
        var code = command.CourseCode?.Trim() ?? string.Empty;
        var name = command.CourseName?.Trim() ?? string.Empty;

        if (code.Length == 0) return CatalogErrorCodes.CourseCodeRequired;
        if (name.Length == 0) return CatalogErrorCodes.CourseNameRequired;
        if (command.Credits < 0) return CatalogErrorCodes.CourseCreditsInvalid;

        var codes = await db.Courses
            .Where(x => courseId == null || x.CourseId != courseId)
            .Select(x => x.CourseCode)
            .ToListAsync(cancellationToken);
        if (codes.Any(x => NormalizeKey(x) == NormalizeKey(code)))
        {
            return CatalogErrorCodes.CourseCodeExists;
        }

        if (command.FacultyId is { } facultyId && !await FacultyExistsAsync(facultyId, cancellationToken))
        {
            return CatalogErrorCodes.FacultyNotFound;
        }
        if (command.DepartmentId is { } departmentId
            && !await db.Departments.AnyAsync(x => x.DepartmentId == departmentId, cancellationToken))
        {
            return CatalogErrorCodes.DepartmentNotFound;
        }
        if (command.PrerequisiteCourseId is { } prerequisiteId
            && !await db.Courses.AnyAsync(x => x.CourseId == prerequisiteId, cancellationToken))
        {
            return CatalogErrorCodes.PrerequisiteNotFound;
        }

        return null;
    }

    private static CatalogOperationResult<T> Succeeded<T>(T value) => new(true, null, value);

    private static CatalogOperationResult<T> Failed<T>(string errorCode) => new(false, errorCode, default);

    private Task<bool> FacultyExistsAsync(int facultyId, CancellationToken cancellationToken) =>
        db.Faculties.AnyAsync(x => x.FacultyId == facultyId, cancellationToken);

    private async Task<bool> FacultyNameTakenAsync(string name, int? exceptFacultyId, CancellationToken cancellationToken)
    {
        var names = await db.Faculties
            .Where(x => exceptFacultyId == null || x.FacultyId != exceptFacultyId)
            .Select(x => x.FacultyName)
            .ToListAsync(cancellationToken);
        return names.Any(x => NormalizeKey(x) == NormalizeKey(name));
    }

    private async Task<Dictionary<string, int>> LoadFacultyIdByNameAsync(CancellationToken cancellationToken)
    {
        var faculties = await db.Faculties
            .Select(x => new { x.FacultyId, x.FacultyName })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, int>();
        foreach (var faculty in faculties)
        {
            map[NormalizeKey(faculty.FacultyName)] = faculty.FacultyId;
        }
        return map;
    }
}
