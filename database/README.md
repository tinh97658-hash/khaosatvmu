# Dump dữ liệu khaosatvmu

`khaosatvmu_dump.sql` là bản dump đầy đủ (schema + toàn bộ dữ liệu) của database
`khaosatvmu`, xuất bằng `pg_dump` từ PostgreSQL 15.

Bản dump có sẵn `DROP ... IF EXISTS` ở đầu file nên nạp đè lên database đang có
cũng được, không cần xoá database thủ công. File cũng chứa bảng
`__EFMigrationsHistory`, nên sau khi nạp thì EF Core sẽ coi như đã chạy đủ
migration, không chạy lại.

## Bản dump này để trống phần điểm

Cố ý bỏ hai chỗ, để người nạp về tự bấm nút **Tính lại điểm** trên trang *Bảng
dữ liệu khảo sát* và xem chức năng chạy từ đầu:

| Chỗ để trống | Trạng thái trong dump |
|---|---|
| Cột `AverageScore` của `CourseSectionSurveys` | Toàn bộ 500 dòng đều `NULL` |
| Bảng `CourseSectionSurveyQuestionScores` | Có cấu trúc bảng, không có dòng dữ liệu nào |

Phiếu trả lời thì còn nguyên (15.039 phiếu, 451.170 câu trả lời), nên bấm nút
là tính ra được ngay. Kết quả đúng phải là: điểm tổng hợp toàn đợt **3.70**,
**1.528** phiếu lỗi, và bảng điểm từng câu có **14.500** dòng.

Trước khi bấm nút, bảng vẫn hiện đủ sĩ số, số phiếu, tỷ lệ phản hồi, phiếu lỗi
và số ý kiến mở — chỉ các cột điểm (C1, C2…, Điểm tổng hợp, Câu yếu nhất) là để
trống.

## Cách nạp

### 1. Chuẩn bị

Sau khi pull code về:

```bash
cp .env.example .env          # sửa lại nếu cần (POSTGRES_PORT, mật khẩu...)
docker compose up -d db
```

Chờ container `khaosatvmu_db` khởi động xong.

### 2. Nạp dump

Chạy ở thư mục gốc của repo.

**Windows PowerShell:**

```powershell
Get-Content database\khaosatvmu_dump.sql -Raw -Encoding UTF8 | docker exec -i khaosatvmu_db psql -U postgres -d khaosatvmu
```

**Git Bash / macOS / Linux:**

```bash
docker exec -i khaosatvmu_db psql -U postgres -d khaosatvmu < database/khaosatvmu_dump.sql
```

**Nếu cài PostgreSQL trực tiếp trên máy (không dùng Docker):**

```bash
psql -h localhost -p 5432 -U postgres -d khaosatvmu -f database/khaosatvmu_dump.sql
```

> Cổng mặc định là `5432`. Nếu trong `.env` đặt `POSTGRES_PORT` khác thì đổi `-p`
> cho khớp.

### 3. Kiểm tra

```bash
docker exec -it khaosatvmu_db psql -U postgres -d khaosatvmu -c "\dt"
docker exec -it khaosatvmu_db psql -U postgres -d khaosatvmu -c "SELECT count(*) FROM \"Lecturers\";"
```

Nếu chưa có database `khaosatvmu` thì tạo trước:

```bash
docker exec -it khaosatvmu_db psql -U postgres -c "CREATE DATABASE khaosatvmu;"
```

## Số dòng trong bản dump

| Bảng | Số dòng | | Bảng | Số dòng |
|---|---:|---|---|---:|
| AcademicYears | 2 | | Permissions | 13 |
| AnswerScaleOptions | 7 | | Positions | 8 |
| AnswerScales | 3 | | RolePermissions | 27 |
| AuthAuditLogs | 28 | | Roles | 4 |
| AuthSessions | 27 | | SemesterSurveys | 1 |
| ChangeAuditLogs | 1.786 | | Semesters | 6 |
| CourseSectionSurveyQuestionScores | **0** | | SurveyQuestions | 60 |
| CourseSectionSurveys | 500 | | SurveyResponseAnswers | 451.170 |
| CourseSections | 500 | | SurveyResponses | 15.039 |
| Courses | 486 | | SurveyTemplates | 2 |
| Curricula | 0 | | UserProfiles | 3 |
| CurriculumCourses | 0 | | Users | 1 |
| Departments | 60 | | __EFMigrationsHistory | 25 |
| Faculties | 15 | | | |
| Lecturers | 112 | | | |
| Majors | 0 | | | |

## Tạo lại bản dump khi dữ liệu thay đổi

```bash
docker exec khaosatvmu_db pg_dump -U postgres -d khaosatvmu \
  --clean --if-exists --no-owner --no-privileges --encoding=UTF8 \
  --exclude-table-data='public."CourseSectionSurveyQuestionScores"' \
  > database/khaosatvmu_dump.sql
```

`--exclude-table-data` giữ cấu trúc bảng nhưng bỏ dữ liệu — bảng phải còn thì
nút tính điểm mới có chỗ ghi vào.

Sau đó xoá trắng cột `AverageScore` trong khối `COPY` của `CourseSectionSurveys`
(đổi giá trị thành `\N`). Làm ngay trong file dump chứ đừng `UPDATE` trên
database đang chạy, để dữ liệu gốc còn nguyên.

Cuối cùng, nếu bản `pg_dump` có sinh 2 dòng `\restrict` / `\unrestrict` ở đầu và
cuối file thì xoá đi (pg_dump 15.14 trở lên tự thêm vào, các bản `psql` cũ hơn
không hiểu lệnh này và sẽ báo lỗi khi nạp). Bản dump hiện tại không có 2 dòng đó.

### Kiểm tra bản dump trước khi đưa cho người khác

Nạp thử vào một database riêng rồi xoá đi, đừng nạp đè lên database đang dùng:

```bash
docker exec khaosatvmu_db psql -U postgres -c "CREATE DATABASE dump_test;"
docker exec -i khaosatvmu_db psql -U postgres -d dump_test -v ON_ERROR_STOP=1 -q \
  < database/khaosatvmu_dump.sql
docker exec khaosatvmu_db psql -U postgres -d dump_test -c \
  'SELECT count(*), count("AverageScore") FROM "CourseSectionSurveys";'
docker exec khaosatvmu_db psql -U postgres -c "DROP DATABASE dump_test;"
```

Kết quả đúng là `500 | 0`: đủ 500 lớp, không lớp nào có sẵn điểm.
