# Danh gia hieu nang va ke hoach nang cap cho 2.000 lop

Ngay lap: 2026-08-21

## 1. Muc tieu va ket luan nhanh

Tai trong muc tieu cua mot dot khao sat:

- 2.000 lop.
- 40 sinh vien/lop.
- 30 cau hoi/phieu.
- 80.000 phieu tra loi neu ty le tham gia dat 100%.
- 2.400.000 dong cau tra loi chi tiet.
- Khoang 58.000 dong diem tong hop theo lop/cau hoi neu co 29 cau duoc cham diem va 1 cau attention check.

Ket luan:

1. PostgreSQL khong gap van de ve dung luong o quy mo nay. Du lieu chuan dang lua chon du kien chi khoang 200-250 MB cho mot dot day du; nen cap toi thieu 1 GB dia cho moi dot de co cho cho WAL, index, VACUUM, backup va tang truong.
2. Luong nop phieu hien tai ve co ban dung: kiem tra du lieu, tinh diem va ghi response + answers trong mot `SaveChangesAsync`. Tuy nhien chua co idempotency nen retry sau timeout co the tao phieu trung.
3. Logic tinh diem tong hop dung huong vi chay `GROUP BY` trong PostgreSQL thay vi dua du lieu ve API. Can bo sung mot moc thoi gian nhat quan va khoa tranh hai tac vu tinh diem chay dong thoi.
4. Diem chan production hien tai la bao cao phan tich cau hoi: endpoint nap toan bo answers hop le vao RAM va loc lai theo tung cau. O quy mo muc tieu, no co the nap 2,4 trieu entity va thuc hien xap xi 72 trieu lan kiem tra, gay GC lon, timeout hoac OOM.
5. Trang thong ke tra ve toan bo 2.000 lop cung gan 29 diem/cau trong mot response va render tat ca o client. DB van xu ly duoc, nhung JSON va DOM se lon; can phan trang/ao hoa truoc production.
6. Gioi han 10 lan nop/phut theo IP se chan nham sinh vien dung chung NAT cua truong. Dong thoi cau hinh forwarded headers hien tai chi an toan neu API khong bao gio bi truy cap truc tiep.

Khong nen dua he thong len production quy mo 2.000 lop truoc khi hoan thanh cac muc P0 tai muc 8.

## 2. Pham vi danh gia

Da doc va doi chieu cac thanh phan sau:

- Schema va migration cua `SurveyResponses`, `SurveyResponseAnswers`, `CourseSectionSurveys`, `CourseSectionSurveyQuestionScores`.
- Luong mo phieu, bat dau phieu va nop phieu trong `EfSurveyService`.
- Logic tinh lai diem theo dot trong `RecalculateSemesterSurveyScoresAsync`.
- Logic bao cao trong `EfReportService`, dac biet la bao cao phan tich cau hoi.
- Trang thong ke frontend va cach du lieu duoc render.
- Cau hinh Npgsql, rate limiting, thread pool, migration luc khoi dong.
- PostgreSQL trong `docker-compose.yml` va reverse proxy Nginx.
- Du lieu PostgreSQL dang co sau khi restore dump.

Chua co ket qua benchmark dong thoi thuc te. Moi con so thoi gian o quy mo muc tieu phai duoc xac nhan bang ke hoach test tai muc 7.

## 3. Baseline do tren database hien tai

### 3.1. Du lieu va kich thuoc

| Thanh phan | So dong | Tong kich thuoc | Heap | Index | Kich thuoc dong trung binh |
| --- | ---: | ---: | ---: | ---: | ---: |
| Toan database | - | 46 MB | - | - | - |
| `SurveyResponses` | 15.039 | 1.808 kB | 1.144 kB | 624 kB | 66,7 byte |
| `SurveyResponseAnswers` | 451.170 | 32 MB | 19 MB | 13 MB | 34,0 byte |
| `CourseSectionSurveyQuestionScores` | 14.500 | 1.368 kB | 744 kB | 592 kB | 44 byte |

