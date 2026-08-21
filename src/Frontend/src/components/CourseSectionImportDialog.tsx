import { useId, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  downloadCourseSectionImportTemplate,
  downloadUnidentifiedLecturerFile,
  parseCourseSectionImportFile,
  CourseSectionImportFileError,
  type CourseSectionImportFileErrorCode,
  type ImportCourseSectionRow,
} from '../utils/courseSectionImportExcel';
import { ApiError } from '../services/apiClient';
import { catalogApi, catalogErrorMessage, type CourseSectionImportResponse } from '../services/catalogApi';
import type { Department, Lecturer } from '../types';
import { Modal } from './Modal';

interface CourseSectionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lecturers: Lecturer[];
  /** Học kỳ đang chọn, hiển thị để người dùng biết import vào đâu. */
  semesterLabel: string;
  onImport: (rows: ImportCourseSectionRow[]) => Promise<CourseSectionImportResponse>;
}

const fileErrorMessages: Record<CourseSectionImportFileErrorCode, string> = {
  FILE_TYPE: 'Chỉ chấp nhận tệp Excel có định dạng .xlsx.',
  FILE_SIZE: 'Tệp Excel không được lớn hơn 5 MB.',
  FILE_EMPTY: 'Tệp Excel không có dữ liệu.',
  CODE_HEADER_MISSING: 'Không tìm thấy cột "Mã HP" trong hàng tiêu đề.',
  SECTION_HEADER_MISSING: 'Không tìm thấy cột "Nhóm" trong hàng tiêu đề.',
  NO_DATA_ROWS: 'Tệp Excel chưa có dòng lớp học phần nào.',
  TOO_MANY_ROWS: 'Mỗi lần chỉ được import tối đa 500 lớp học phần.',
  READ_FAILED: 'Không thể đọc tệp Excel. Hãy kiểm tra tệp không bị hỏng hoặc đặt mật khẩu.',
};

