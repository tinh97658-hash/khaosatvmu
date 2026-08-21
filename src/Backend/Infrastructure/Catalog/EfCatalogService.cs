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

        if (await db.Lecturers.AnyAsync(x => x.FacultyId == facultyId, cancellationToken)
            || await db.Courses.AnyAsync(x => x.FacultyId == facultyId, cancellationToken))
        {
            return Failed<bool>(CatalogErrorCodes.FacultyInUse);
        }

        // Cascade soft-delete: khoa viện → ngành học (trước đây ON DELETE CASCADE).
        var majors = await db.Majors.Where(x => x.FacultyId == facultyId).ToListAsync(cancellationToken);
        foreach (var major in majors)
            db.Majors.Remove(major);

        db.Faculties.Remove(faculty);
        await db.SaveChangesAsync(cancellationToken);

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
        // Mã bộ môn tự nhập nên phải kiểm tra thủ công, kể cả với bản ghi đã xóa mềm.
        if (command.DepartmentId <= 0)
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentIdRequired);
        }
        if (await db.Departments
            .IgnoreQueryFilters()
            .AnyAsync(x => x.DepartmentId == command.DepartmentId, cancellationToken))
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentIdExists);
        }
        if (command.FacultyId is { } facultyId && !await FacultyExistsAsync(facultyId, cancellationToken))
        {
            return Failed<DepartmentDto>(CatalogErrorCodes.FacultyNotFound);
        }

        var department = new Department
        {
            DepartmentId = command.DepartmentId,
            DepartmentName = name,
            FacultyId = command.FacultyId
        };
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

        if (await db.Lecturers.AnyAsync(x => x.DepartmentId == departmentId, cancellationToken)
            || await db.Courses.AnyAsync(x => x.DepartmentId == departmentId, cancellationToken))
        {
            return Failed<bool>(CatalogErrorCodes.DepartmentInUse);
        }

        db.Departments.Remove(department);
        await db.SaveChangesAsync(cancellationToken);

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
        // Mã bộ môn do người dùng nhập nên phải tự kiểm tra trùng: trùng trong tệp và trùng dưới CSDL.
        var existingIds = await db.Departments
            .IgnoreQueryFilters()
            .Select(x => x.DepartmentId)
            .ToHashSetAsync(cancellationToken);
        var idsInFile = new HashSet<int>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var created = new List<Department>();

        foreach (var row in rows)
        {
            var name = row.DepartmentName?.Trim() ?? string.Empty;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;

            if (row.DepartmentId <= 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.DepartmentIdRequired));
                continue;
            }
            if (!idsInFile.Add(row.DepartmentId))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.DepartmentIdDuplicateInFile));
                continue;
            }
            if (existingIds.Contains(row.DepartmentId))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, false, CatalogErrorCodes.DepartmentIdExists));
                continue;
            }

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

            created.Add(new Department { DepartmentId = row.DepartmentId, DepartmentName = name, FacultyId = facultyId });
            items.Add(new CatalogImportItemDto(row.RowNumber, name, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Departments.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Succeeded(new CatalogImportDto(rows.Count, created.Count, rows.Count - created.Count, items));
    }

    // --------------------------------------------------------------- Positions

    public async Task<IReadOnlyList<PositionDto>> GetPositionsAsync(CancellationToken cancellationToken = default) =>
        await db.Positions
            .OrderBy(x => x.PositionId)
            .Select(x => new PositionDto(x.PositionId, x.PositionName))
            .ToListAsync(cancellationToken);

    public async Task<CatalogOperationResult<PositionDto>> CreatePositionAsync(
        SavePositionCommand command,
        CancellationToken cancellationToken = default)
    {
        var name = command.PositionName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<PositionDto>(CatalogErrorCodes.PositionNameRequired);
        }
        if (await PositionNameTakenAsync(name, null, cancellationToken))
        {
            return Failed<PositionDto>(CatalogErrorCodes.PositionNameExists);
        }

        var position = new Position { PositionName = name };
        db.Positions.Add(position);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new PositionDto(position.PositionId, position.PositionName));
    }

    public async Task<CatalogOperationResult<PositionDto>> UpdatePositionAsync(
        int positionId,
        SavePositionCommand command,
        CancellationToken cancellationToken = default)
    {
        var position = await db.Positions.FirstOrDefaultAsync(x => x.PositionId == positionId, cancellationToken);
        if (position is null)
        {
            return Failed<PositionDto>(CatalogErrorCodes.PositionNotFound);
        }

        var name = command.PositionName?.Trim() ?? string.Empty;
        if (name.Length == 0)
        {
            return Failed<PositionDto>(CatalogErrorCodes.PositionNameRequired);
        }
        if (await PositionNameTakenAsync(name, positionId, cancellationToken))
        {
            return Failed<PositionDto>(CatalogErrorCodes.PositionNameExists);
        }

        position.PositionName = name;
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(new PositionDto(position.PositionId, position.PositionName));
    }

    public async Task<CatalogOperationResult<bool>> DeletePositionAsync(
        int positionId,
        CancellationToken cancellationToken = default)
    {
        var position = await db.Positions.FirstOrDefaultAsync(x => x.PositionId == positionId, cancellationToken);
        if (position is null)
        {
            return Failed<bool>(CatalogErrorCodes.PositionNotFound);
        }

        db.Positions.Remove(position);
        await db.SaveChangesAsync(cancellationToken);

        return Succeeded(true);
    }

    private async Task<bool> PositionNameTakenAsync(string name, int? exceptPositionId, CancellationToken cancellationToken)
    {
        var normalized = NormalizeKey(name);
        return await db.Positions
            .Where(x => exceptPositionId == null || x.PositionId != exceptPositionId)
            .AnyAsync(x => x.PositionName.Trim().ToLower() == normalized, cancellationToken);
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

        // Cascade soft-delete: năm học → học kỳ → lớp học phần.
        var semesters = await db.Semesters
            .Where(x => x.AcademicYearId == academicYearId).ToListAsync(cancellationToken);
        var semesterIds = semesters.Select(x => x.SemesterId).ToList();
        var sections = await db.CourseSections
            .Where(x => semesterIds.Contains(x.SemesterId)).ToListAsync(cancellationToken);
        foreach (var section in sections)
            db.CourseSections.Remove(section);
        foreach (var semester in semesters)
            db.Semesters.Remove(semester);

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

        // Cascade soft-delete: học kỳ → lớp học phần.
        var sections = await db.CourseSections
            .Where(x => x.SemesterId == semesterId).ToListAsync(cancellationToken);
        foreach (var section in sections)
            db.CourseSections.Remove(section);

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
            ClassSize = command.ClassSize,
            // Có mã giảng viên thì không giữ tên chưa xác định nữa.
            UnidentifiedLecturerName = command.LecturerId is null
                ? NullIfBlank(command.UnidentifiedLecturerName)
                : null
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
        section.UnidentifiedLecturerName = command.LecturerId is null
            ? NullIfBlank(command.UnidentifiedLecturerName)
            : null;
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

        // Cascade soft-delete: lớp học phần → bài khảo sát lớp.
        var sectionSurveys = await db.CourseSectionSurveys
            .Where(x => x.CourseSectionId == courseSectionId).ToListAsync(cancellationToken);
        foreach (var ss in sectionSurveys)
            db.CourseSectionSurveys.Remove(ss);

        db.CourseSections.Remove(section);
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(true);
    }

    public async Task<CatalogOperationResult<CourseSectionImportDto>> ImportCourseSectionsAsync(
        int semesterId,
        IReadOnlyList<ImportCourseSectionRowCommand> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count > MaximumImportRows)
        {
            return Failed<CourseSectionImportDto>(CatalogErrorCodes.ImportTooManyRows);
        }
        if (!await db.Semesters.AnyAsync(x => x.SemesterId == semesterId, cancellationToken))
        {
            return Failed<CourseSectionImportDto>(CatalogErrorCodes.SemesterNotFound);
        }

        // Các map tra ngược. Học phần và giảng viên được tạo giữa chừng cũng ghi
        // vào đây để dòng sau dùng lại, tránh tạo trùng trong cùng một tệp.
        var courseIdByCode = new Dictionary<string, int>();
        foreach (var course in await db.Courses.Select(x => new { x.CourseId, x.CourseCode }).ToListAsync(cancellationToken))
        {
            courseIdByCode[NormalizeKey(course.CourseCode)] = course.CourseId;
        }

        var departmentNameById = await db.Departments
            .ToDictionaryAsync(x => x.DepartmentId, x => x.DepartmentName, cancellationToken);
        var departmentIdByName = await LoadDepartmentIdByNameAsync(cancellationToken);
        var facultyIdByName = await LoadFacultyIdByNameAsync(cancellationToken);

        var lecturerIdByEmail = new Dictionary<string, int>();
        foreach (var lecturer in await db.Lecturers.Select(x => new { x.LecturerId, x.Email }).ToListAsync(cancellationToken))
        {
            if (!string.IsNullOrWhiteSpace(lecturer.Email))
            {
                lecturerIdByEmail[NormalizeKey(lecturer.Email)] = lecturer.LecturerId;
            }
        }

        // Giảng viên tạo tự động luôn mang chức vụ mặc định.
        var defaultPositionId = await db.Positions
            .Where(x => x.PositionName == CatalogDefaults.PositionName)
            .Select(x => (int?)x.PositionId)
            .FirstOrDefaultAsync(cancellationToken);

        // Trùng theo UNIQUE ("CourseId", "SemesterId", "SectionName").
        var existingSections = await db.CourseSections
            .Where(x => x.SemesterId == semesterId)
            .ToListAsync(cancellationToken);
        var sectionByKey = new Dictionary<string, CourseSection>();
        foreach (var section in existingSections)
        {
            sectionByKey[$"{section.CourseId}|{NormalizeKey(section.SectionName)}"] = section;
        }

        var seenInFile = new HashSet<string>();
        var items = new List<CatalogImportItemDto>(rows.Count);
        var unidentifiedLecturers = new List<UnidentifiedLecturerDto>();
        var createdSections = new List<CourseSection>();
        var createdCourseCount = 0;
        var createdLecturerCount = 0;
        var updatedSectionCount = 0;

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

            var classSizeText = row.ClassSize?.Trim() ?? string.Empty;
            var classSize = 0;
            if (classSizeText.Length > 0 && (!int.TryParse(classSizeText, out classSize) || classSize < 0))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionSizeInvalid));
                continue;
            }

            // Bộ môn: ưu tiên cột "Mã BM", trống thì mới tra theo tên. Bộ môn và
            // khoa viện không tự tạo — không khớp thì bỏ qua dòng.
            int? departmentId = null;
            var departmentCode = row.DepartmentCode?.Trim() ?? string.Empty;
            var departmentName = row.DepartmentName?.Trim() ?? string.Empty;
            if (departmentCode.Length > 0)
            {
                if (!int.TryParse(departmentCode, out var parsedDepartmentId) || parsedDepartmentId <= 0)
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.DepartmentCodeInvalid));
                    continue;
                }
                if (!departmentNameById.ContainsKey(parsedDepartmentId))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.DepartmentNotFound));
                    continue;
                }
                departmentId = parsedDepartmentId;
            }
            else if (departmentName.Length > 0)
            {
                if (!departmentIdByName.TryGetValue(NormalizeKey(departmentName), out var foundDepartment))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.DepartmentNotFound));
                    continue;
                }
                departmentId = foundDepartment;
            }

            int? facultyId = null;
            var facultyName = row.FacultyName?.Trim() ?? string.Empty;
            if (facultyName.Length > 0)
            {
                if (!facultyIdByName.TryGetValue(NormalizeKey(facultyName), out var foundFaculty))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.FacultyNotFound));
                    continue;
                }
                facultyId = foundFaculty;
            }

            // Học phần chưa có trong danh mục thì tạo luôn: mỗi năm chương trình
            // học lại bổ sung môn mới, không bắt người nhập phải sang trang học phần.
            if (!courseIdByCode.TryGetValue(NormalizeKey(courseCode), out var courseId))
            {
                var courseName = row.CourseName?.Trim() ?? string.Empty;
                if (courseName.Length == 0)
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseNameRequiredForAutoCreate));
                    continue;
                }

                var creditsText = row.Credits?.Trim() ?? string.Empty;
                var credits = 0;
                if (creditsText.Length > 0 && (!int.TryParse(creditsText, out credits) || credits < 0))
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseCreditsInvalid));
                    continue;
                }

                var course = new Course
                {
                    CourseCode = courseCode,
                    CourseName = courseName,
                    Credits = credits,
                    // Tệp lớp học phần không có cột loại học phần: để trống cho
                    // quản trị vào trang Học phần điền bắt buộc hay tự chọn sau.
                    CourseType = null,
                    DepartmentId = departmentId,
                    FacultyId = facultyId
                };
                db.Courses.Add(course);
                await db.SaveChangesAsync(cancellationToken);

                courseId = course.CourseId;
                courseIdByCode[NormalizeKey(courseCode)] = courseId;
                createdCourseCount++;
            }

            // Giảng viên. Email là khoá định danh (NOT NULL UNIQUE) nên chỉ dòng
            // có email mới gắn được vào bảng "Lecturers".
            int? lecturerId = null;
            string? unidentifiedLecturerName = null;
            var lecturerFullName = row.LecturerFullName?.Trim() ?? string.Empty;
            var lecturerEmail = row.LecturerEmail?.Trim() ?? string.Empty;

            if (lecturerEmail.Length > 0)
            {
                var emailKey = NormalizeKey(lecturerEmail);
                if (lecturerIdByEmail.TryGetValue(emailKey, out var foundLecturer))
                {
                    lecturerId = foundLecturer;
                }
                else
                {
                    if (lecturerFullName.Length == 0)
                    {
                        items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.LecturerNameRequired));
                        continue;
                    }

                    var lecturer = new Lecturer
                    {
                        FullName = lecturerFullName,
                        Email = lecturerEmail,
                        DepartmentId = departmentId,
                        FacultyId = facultyId,
                        PositionId = defaultPositionId
                    };
                    db.Lecturers.Add(lecturer);
                    await db.SaveChangesAsync(cancellationToken);

                    // Import lớp học phần cũng sinh giảng viên, nên cũng phải sinh
                    // tài khoản đi kèm — một luật duy nhất, không có ngoại lệ.
                    await EnsureUserForLecturerAsync(lecturer, cancellationToken);
                    await db.SaveChangesAsync(cancellationToken);

                    lecturerId = lecturer.LecturerId;
                    lecturerIdByEmail[emailKey] = lecturer.LecturerId;
                    createdLecturerCount++;
                }
            }
            else if (lecturerFullName.Length > 0)
            {
                // Thiếu email: vẫn tạo lớp học phần nhưng để trống mã giảng viên,
                // tên đưa vào cột chưa xác định và gom lại để xuất tệp báo lỗi.
                unidentifiedLecturerName = lecturerFullName;
                unidentifiedLecturers.Add(new UnidentifiedLecturerDto(
                    row.RowNumber,
                    lecturerFullName,
                    departmentId,
                    departmentId is { } deptId && departmentNameById.TryGetValue(deptId, out var deptName)
                        ? deptName
                        : NullIfBlank(departmentName),
                    NullIfBlank(facultyName),
                    courseCode,
                    sectionName));
            }

            var key = $"{courseId}|{NormalizeKey(sectionName)}";

            // Lớp đã tồn tại: chỉ cập nhật khi bản ghi cũ đang chờ xác định giảng
            // viên và dòng này đã tra ra được mã. Đây là đường quay lại sau khi
            // trưởng bộ môn bổ sung email rồi import lần nữa.
            if (sectionByKey.TryGetValue(key, out var existingSection))
            {
                if (existingSection.LecturerId is null && lecturerId is not null)
                {
                    existingSection.LecturerId = lecturerId;
                    existingSection.UnidentifiedLecturerName = null;
                    updatedSectionCount++;
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, true, null));
                }
                else
                {
                    items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionExists));
                }
                continue;
            }
            if (!seenInFile.Add(key))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, false, CatalogErrorCodes.CourseSectionDuplicateInFile));
                continue;
            }

            createdSections.Add(new CourseSection
            {
                CourseId = courseId,
                SemesterId = semesterId,
                LecturerId = lecturerId,
                UnidentifiedLecturerName = unidentifiedLecturerName,
                SectionName = sectionName,
                ClassSize = classSize
            });
            items.Add(new CatalogImportItemDto(row.RowNumber, sectionName, courseCode, true, null));
        }

        if (createdSections.Count > 0)
        {
            db.CourseSections.AddRange(createdSections);
        }
        // Lưu một lần cho cả bản ghi thêm mới lẫn bản ghi được cập nhật mã giảng viên.
        await db.SaveChangesAsync(cancellationToken);

        var succeededCount = createdSections.Count + updatedSectionCount;
        return Succeeded(new CourseSectionImportDto(
            rows.Count,
            succeededCount,
            rows.Count - succeededCount,
            items,
            createdCourseCount,
            createdLecturerCount,
            updatedSectionCount,
            unidentifiedLecturers));
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
                x.PhoneNumber,
                x.PositionId))
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
            // Validate ở trên đã chặn email rỗng nên chỗ này chắc chắn có giá trị.
            Email = command.Email!.Trim(),
            PhoneNumber = NullIfBlank(command.PhoneNumber),
            DepartmentId = command.DepartmentId,
            FacultyId = command.FacultyId,
            PositionId = command.PositionId
        };
        db.Lecturers.Add(lecturer);
        await db.SaveChangesAsync(cancellationToken);

        // Lưu xong mới có LecturerId thật để gắn vào tài khoản.
        await EnsureUserForLecturerAsync(lecturer, cancellationToken);
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
        lecturer.Email = command.Email!.Trim();
        lecturer.PhoneNumber = NullIfBlank(command.PhoneNumber);
        lecturer.DepartmentId = command.DepartmentId;
        lecturer.FacultyId = command.FacultyId;
        lecturer.PositionId = command.PositionId;

        // Bắt cả hai ca: giảng viên cũ chưa có tài khoản thì tạo bù, và đổi email
        // thì tài khoản chưa đăng nhập lần nào cũng đổi theo.
        await EnsureUserForLecturerAsync(lecturer, cancellationToken);
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

        if (await db.CourseSections.AnyAsync(x => x.LecturerId == lecturerId, cancellationToken))
        {
            return Failed<bool>(CatalogErrorCodes.LecturerInUse);
        }

        // Thứ tự ở đây có ý nghĩa. Phải khoá tài khoản, lưu, rồi GỠ nó khỏi change
        // tracker trước khi đánh dấu xoá giảng viên. Nếu bản ghi User còn nằm trong
        // tracker lúc Lecturer chuyển sang trạng thái xoá, EF sẽ tự set
        // Users.LecturerId = NULL và làm đứt liên kết vĩnh viễn — khôi phục giảng
        // viên xong sẽ còn lại một tài khoản mồ côi.
        var account = await db.Users
            .FirstOrDefaultAsync(x => x.LecturerId == lecturerId, cancellationToken);
        if (account is not null)
        {
            if (account.IsActive)
            {
                account.IsActive = false;
                account.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
            }
            db.Entry(account).State = EntityState.Detached;
        }

        db.Lecturers.Remove(lecturer);
        await db.SaveChangesAsync(cancellationToken);

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
        var positionIdByName = await LoadPositionIdByNameAsync(cancellationToken);
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

            // Email là bắt buộc, cùng luật với thêm tay: không có email thì không
            // tạo được giảng viên, và cũng không có gì để tạo tài khoản đăng nhập.
            if (email.Length == 0)
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.LecturerEmailRequired));
                continue;
            }

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

            // Cột chức vụ bỏ trống thì mặc định là "Giảng viên".
            var positionName = row.PositionName?.Trim() ?? string.Empty;
            if (positionName.Length == 0)
            {
                positionName = CatalogDefaults.PositionName;
            }
            if (!positionIdByName.TryGetValue(NormalizeKey(positionName), out var positionId))
            {
                items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, false, CatalogErrorCodes.PositionNotFound));
                continue;
            }

            created.Add(new Lecturer
            {
                FullName = fullName,
                Email = email,
                PhoneNumber = NullIfBlank(row.PhoneNumber),
                DepartmentId = departmentId,
                FacultyId = facultyId,
                PositionId = positionId
            });
            items.Add(new CatalogImportItemDto(row.RowNumber, fullName, facultyName, true, null));
        }

        if (created.Count > 0)
        {
            db.Lecturers.AddRange(created);
            await db.SaveChangesAsync(cancellationToken);

            // Lưu xong cả mẻ mới có LecturerId thật, giờ mới tạo tài khoản đi kèm.
            foreach (var lecturer in created)
            {
                await EnsureUserForLecturerAsync(lecturer, cancellationToken);
            }
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

        if (await db.CourseSections.AnyAsync(x => x.CourseId == courseId, cancellationToken)
            || await db.Courses.AnyAsync(x => x.PrerequisiteCourseId == courseId, cancellationToken))
        {
            // Học phần khác đang dùng làm tiên quyết, hoặc đang có lớp học phần.
            return Failed<bool>(CatalogErrorCodes.CourseInUse);
        }

        db.Courses.Remove(course);
        await db.SaveChangesAsync(cancellationToken);

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
            if (courseType is null && !string.IsNullOrWhiteSpace(row.CourseType))
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

    /// <summary>
    /// Bảo đảm mỗi giảng viên có đúng một tài khoản đăng nhập gắn kèm qua
    /// <c>Users.LecturerId</c>. Gọi SAU khi giảng viên đã được lưu, vì trước đó
    /// <c>LecturerId</c> vẫn là 0.
    /// <para>
    /// Cố ý KHÔNG tạo <c>UserProfiles</c>. Không có profile thì đăng nhập vẫn bị từ
    /// chối, nên thêm giảng viên không cấp quyền cho ai — cấp quyền vẫn là việc
    /// admin làm tay. Xem mục G1-b của congviec2.md.
    /// </para>
    /// </summary>
    private async Task EnsureUserForLecturerAsync(
        Lecturer lecturer,
        CancellationToken cancellationToken)
    {
        var email = lecturer.Email?.Trim() ?? string.Empty;
        // Phòng thủ: validate ở trên đã bắt buộc có email, nhưng dữ liệu cũ có thể
        // còn bản ghi rỗng. Không có email thì không có gì để tạo tài khoản.
        if (email.Length == 0) return;

        var normalizedEmail = email.ToLowerInvariant();
        var linked = await db.Users
            .FirstOrDefaultAsync(x => x.LecturerId == lecturer.LecturerId, cancellationToken);

        if (linked is not null)
        {
            // Đổi email giảng viên thì tài khoản phải đổi theo, nhưng CHỈ khi người
            // đó chưa từng đăng nhập. Đăng nhập rồi thì email là danh tính thật của
            // họ, sửa vào là khoá cửa của người ta. Bỏ qua nếu email mới đã thuộc về
            // tài khoản khác, để không vỡ UNIQUE index.
            if (linked.GoogleSubject is null
                && !string.Equals(linked.Email, email, StringComparison.OrdinalIgnoreCase)
                && !await db.Users.AnyAsync(
                    x => x.Id != linked.Id && x.Email.ToLower() == normalizedEmail,
                    cancellationToken))
            {
                linked.Email = email;
                linked.UpdatedAt = DateTime.UtcNow;
            }
            return;
        }

        var existing = await db.Users
            .FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail, cancellationToken);
        if (existing is not null)
        {
            // Đã có tài khoản trùng email, thường là admin tự tạo trước. Nối vào,
            // nhưng chỉ khi nó chưa thuộc về giảng viên nào — không kéo tài khoản
            // của người khác về.
            if (existing.LecturerId is null)
            {
                existing.LecturerId = lecturer.LecturerId;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            return;
        }

        var now = DateTime.UtcNow;
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = lecturer.FullName,
            GoogleSubject = null,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            LecturerId = lecturer.LecturerId
        });
    }

    /// <summary>
    /// Khoá hoặc mở lại tài khoản theo trạng thái của giảng viên. Xoá giảng viên là
    /// xoá mềm nên tài khoản cũng chỉ tắt <c>IsActive</c> chứ không xoá đi.
    /// </summary>
    private async Task SetLecturerAccountActiveAsync(
        int lecturerId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var linked = await db.Users
            .FirstOrDefaultAsync(x => x.LecturerId == lecturerId, cancellationToken);
        if (linked is null || linked.IsActive == isActive) return;

        linked.IsActive = isActive;
        linked.UpdatedAt = DateTime.UtcNow;
    }

    private static SemesterDto ToDto(Semester semester) =>
        new(semester.SemesterId, semester.SemesterName, semester.AcademicYearId);

    private static CourseSectionDto ToDto(CourseSection section) =>
        new(
            section.CourseSectionId,
            section.CourseId,
            section.SemesterId,
            section.LecturerId,
            section.SectionName,
            section.ClassSize,
            section.UnidentifiedLecturerName);

    private async Task<string?> ValidateAcademicYearAsync(
        int? academicYearId,
        SaveAcademicYearCommand command,
        CancellationToken cancellationToken)
    {
        var name = command.AcademicYearName?.Trim() ?? string.Empty;
        if (name.Length == 0) return CatalogErrorCodes.AcademicYearNameRequired;
        if (command.EndDate <= command.StartDate) return CatalogErrorCodes.AcademicYearRangeInvalid;

        var normalized = NormalizeKey(name);
        var exists = await db.AcademicYears
            .Where(x => academicYearId == null || x.AcademicYearId != academicYearId)
            .AnyAsync(x => x.AcademicYearName.Trim().ToLower() == normalized, cancellationToken);
        return exists ? CatalogErrorCodes.AcademicYearNameExists : null;
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

        var normalized = NormalizeKey(name);
        var exists = await db.Semesters
            .Where(x => x.AcademicYearId == command.AcademicYearId)
            .Where(x => semesterId == null || x.SemesterId != semesterId)
            .AnyAsync(x => x.SemesterName.Trim().ToLower() == normalized, cancellationToken);
        return exists ? CatalogErrorCodes.SemesterNameExists : null;
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

        var normalized = NormalizeKey(name);
        var exists = await db.CourseSections
            .Where(x => x.CourseId == command.CourseId && x.SemesterId == command.SemesterId)
            .Where(x => courseSectionId == null || x.CourseSectionId != courseSectionId)
            .AnyAsync(x => x.SectionName.Trim().ToLower() == normalized, cancellationToken);
        return exists ? CatalogErrorCodes.CourseSectionExists : null;
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
        lecturer.PhoneNumber,
        lecturer.PositionId);

    private async Task<string?> ValidateLecturerAsync(
        int? lecturerId,
        SaveLecturerCommand command,
        CancellationToken cancellationToken)
    {
        var fullName = command.FullName?.Trim() ?? string.Empty;
        var email = command.Email?.Trim() ?? string.Empty;

        if (fullName.Length == 0) return CatalogErrorCodes.LecturerNameRequired;

        // Email là bắt buộc. Cột "Lecturers"."Email" vừa NOT NULL vừa UNIQUE nên bỏ
        // trống là không lưu được: NULL vướng NOT NULL, còn chuỗi rỗng thì người thứ
        // hai đụng UNIQUE. Đây cũng là điều kiện để tạo tài khoản đăng nhập đi kèm.
        if (email.Length == 0) return CatalogErrorCodes.LecturerEmailRequired;

        var normalizedEmail = NormalizeKey(email);
        var exists = await db.Lecturers
            .Where(x => lecturerId == null || x.LecturerId != lecturerId)
            .AnyAsync(x => x.Email.Trim().ToLower() == normalizedEmail, cancellationToken);
        if (exists)
        {
            return CatalogErrorCodes.LecturerEmailExists;
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
        if (command.PositionId is { } positionId
            && !await db.Positions.AnyAsync(x => x.PositionId == positionId, cancellationToken))
        {
            return CatalogErrorCodes.PositionNotFound;
        }

        return null;
    }

    private async Task<Dictionary<string, int>> LoadPositionIdByNameAsync(CancellationToken cancellationToken)
    {
        var positions = await db.Positions
            .Select(x => new { x.PositionId, x.PositionName })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, int>();
        foreach (var position in positions)
        {
            map[NormalizeKey(position.PositionName)] = position.PositionId;
        }
        return map;
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

    /// <summary>
    /// Chấp nhận cả tiếng Anh lẫn tiếng Việt, trả về giá trị lưu xuống cột.
    /// Trả null khi bỏ trống hoặc không nhận ra giá trị.
    /// </summary>
    private static string? NormalizeCourseType(string? value)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Length == 0) return null;

        return NormalizeKey(text) switch
        {
            "required" or "bat buoc" or "bắt buộc" => "Required",
            "elective" or "tu chon" or "tự chọn" => "Elective",
            _ => null
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

        var normalizedCode = NormalizeKey(code);
        var exists = await db.Courses
            .Where(x => courseId == null || x.CourseId != courseId)
            .AnyAsync(x => x.CourseCode.Trim().ToLower() == normalizedCode, cancellationToken);
        if (exists)
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

    // --------------------------------------------------------------- Restore

    public async Task<CatalogOperationResult<FacultyDto>> RestoreFacultyAsync(
        int facultyId,
        CancellationToken cancellationToken = default)
    {
        var faculty = await db.Faculties.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.FacultyId == facultyId && x.IsDeleted, cancellationToken);
        if (faculty is null) return Failed<FacultyDto>(CatalogErrorCodes.FacultyNotFound);
        faculty.IsDeleted = false;
        faculty.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(new FacultyDto(faculty.FacultyId, faculty.FacultyName));
    }

    public async Task<CatalogOperationResult<DepartmentDto>> RestoreDepartmentAsync(
        int departmentId,
        CancellationToken cancellationToken = default)
    {
        var department = await db.Departments.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.DepartmentId == departmentId && x.IsDeleted, cancellationToken);
        if (department is null) return Failed<DepartmentDto>(CatalogErrorCodes.DepartmentNotFound);
        department.IsDeleted = false;
        department.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(new DepartmentDto(department.DepartmentId, department.DepartmentName, department.FacultyId));
    }

    public async Task<CatalogOperationResult<MajorDto>> RestoreMajorAsync(
        int majorId,
        CancellationToken cancellationToken = default)
    {
        var major = await db.Majors.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.MajorId == majorId && x.IsDeleted, cancellationToken);
        if (major is null) return Failed<MajorDto>(CatalogErrorCodes.MajorNotFound);
        major.IsDeleted = false;
        major.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(new MajorDto(major.MajorId, major.MajorName, major.FacultyId));
    }

    public async Task<CatalogOperationResult<AcademicYearDto>> RestoreAcademicYearAsync(
        int academicYearId,
        CancellationToken cancellationToken = default)
    {
        var year = await db.AcademicYears.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.AcademicYearId == academicYearId && x.IsDeleted, cancellationToken);
        if (year is null) return Failed<AcademicYearDto>(CatalogErrorCodes.AcademicYearNotFound);
        year.IsDeleted = false;
        year.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        var semesters = await db.Semesters.IgnoreQueryFilters()
            .Where(x => x.AcademicYearId == academicYearId)
            .OrderBy(x => x.SemesterId)
            .ToListAsync(cancellationToken);
        return Succeeded(new AcademicYearDto(
            year.AcademicYearId, year.AcademicYearName, year.StartDate, year.EndDate,
            semesters.Select(ToDto).ToList()));
    }

    public async Task<CatalogOperationResult<SemesterDto>> RestoreSemesterAsync(
        int semesterId,
        CancellationToken cancellationToken = default)
    {
        var semester = await db.Semesters.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.SemesterId == semesterId && x.IsDeleted, cancellationToken);
        if (semester is null) return Failed<SemesterDto>(CatalogErrorCodes.SemesterNotFound);
        semester.IsDeleted = false;
        semester.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(ToDto(semester));
    }

    public async Task<CatalogOperationResult<CourseSectionDto>> RestoreCourseSectionAsync(
        int courseSectionId,
        CancellationToken cancellationToken = default)
    {
        var section = await db.CourseSections.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CourseSectionId == courseSectionId && x.IsDeleted, cancellationToken);
        if (section is null) return Failed<CourseSectionDto>(CatalogErrorCodes.CourseSectionNotFound);
        section.IsDeleted = false;
        section.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(ToDto(section));
    }

    public async Task<CatalogOperationResult<LecturerDto>> RestoreLecturerAsync(
        int lecturerId,
        CancellationToken cancellationToken = default)
    {
        var lecturer = await db.Lecturers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.LecturerId == lecturerId && x.IsDeleted, cancellationToken);
        if (lecturer is null) return Failed<LecturerDto>(CatalogErrorCodes.LecturerNotFound);
        lecturer.IsDeleted = false;
        lecturer.DeletedAt = null;
        // Khôi phục giảng viên thì mở lại tài khoản, và tạo bù nếu chưa từng có.
        await SetLecturerAccountActiveAsync(lecturerId, isActive: true, cancellationToken);
        await EnsureUserForLecturerAsync(lecturer, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(ToDto(lecturer));
    }

    public async Task<CatalogOperationResult<CourseDto>> RestoreCourseAsync(
        int courseId,
        CancellationToken cancellationToken = default)
    {
        var course = await db.Courses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.CourseId == courseId && x.IsDeleted, cancellationToken);
        if (course is null) return Failed<CourseDto>(CatalogErrorCodes.CourseNotFound);
        course.IsDeleted = false;
        course.DeletedAt = null;
        await db.SaveChangesAsync(cancellationToken);
        return Succeeded(ToDto(course));
    }

    private Task<bool> FacultyExistsAsync(int facultyId, CancellationToken cancellationToken) =>
        db.Faculties.AnyAsync(x => x.FacultyId == facultyId, cancellationToken);

    private async Task<bool> FacultyNameTakenAsync(string name, int? exceptFacultyId, CancellationToken cancellationToken)
    {
        var normalized = NormalizeKey(name);
        return await db.Faculties
            .Where(x => exceptFacultyId == null || x.FacultyId != exceptFacultyId)
            .AnyAsync(x => x.FacultyName.Trim().ToLower() == normalized, cancellationToken);
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