Du lieu baseline gom 500 lop/phan lop khao sat, 15.039 response, trong do 1.528 response khong hop le. Moi lop co 29 cau duoc tong hop diem.

### 3.2. Thoi gian truy van tong hop baseline

Do bang `EXPLAIN ANALYZE` tren may local, du lieu da nam trong cache:

| Tac vu | Khoi luong | Thoi gian quan sat |
| --- | ---: | ---: |
| Tong hop response theo lop | 15.039 response / 500 lop | 9,35 ms |
| Tong hop answer theo lop va cau hoi | 451.170 answers / 14.500 nhom | 247,7 ms |

Day la ket qua hot-cache cua cau `SELECT/GROUP BY`, khong bao gom day du chi phi `DELETE`, `INSERT`, WAL, network hay canh tranh voi luong nop phieu. Khong dung ket qua nay lam SLO production.

### 3.3. Cau hinh hien tai

- PostgreSQL 15 Alpine.
- `max_connections=350`.
- `shared_buffers=1GB`.
- `effective_cache_size=3GB`.
- `work_mem=16MB`.
- Pool Npgsql local dang cho phep toi da 300 connection cho mot API instance.
- API dat `ThreadPool.SetMinThreads(300, 300)`.
- API tu chay migration khi khoi dong.
- Cache du lieu phieu cong khai la `IMemoryCache`, TTL 15 phut, rieng cho tung API instance.
- Chua co distributed cache, durable background job, tracing, metrics PostgreSQL hay load-test script trong repo.

## 4. Uoc luong database tai 2.000 lop

### 4.1. Cong thuc

Voi ty le tham gia `r`:

```text
responses = 2.000 * 40 * r
answers   = responses * 30
scores    = 2.000 * so_cau_duoc_cham_diem
```

| Ty le tham gia | Responses | Answers | Diem tong hop neu 29 cau cham diem |
| ---: | ---: | ---: | ---: |
| 50% | 40.000 | 1.200.000 | 58.000 |
| 75% | 60.000 | 1.800.000 | 58.000 |
| 90% | 72.000 | 2.160.000 | 58.000 |
| 100% | 80.000 | 2.400.000 | 58.000 |

Bang diem tong hop co kich thuoc phu thuoc so lop va so cau hoi, khong phu thuoc truc tiep vao ty le tham gia.

### 4.2. Ngoai suy tu database hien tai

He so tang answers/responses so voi baseline lan luot xap xi 5,32 lan; so lop va dong diem tong hop tang 4 lan.

| Thanh phan | Uoc luong 100% tham gia |
| --- | ---: |
| `SurveyResponseAnswers` gom heap + index | ~170 MB |
| `SurveyResponses` gom heap + index | ~9,4 MB |
| `CourseSectionSurveyQuestionScores` | ~5,3 MB |
| Lop, dot theo lop, danh muc va cac bang lien quan | ~10-30 MB |
| Tong live data chuan, chua tinh bloat/WAL/backup | ~195-215 MB |
| Ke hoach co 20% bloat/headroom trong database | ~235-260 MB |

Vi vay nen lap ngan sach nhu sau:

- Toi thieu 1 GB dia trong cho moi dot dang hoat dong, bao gom live data, WAL tam thoi, VACUUM va mot ban backup gan nhat.
- Toi thieu 10 GB cho database o giai doan dau neu can giu nhieu hoc ky; theo doi toc do tang thuc te va dat canh bao o 60%, 75%, 85%.
- Backup nam ngoai volume database va phai duoc thu restore dinh ky.

### 4.3. Truong hop cau tra loi text

`AnswerValue` cho phep toi da 2.000 ky tu. Neu 2,4 trieu answers deu gan 2 KB thi rieng payload tho co the dat 4,8 GB truoc overhead/TOAST. Day khong phai kich ban binh thuong cua phieu 30 cau lua chon.

Can do rieng:

- So cau text toi da trong mot template.
- Do dai p50/p95/p99 cua cau text.
- Ty le response co comment.
- Chinh sach luu tru va an danh du lieu text.