export function CourseSectionImportDialog({
  isOpen,
  onClose,
  lecturers,
  semesterLabel,
  onImport,
}: CourseSectionImportDialogProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportCourseSectionRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<CourseSectionImportResponse | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloadingUnidentified, setDownloadingUnidentified] = useState(false);
  const [unidentifiedError, setUnidentifiedError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturerResolutionByRow, setLecturerResolutionByRow] = useState<Record<number, string>>({});
  const [, setCollisionModeByKey] = useState<Record<string, 'single' | 'advanced'>>({});

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    setFileName('');
    setRows([]);
    setParseError(null);
    setRequestError(null);
    setResult(null);
    setUnidentifiedError(null);
    setDepartments([]);
    setLecturerResolutionByRow({});
    setCollisionModeByKey({});
  };

  const handleClose = () => {
    if (parsing || importing) return;
    reset();
    onClose();
  };

  const handleFileChange = async (file?: File) => {
    reset();
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    try {
      const parsedRows = await parseCourseSectionImportFile(file);
      setRows(parsedRows);
      try {
        setDepartments(await catalogApi.departments());
      } catch {
        // Vẫn cho xử lý nhóm người mới; danh sách ứng viên hiện có sẽ để trống.
        setDepartments([]);
      }
    } catch (error) {
      setParseError(
        error instanceof CourseSectionImportFileError
          ? fileErrorMessages[error.code]
          : fileErrorMessages.READ_FAILED
      );
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0 || unresolvedCollisionRowCount > 0) return;
    setImporting(true);
    setRequestError(null);
    try {
      const resolvedDecisionByRow = new Map<
        number,
        { resolvedLecturerId?: number; provisionalLecturerKey?: string }
      >();
      const resolvedRows = rows.map((row) => {
        const resolution = lecturerResolutionByRow[row.rowNumber];
        if (!resolution) return row;
        if (resolution.startsWith('existing:')) {
          const decision = {
            resolvedLecturerId: Number(resolution.slice('existing:'.length)),
          };
          resolvedDecisionByRow.set(row.rowNumber, decision);
          return { ...row, ...decision };
        }
        const anchorRowNumber = Number(resolution.slice('anchor:'.length));
        const decision = anchorRowNumber === row.rowNumber
          ? { provisionalLecturerKey: `row-anchor:${row.rowNumber}` }
          : resolvedDecisionByRow.get(anchorRowNumber);
        if (!decision) return row;
        resolvedDecisionByRow.set(row.rowNumber, decision);
        return { ...row, ...decision };
      });
      setResult(await onImport(resolvedRows));
    } catch (error) {
      setRequestError(
        error instanceof ApiError ? catalogErrorMessage(error.errorCode) : catalogErrorMessage(null)
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setTemplateError(null);
    try {
      await downloadCourseSectionImportTemplate();
    } catch {
      setTemplateError('Không thể tạo tệp mẫu. Hãy thử lại.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDownloadUnidentified = async () => {
    if (!result || result.unidentifiedLecturers.length === 0) return;
    setDownloadingUnidentified(true);
    setUnidentifiedError(null);
    try {
      await downloadUnidentifiedLecturerFile(result.unidentifiedLecturers);
    } catch {
      setUnidentifiedError('Không thể tạo tệp giảng viên thiếu email. Hãy thử lại.');
    } finally {
      setDownloadingUnidentified(false);
    }
  };

  const failedItems = result?.items.filter((item) => !item.succeeded) ?? [];
  const unidentifiedLecturers = result?.unidentifiedLecturers ?? [];
  // Số bộ môn = số sheet trong tệp xuất ra.
  const unidentifiedDepartmentCount = new Set(
    unidentifiedLecturers.map((lecturer) => lecturer.departmentName ?? 'Chưa rõ bộ môn')
  ).size;

  const collisionGroups = useMemo(() => {
    const normalize = (value: string) => value.trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
    const departmentIdOf = (row: ImportCourseSectionRow): number | null => {
      const code = Number(row.departmentCode);
      if (row.departmentCode.trim() && Number.isInteger(code) && code > 0) return code;
      const departmentName = normalize(row.departmentName);
      return departments.find((item) => normalize(item.departmentName) === departmentName)?.departmentId ?? null;
    };
    const groups = new Map<string, ImportCourseSectionRow[]>();

    for (const row of rows) {
      if (row.lecturerEmail.trim() || !row.lecturerFullName.trim()) continue;
      const departmentId = departmentIdOf(row);
      const unitKey = departmentId === null
        ? `${normalize(row.departmentName)}|${normalize(row.facultyName)}`
        : String(departmentId);
      const key = `${normalize(row.lecturerFullName)}|${unitKey}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    return [...groups.entries()].flatMap(([key, groupRows]) => {
      const first = groupRows[0];
      const departmentId = departmentIdOf(first);
      const candidates = lecturers.filter((lecturer) =>
        normalize(lecturer.fullName) === normalize(first.lecturerFullName)
        && (departmentId === null || lecturer.departmentId === departmentId));

      // Một dòng duy nhất vẫn phải xác nhận nếu đã có người cùng tên trong DB:
      // không email/mã GV thì không thể tự biết đây là người cũ hay người mới.
      return groupRows.length > 1 || candidates.length > 0
        ? [{ key, rows: groupRows, candidates }]
        : [];
    });
  }, [departments, lecturers, rows]);

  const collisionRowNumbers = useMemo(
    () => new Set(collisionGroups.flatMap((group) => group.rows.map((row) => row.rowNumber))),
    [collisionGroups],
  );
  const unresolvedCollisionRowCount = [...collisionRowNumbers]
    .filter((rowNumber) => !lecturerResolutionByRow[rowNumber])
    .length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import lớp học phần từ Excel" size="fullscreen">
      <div className="admin-import-dialog" aria-busy={parsing}>
        <div className="admin-form-intro">
          <FileSpreadsheet aria-hidden="true" />
          <p>
            Hàng đầu tiên cần có cột <strong>Mã HP</strong> và <strong>Nhóm</strong>. Học phần chưa
            có trong danh mục sẽ được <strong>tạo tự động</strong> từ cột Học phần và TCHT. Giảng
            viên tra theo <strong>Email</strong>: chưa có thì tạo mới với chức vụ Giảng viên. Nếu bỏ
            trống email, hệ thống vẫn tạo hoặc tái sử dụng giảng viên tạm có mã nội bộ để lớp được
            thống kê; email có thể bổ sung sau. Bộ môn tra theo{' '}
            <strong>Mã BM</strong>, trống mới tra theo tên. Tối đa 500 dòng.
          </p>
        </div>

        <div className="catalog-context-band">
          Import vào học kỳ: <strong>{semesterLabel}</strong>
        </div>

        {!result && (
          <>
            <div className="import-template-row">
              <span>Chưa có tệp đúng định dạng? Tải tệp mẫu rồi điền dữ liệu vào.</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleDownloadTemplate()}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {downloadingTemplate ? 'Đang tạo tệp...' : 'Tải file mẫu'}
              </button>
            </div>

            {templateError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{templateError}</span>
              </div>
            )}

            <label className="admin-import-picker" htmlFor={inputId}>
              <Upload aria-hidden="true" />
              <span>
                <strong>{fileName || 'Chọn tệp Excel'}</strong>
                <small>Định dạng .xlsx, dung lượng tối đa 5 MB</small>
              </span>
              <span className="btn btn-secondary">Chọn file</span>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={parsing}
                onChange={(event) => void handleFileChange(event.target.files?.[0])}
              />
            </label>

            {parsing && (
              <div className="admin-import-state" role="status">
                <LoaderCircle className="auth-spin" aria-hidden="true" />
                Đang đọc tệp Excel...
              </div>
            )}

            {parseError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{parseError}</span>
              </div>
            )}

            {requestError && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{requestError}</span>
              </div>
            )}

            {collisionGroups.length > 0 && (
              <section className="admin-import-preview" aria-label="Xử lý giảng viên trùng tên">
                <header>
                  <strong>Bước bắt buộc: xác nhận giảng viên không có email</strong>
                  <span>
                    {unresolvedCollisionRowCount > 0
                      ? `Còn ${unresolvedCollisionRowCount} lớp chưa chọn`
                      : 'Đã xác nhận đủ, có thể import'}
                  </span>
                </header>
                <div className="lecturer-collision-guide" role="region" aria-label="Hướng dẫn xử lý">
                  <div className="lecturer-collision-guide__intro">
                    <CircleAlert aria-hidden="true" />
                    <div>
                      <strong>Hệ thống không yêu cầu bạn đoán người này là ai</strong>
                      <p>
                        Các dòng dưới đây không có email và đang trùng tên với người trong danh mục,
                        hoặc trùng tên với dòng khác trong file. Hệ thống không thể tự biết đây là người
                        cũ hay một người mới chỉ trùng tên. Bạn cần chọn <strong>“Đã có”</strong> nếu đúng
                        người cũ; nếu không, hãy chọn <strong>“Tạo hồ sơ mới”</strong>.
                      </p>
                    </div>
                  </div>
                  <ol className="lecturer-collision-steps">
                    <li>Đọc từng lớp ở cột <strong>Mã HP</strong> và <strong>Nhóm lớp</strong>.</li>
                    <li>
                      Ở lớp xuất hiện đầu tiên, chọn <strong>“Tạo hồ sơ mới, lấy lớp này làm mốc”</strong>
                      nếu người đó chưa có trong danh mục.
                    </li>
                    <li>
                      Với các lớp phía sau: nếu cùng người, chọn <strong>“Cùng giảng viên với lớp…”</strong>;
                      nếu là người khác chỉ trùng tên, chọn <strong>“Là giảng viên khác…”</strong>.
                    </li>
                    <li>
                      Nếu đúng là người đã có trong hệ thống, chọn mục bắt đầu bằng <strong>“Đã có”</strong>
                      và kiểm tra mã <strong>GV-xxxxxx</strong>. Hệ thống sẽ không tự chọn thay bạn.
                    </li>
                    <li>
                      Nếu bạn <strong>không biết các lớp có cùng người hay không</strong>, hãy dừng lại
                      và hỏi bộ môn phụ trách; không chọn ngẫu nhiên vì báo cáo sẽ đếm sai.
                    </li>
                  </ol>
                  <div className="lecturer-collision-example">
                    <strong>Ví dụ:</strong> tại KT01 chọn “Tạo hồ sơ mới, lấy KT01 làm mốc”. Nếu KT02
                    cũng do người đó dạy, tại KT02 chọn “Cùng giảng viên với KT01”. Nếu KT03 là một
                    người khác chỉ trùng tên, tại KT03 chọn “Là giảng viên khác, lấy KT03 làm mốc”.
                  </div>
                </div>
                <div className="admin-import-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Giảng viên</th>
                        <th>Bộ môn</th>
                        <th>Mã HP</th>
                        <th>Học phần</th>
                        <th>Nhóm lớp</th>
                        <th>So với các lớp phía trên, đây là giảng viên nào?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collisionGroups.flatMap((group) => group.rows.map((row, rowIndex) => (
                        <tr key={`collision-${row.rowNumber}`}>
                          <td>{row.rowNumber}</td>
                          <td><strong>{row.lecturerFullName}</strong></td>
                          <td>
                            {row.departmentName
                              ? `${row.departmentName}${row.departmentCode ? ` (${row.departmentCode})` : ''}`
                              : row.departmentCode || 'Chưa rõ'}
                          </td>
                          <td>{row.courseCode}</td>
                          <td>{row.courseName || '—'}</td>
                          <td>{row.sectionName}</td>
                          <td>
                            <select
                              aria-label={`Gán giảng viên cho dòng ${row.rowNumber}`}
                              value={lecturerResolutionByRow[row.rowNumber] ?? ''}
                              onChange={(event) => setLecturerResolutionByRow((current) => ({
                                ...current,
                                [row.rowNumber]: event.target.value,
                              }))}
                            >
                              <option value="">
                                {rowIndex === 0
                                  ? '— Chọn người đã có hoặc tạo hồ sơ làm mốc —'
                                  : '— Chọn cùng người hay là một người khác —'}
                              </option>
                              {group.candidates.map((lecturer) => (
                                <option
                                  key={`existing-${lecturer.lecturerId}`}
                                  value={`existing:${lecturer.lecturerId}`}
                                >
                                  Đã có: {lecturer.fullName} · GV-{String(lecturer.lecturerId).padStart(6, '0')}
                                  {lecturer.email ? ` · ${lecturer.email}` : ' · thiếu email'}
                                </option>
                              ))}
                              {group.rows.slice(0, rowIndex + 1).map((anchorRow) => (
                                <option
                                  key={`anchor-${group.key}-${anchorRow.rowNumber}`}
                                  value={`anchor:${anchorRow.rowNumber}`}
                                >
                                  {anchorRow.rowNumber === row.rowNumber
                                    ? `Là giảng viên khác · tạo hồ sơ mới, lấy ${row.courseCode} / ${row.sectionName} làm mốc`
                                    : `Cùng giảng viên với dòng ${anchorRow.rowNumber} · ${anchorRow.courseCode} / ${anchorRow.sectionName}`}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))) }
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {rows.length > 0 && (
              <section className="admin-import-preview" aria-label="Xem trước dữ liệu import">
                <header>
                  <strong>{rows.length} lớp học phần sẵn sàng import</strong>
                  <span>Hiển thị {Math.min(rows.length, 8)} dòng đầu</span>
                </header>
                <div className="admin-import-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Mã HP</th>
                        <th>Học phần</th>
                        <th>Nhóm</th>
                        <th>Sĩ số</th>
                        <th>Bộ môn</th>
                        <th>Giảng viên</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>
                            {row.courseCode || (
                              <span className="admin-import-invalid">Thiếu mã</span>
                            )}
                          </td>
                          <td>{row.courseName || '—'}</td>
                          <td>
                            {row.sectionName || (
                              <span className="admin-import-invalid">Thiếu nhóm</span>
                            )}
                          </td>
                          <td>{row.classSize || '0'}</td>
                          <td>{row.departmentCode || row.departmentName || '—'}</td>
                          <td>{row.lecturerFullName || '—'}</td>
                          <td>
                            {row.lecturerEmail || (
                              <span className="admin-import-default">Tạo/gắn GV tạm</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {result && (
          <section className="admin-import-result" aria-live="polite">
            <div className={`admin-import-summary ${result.skippedCount > 0 ? 'has-warnings' : ''}`}>
              {result.skippedCount > 0 ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              <div>
                <strong>Hoàn tất import {result.totalCount} dòng</strong>
                <span>
                  {result.createdCount} đã thêm, {result.skippedCount} bị bỏ qua
                  {result.updatedSectionCount > 0 &&
                    `, ${result.updatedSectionCount} lớp được cập nhật giảng viên`}
                </span>
              </div>
            </div>

            {(result.createdCourseCount > 0 || result.createdLecturerCount > 0) && (
              <div className="admin-alert" role="status">
                <CircleAlert aria-hidden="true" />
                <span>
                  Đã tạo tự động {result.createdCourseCount} học phần và{' '}
                  {result.createdLecturerCount} giảng viên chưa có trong danh mục.
                </span>
              </div>
            )}

            {unidentifiedLecturers.length > 0 && (
              <section className="admin-import-unidentified">
                <div className="admin-alert admin-alert--warning" role="status">
                  <CircleAlert aria-hidden="true" />
                  <span>
                    <strong>{unidentifiedLecturers.length} dòng giảng viên thiếu email</strong>, thuộc{' '}
                    {unidentifiedDepartmentCount} bộ môn. Hệ thống đã tạo hoặc gắn mã nội bộ khi
                    xác định được duy nhất; nếu có nhiều người trùng cả tên lẫn đơn vị, quản trị cần
                    chọn đúng người trên màn hình lớp học phần. Có thể tải tệp dưới đây để bổ sung email.
                  </span>
                </div>

                <div className="import-template-row">
                  <span>Tệp gồm {unidentifiedDepartmentCount} sheet, mỗi bộ môn một sheet.</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void handleDownloadUnidentified()}
                    disabled={downloadingUnidentified}
                  >
                    {downloadingUnidentified ? (
                      <LoaderCircle className="auth-spin" aria-hidden="true" />
                    ) : (
                      <Download aria-hidden="true" />
                    )}
                    {downloadingUnidentified
                      ? 'Đang tạo tệp...'
                      : 'Tải file giảng viên thiếu email'}
                  </button>
                </div>

                {unidentifiedError && (
                  <div className="admin-alert" role="alert">
                    <CircleAlert aria-hidden="true" />
                    <span>{unidentifiedError}</span>
                  </div>
                )}

                <div className="admin-import-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Họ và tên</th>
                        <th>Bộ môn</th>
                        <th>Khoa</th>
                        <th>Mã HP</th>
                        <th>Nhóm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unidentifiedLecturers.map((lecturer) => (
                        <tr key={`${lecturer.rowNumber}-${lecturer.fullName}`}>
                          <td>{lecturer.rowNumber}</td>
                          <td>{lecturer.fullName}</td>
                          <td>{lecturer.departmentName || '—'}</td>
                          <td>{lecturer.facultyName || '—'}</td>
                          <td>{lecturer.courseCode}</td>
                          <td>{lecturer.sectionName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {failedItems.length > 0 && (
              <div className="admin-import-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Tên lớp</th>
                      <th>Mã học phần</th>
                      <th>Lý do bỏ qua</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedItems.map((item) => (
                      <tr key={`${item.rowNumber}-${item.name}`}>
                        <td>{item.rowNumber}</td>
                        <td>{item.name || 'Không có'}</td>
                        <td>{item.facultyName || 'Không có'}</td>
                        <td>{catalogErrorMessage(item.errorCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="modal-footer admin-inline-footer">
          {result ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Import file khác
              </button>
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Đóng
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={parsing || importing}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleImport()}
                disabled={rows.length === 0 || parsing || importing || unresolvedCollisionRowCount > 0}
              >
                {importing ? (
                  <LoaderCircle className="auth-spin" aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                {importing ? 'Đang lưu...' : `Import ${rows.length || ''} lớp học phần`}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