Dung luong khong nen duoc uoc luong chi bang so cau hoi neu product cho phep nhieu cau text dai.

## 5. Danh gia logic hien tai

### 5.1. Mo phieu va cache

Trang cong khai dung cache 15 phut, giup giam cac truy van danh muc lap lai. Tuy nhien:

- `IMemoryCache` khong chia se giua cac replica.
- Lan miss dong thoi cung mot token co the tao cache stampede va chay nhieu bo truy van giong nhau.
- Du lieu phieu da mo co the tre toi 15 phut sau khi admin thay doi.

Huong xu ly:

- Template da phat hanh phai immutable/versioned, nhờ do cache co the song dai va score luon tham chieu dung phien ban.
- Dung `HybridCache`/Redis hoac co che single-flight neu chay nhieu replica.
- Cache ca ket qua token khong ton tai trong thoi gian ngan de han che spam.
- Do cache-hit ratio truoc khi them Redis; khong mac dinh Redis la bat buoc neu chi co mot API instance.

### 5.2. Nop phieu

Diem tot:

- Gioi han template toi da 30 cau.
- Validate answer va attention check truoc khi ghi.
- Tinh diem response mot lan.
- Ghi response va 30 answers trong cung mot unit of work.
- Frontend khoa nut trong luc dang submit va luu ban nhap local.

Rui ro:

- Khong co idempotency key. Neu database commit thanh cong nhung client timeout, nguoi dung submit lai se tao response moi.
- Moi response tao 31 dong insert; quy mo 80.000 response la binh thuong voi PostgreSQL, nhung burst can duoc gioi han theo kha nang pool/DB.
- Attention-check metadata van duoc doc trong luong submit; can nam trong snapshot/cache cua template.
- Gioi han 10 submit/phut theo IP khong phu hop khi nhieu sinh vien chung NAT.

Nang cap:

- Client tao UUID cho moi lan bat dau phieu; server luu `SubmissionKey` voi unique constraint va tra lai ket qua cu khi retry.
- Rate limit theo ket hop `link token + submission key + IP prefix`, kem mot global concurrency limiter cho endpoint ghi.
- Khong dung PII hay danh tinh sinh vien lam idempotency neu yeu cau nghiep vu la an danh.
- Chi tin `X-Forwarded-For` tu reverse proxy da khai bao; chan truy cap truc tiep vao API.

### 5.3. Tinh diem tong hop

Logic hien tai co hai lenh chinh trong transaction:

1. Cap nhat tong so response, so hop le va diem trung binh theo lop.
2. Xoa va tao lai diem theo lop/cau hoi bang aggregate SQL.

Day la cach tinh phu hop cho 2,4 trieu answers vi du lieu duoc aggregate trong PostgreSQL. Hai van de can sua:

- `Read Committed` cap snapshot moi cho moi statement. Response den giua hai statement co the lam tong diem lop va diem tung cau dua tren hai tap du lieu khac nhau.
- Hai admin cung bam tinh diem co the cung xoa/chen bang tong hop, dan den lock, loi unique key hoac ket qua kho du doan.

Nang cap:

- Tao `calculatedAt` va them dieu kien `SubmittedAt <= calculatedAt` cho moi cau aggregate; luu cutoff cung ket qua. Lua chon khac la transaction `Repeatable Read`, nhung cutoff ro nghia nghiep vu hon.
- Dung PostgreSQL advisory transaction lock theo `semesterSurveyId`, hoac bang job co unique running state.
- Chay tinh diem qua background job ben vung; API tra job ID va trang thai thay vi giu HTTP request lau.
- Neu van chay dong bo, dat command timeout rieng cho tac vu nay va khong phu thuoc timeout ngan dung chung.
- `DELETE + INSERT` 58.000 dong van chap nhan duoc neu tinh khong thuong xuyen. Chi doi sang staging/upsert khi benchmark cho thay WAL/lock la van de.

### 5.4. Bao cao

| Luong | Danh gia | Ly do |
| --- | --- | --- |
| Phan tich mot lop | Dat o quy mo muc tieu | Khoang 40 x 30 = 1.200 answers/lop |
| Danh sach 2.000 lop | Can cai thien | API tra tat ca, frontend moi phan trang local |
| Cau hoi yeu | Kha tot | Aggregate theo SQL, chi dua counts gon ve API |
| Phan tich cau hoi toan dot | Khong dat | Nap toi 2,4 trieu answers vao RAM va loc lai 30 lan |
| Thong ke diem theo lop/cau | Can cai thien | Dung bang aggregate, nhung payload/render toi ~58.000 score cells |

Thay doi bat buoc cho phan tich cau hoi:

```sql
SELECT
    a."QuestionId",
    a."AnswerValue",
    COUNT(*) AS "AnswerCount"
FROM "SurveyResponseAnswers" a
JOIN "SurveyResponses" r ON r."Id" = a."ResponseId"
JOIN "CourseSectionSurveys" css ON css."Id" = r."CourseSectionSurveyId"
WHERE css."SemesterSurveyId" = @semesterSurveyId
  AND r."IsValid" = TRUE
GROUP BY a."QuestionId", a."AnswerValue";
```

API chi nen materialize tap ket qua aggregate. Cau text tu do can endpoint/pagination rieng, khong tron hang trieu chuoi vao bao cao tong quan.

### 5.5. Kieu du lieu answer

Dap an lua chon dang luu trong `varchar` va cast `AnswerValue::numeric` khi tinh diem. Cach nay chay duoc o 2,4 trieu dong nhung co ba bat loi:

- Ton dung luong va CPU cast hon kieu so.
- Rang buoc tinh hop le nam chu yeu o application.
- Mot gia tri text sai co the lam hong ca batch aggregate.

Khong can migration gap chi de dat muc tieu 2.000 lop. O pha P2 nen tach:

- `SelectedValue smallint null` cho option/scale.
- `TextValue text null` cho free text.
- `CHECK` dam bao chi mot kieu co gia tri theo loai cau hoi.

### 5.6. Frontend

- Khong phat hien polling dinh ky, do do mot tab mo khong tu dong tao tai lien tuc.
- Trang thong ke can server-side paging theo lop va chi tai chi tiet cau hoi khi mo row/tab.
- Bang danh sach can server-side filter/sort/page khi du lieu vuot 2.000 lop hoac co nhieu hoc ky.
- Can hien thi `calculatedAt`/do tuoi du lieu de phan biet tien do live va diem da chot.

## 6. Du kien khi dua len production

### 6.1. Tai thong thuong

Voi cache am, submit trai deu va bao cao dung aggregate, he thong co the phuc vu quy mo 2.000 lop tren mot PostgreSQL tam trung. Dung luong va so dong khong phai gioi han.

Cau hinh khoi dau de benchmark, khong phai cam ket sizing:

- PostgreSQL: 4 vCPU, 8 GB RAM, SSD/NVMe, managed service neu co the.
- API: 2 replica, moi replica 2 vCPU va 2-4 GB RAM.
- Pool: khoang 30-60 connection/replica, tinh tong cung job/migration/admin nho hon `max_connections` voi it nhat 20% du phong.
- Nginx/load balancer: TLS, request size/timeouts ro rang, chi cho API nhan forwarded headers tu proxy nay.

`work_mem=16MB` la ngan sach cho tung sort/hash node va tung parallel worker, khong phai cho toan DB. Khong nhan so nay voi 350 connection ma khong doi chieu RAM thuc te. `Max Pool Size=300` tren moi replica cung khong the di cung `max_connections=350` khi scale ngang.

### 6.2. Burst khi sinh vien nop cung luc

Rui ro lon nhat la connection pool saturation, WAL burst va retry trung lap. Can backpressure chu dong:

- Global concurrency limiter tren submit.
- Queue ngan; qua nguong tra `429`/`503` kem `Retry-After`.
- Idempotency de retry an toan.
- Khong retry dong loat; client jitter 1-5 giay.

Khong dat concurrency limit 800 chi vi so nguoi dung la 800. So truy van dong thoi phai duoc chon tu benchmark va connection budget.

### 6.3. Bao cao va tinh diem cung luc

Neu giu code hien tai, endpoint phan tich cau hoi co the chiem hang tram MB den hon 1 GB managed memory, gay full GC/OOM va anh huong ca submit. Sau khi aggregate trong SQL, tai API giam xuong mot tap counts nho.

Batch tinh diem se scan answers cua dot. Hot-cache co the o muc vai giay tai 2,4 trieu dong, nhung cold-cache va DB dang ghi can benchmark. Nen chay sau khi dong dot hoac tren queue uu tien thap, co lock va cutoff.

### 6.4. Trien khai va van hanh

Hien tai API tu chay migration khi khoi dong. Voi nhieu replica, day la rui ro tranh chap va lam kho rollback. Production can:

- Migration job rieng, chay mot lan truoc rollout.
- Backup/restore point truoc migration thay doi du lieu.
- Readiness khac liveness; readiness kiem tra kha nang phuc vu nhung khong tao tai DB lon.
- Rolling deploy, resource limits va graceful shutdown.
- Backup hang ngay + PITR/WAL neu RPO yeu cau; dien tap restore thay vi chi kiem tra file backup ton tai.
- `index.html` co `Cache-Control: no-cache`; asset Vite co hash duoc cache immutable.

## 7. Ke hoach danh gia hieu nang cu the

### Buoc 1 - Tao moi truong perf tach biet

- Dung cung major version PostgreSQL, schema, extension va cau hinh gan production.
- Khong chay tren database dev hien tai.
- Tao du lieu xac dinh duoc: 2.000 lop, 80.000 responses, 2.400.000 answers, 10% invalid, 5% co comment; them kich ban text p95 thuc te.
- Nap du lieu bang `COPY`/generator chuyen dung, sau do `ANALYZE`.
- Luu seed va manifest so dong de co the lap lai.

### Buoc 2 - Bo sung quan sat

API can co:

- Request rate, p50/p95/p99 latency, status code theo endpoint.
- Active/queued request, Npgsql pool in-use/wait, timeout.
- CPU, RSS, managed heap, allocation rate, GC pause, thread-pool queue.
- Cache hit/miss va thoi gian factory.
- So submit moi, duplicate replay va loi validate.

PostgreSQL can co:

- CPU, RAM, IOPS, disk latency, WAL rate, connections.
- Lock waits, deadlocks, temporary files, buffer cache hit.
- `pg_stat_statements` cho total time, mean/p95 gan dung, rows va calls.
- Slow-query log co nguong phu hop; khong log noi dung cau tra loi nhay cam.

### Buoc 3 - Benchmark database don le

Chay moi truy van voi cold cache va warm cache, lap lai toi thieu 10 lan:

1. Mo phieu theo token.
2. Insert mot response + 30 answers.
3. Tinh aggregate response theo lop.
4. Tinh aggregate answer theo lop/cau.
5. Bao cao phan tich cau hoi da viet lai.
6. Danh sach thong ke 2.000 lop co paging.

Voi moi query luu `EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS)`. Chi them index khi plan/so buffer doc chung minh nhu cau. Ung vien can kiem tra, khong tu dong them, la index `(CourseSectionSurveyId, SubmittedAt)` cho cutoff.

### Buoc 4 - Load test API

Dung k6 hoac cong cu tuong duong, token va submission key rieng cho tung virtual user:

| Kich ban | Mo ta | Muc dich |
| --- | --- | --- |
| Public read | Ramp 0 -> 1.000 VU trong 10 phut, giu 15 phut | Cache hit, stampede, pool |
| Submit binh thuong | 100 VU, think time 5-20 giay | SLO thuong ngay |
| Submit burst | 300 roi 1.000 VU cung bat dau trong 30-60 giay | Backpressure, WAL, retry |
| Mixed | 70% read, 25% submit, 5% admin/report | Tai gan production |
| Recalculate | Chay tinh diem trong khi 100 VU submit | Lock, cutoff, latency |
| Soak | 4 gio; neu dat thi 24 gio | Leak, bloat, pool/GC on dinh |

Chay it nhat voi 1 API instance va 2 API replicas. Mot lan test retry lai cung idempotency key de xac nhan chi co mot response.

### Buoc 5 - SLO va nguong dat de xuat

Do trong mang production-like, khong tinh thoi gian render cua trinh duyet vao API latency:

| Chi so | Nguong dat ban dau |
| --- | ---: |
| Public GET warm-cache p95 / p99 | < 200 ms / < 500 ms |
| Bat dau phieu p95 | < 250 ms |
| Submit p95 binh thuong / burst | < 750 ms / < 2 s |
| Loi 5xx/timeout ngoai test fault | < 0,1% |
| Phieu mat hoac trung do retry cung key | 0 |
| Bao cao tong quan warm-cache p95 | < 500 ms |
| Bao cao cold sau toi uu p95 | < 3 s |
| Job tinh diem 2,4 trieu answers | < 30 s |
| DB CPU duy tri | < 70-75% |
| Pool wait p95 | < 100 ms |
| Deadlock / OOM / unbounded queue | 0 |

SLO cuoi cung phai duoc product chap nhan. Neu kich ban burst 1.000 VU vuot nguong nhung backpressure dung, khong mat/trung du lieu va hoi phuc nhanh, co the chap nhan voi UX retry ro rang.

### Buoc 6 - Failure va recovery test

- Restart mot API replica trong luc submit.
- Ngat network sau khi DB commit de test idempotency.
- Restart/failover PostgreSQL neu ha tang ho tro.
- Day pool den nguong va xac nhan request bi tu choi co kiem soat.
- Kill job tinh diem giua chung, chay lai va xac nhan ket qua nhat quan.
- Restore backup vao database moi, doi chieu row count va checksum mau.

## 8. Phuong an nang cap

### P0 - Bat buoc truoc production

| Ma | Cong viec | Ket qua nghiem thu | Uoc luong |
| --- | --- | --- | ---: |
| P0-01 | Viet lai question-analysis bang SQL aggregate | Khong materialize raw answers; p95 cold < 3 s tai 2,4 trieu dong | 1-2 ngay |
| P0-02 | Them submission idempotency | Cung key submit 10 lan chi tao 1 response | 2-3 ngay |
| P0-03 | Sua rate limit va trusted proxy | Khong chan ca NAT; IP khong the gia mao khi vao qua edge | 1-2 ngay |
| P0-04 | Them cutoff + advisory lock cho recalculate | Hai job khong chay dong thoi; moi bang dung cung snapshot nghiep vu | 1-2 ngay |
| P0-05 | Phan trang/ao hoa trang thong ke | Khong render 58.000 cell cung luc; payload co gioi han | 2-4 ngay |
| P0-06 | Khoa/version template da phat hanh | Thay doi sau launch khong lam sai score lich su | 2-4 ngay |
| P0-07 | Metrics, tracing toi thieu va load test | Co report k6 + dashboard; dat cac gate muc 7 | 3-5 ngay |

Tong P0 tham khao: 12-22 ngay cong, co the song song mot phan giua backend, frontend va platform.

### P1 - Production hardening

| Ma | Cong viec | Muc dich |
| --- | --- | --- |
| P1-01 | Dua recalculate vao durable background job | Khong giu HTTP request, retry va theo doi trang thai |
| P1-02 | Cache single-flight/HybridCache, Redis khi co nhieu replica | Giam stampede va duplicate cache work |
| P1-03 | Chot connection budget moi replica | Khong vuot gioi han DB khi scale ngang |
| P1-04 | Tach migration khoi API startup | Trien khai/rollback co kiem soat |
| P1-05 | Backup + PITR + restore drill | Dat RPO/RTO da thong nhat |
| P1-06 | Server-side page/filter/sort cho report | On dinh khi tang nhieu hoc ky/lop |
| P1-07 | Nginx/edge hardening va no-cache HTML | Bao mat header, IP dung, khong stale frontend |
| P1-08 | Bo/ha `SetMinThreads(300)` theo so do | Tranh tang thread va context switch khong can thiet |

### P2 - Toi uu dai han, chi lam khi so do chung minh

- Tach `SelectedValue` va `TextValue`, them database constraints.
- Partition responses/answers theo hoc ky/nam khi du lieu lich su va VACUUM/backup bat dau kho quan ly. 2,4 trieu answers chua phai ly do du de partition.
- Tao run-level aggregate/materialized view cho bao cao duoc doc thuong xuyen.
- Read replica cho analytics neu report canh tranh ro rang voi submit.
- Luu tru lanh/an danh/xoa du lieu theo retention policy.
- Chuyen khoa chinh response sang `bigint` truoc khi tong du lieu lich su tien gan gioi han `int`; khong cap bach o 80.000 response/dot.

## 9. Thu tu trien khai de xuat

1. Chot tinh dung: template version, idempotency, cutoff va khoa job.
2. Loai bo duong doc raw 2,4 trieu answers; phan trang UI/API.
3. Bo sung metrics va generator/load test.
4. Chay baseline tren cau hinh production-like; luu report va query plans.
5. Chot DB/API sizing, pool, rate limit va backpressure tu ket qua do.
6. Hoan thien deploy migration, backup/restore, trusted proxy va runbook.
7. Chay mixed, burst, soak, failure test; chi release khi dat gate.
8. Canary rollout, theo doi it nhat mot chu ky cao diem, sau do moi tang traffic.

## 10. Production release gate

Chi cho phep go-live khi tat ca dieu sau co bang chung:

- P0-01 den P0-07 hoan thanh va co test tu dong phu hop.
- Dataset perf dung 2.000 lop/80.000 responses/2.400.000 answers.
- Mixed test, burst test va soak test dat SLO hoac co ngoai le duoc ky chap nhan.
- Khong co duplicate khi retry, khong co sai lech snapshot diem, khong co concurrent recalculate.
- API RSS on dinh; khong co OOM/full-GC lap lai.
- Connection budget khong vuot DB max trong moi kich ban replica/job.
- Restore drill thanh cong va do duoc RPO/RTO.
- Dashboard/canh bao cho error rate, latency, pool, CPU, disk, WAL va DB lock.
- Co rollback plan cho app va migration; canary co nguong dung ro rang.

## 11. File code lien quan khi thuc hien

- `src/Backend/Infrastructure/Reports/EfReportService.cs`: viet lai query bao cao, server paging.
- `src/Backend/Infrastructure/Surveys/EfSurveyService.cs`: idempotency, cache, cutoff va khoa tinh diem.
- `src/Backend/API/Program.cs`: rate limiter, forwarded headers, pool/thread/runtime va migration startup.
- `src/Backend/API/Surveys/SurveyEndpoints.cs`: contract submit va job recalculate.
- `src/Frontend/src/pages/PublicSurveyPage.tsx`: tao/giu idempotency key, retry co jitter.
- Trang thong ke survey frontend: paging/virtualization va hien `calculatedAt`.
- `docker-compose.yml`: cau hinh DB theo RAM/CPU that, metrics va service production neu tiep tuc dung Compose.
- `deploy/nginx/default.conf`: proxy trust, timeout, security headers va no-cache cho HTML.

## 12. Quyet dinh kien truc

Voi 2.000 lop, khong can doi database, microservice hay partition ngay. Phuong an co chi phi/rui ro thap nhat la giu modular monolith + PostgreSQL, sua cac truy van doc sai cach, them tinh nhat quan/idempotency/backpressure va do tren dataset dung kich thuoc.

Chi scale kien truc sau khi metrics chi ra gioi han cu the. O quy mo nay, mot PostgreSQL duoc sizing dung va 2 API replica la diem khoi dau hop ly; tinh dung du lieu va kha nang van hanh quan trong hon viec tang so service.
