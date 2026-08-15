import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  FileClock,
  FileUp,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShieldPlus,
  UserCheck,
  UsersRound,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../components/Modal';
import { UserImportDialog } from '../components/UserImportDialog';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import type {
  AdminAuditLog,
  AdminPage,
  AdminProfile,
  AdminRole,
  AdminUser,
  RolePermissionMatrix,
  SaveAdminProfile,
} from '../types';
import '../styles/auth-admin.css';

type AdminView = 'users' | 'audit' | 'permissions';
type StatusConfirmation =
  | { type: 'user'; item: AdminUser }
  | { type: 'profile'; item: AdminProfile }
  | null;

const emptyProfile: SaveAdminProfile = {
  name: '',
  code: '',
  roleId: '',
  organizationUnitCode: null,
  organizationUnitName: null,
  isDefault: false,
};

const eventNames: Record<string, string> = {
  ADMIN_USER_CREATED: 'Tạo tài khoản',
  ADMIN_USER_IMPORTED: 'Import tài khoản',
  ADMIN_USER_ENABLED: 'Kích hoạt tài khoản',
  ADMIN_USER_DISABLED: 'Vô hiệu tài khoản',
  ADMIN_PROFILE_CREATED: 'Tạo profile',
  ADMIN_PROFILE_UPDATED: 'Cập nhật profile',
  ADMIN_PROFILE_ENABLED: 'Kích hoạt profile',
  ADMIN_PROFILE_DISABLED: 'Vô hiệu profile',
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGOUT: 'Đăng xuất',
  PROFILE_SWITCHED: 'Chuyển profile',
  GOOGLE_LOGIN_PROFILE_REQUIRED: 'Yêu cầu chọn profile',
  GOOGLE_LOGIN_NO_PROFILE: 'Đăng nhập không có profile',
};

const errorMessages: Record<string, string> = {
  ADMIN_INVALID_REQUEST: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các trường.',
  ADMIN_USER_EMAIL_EXISTS: 'Email này đã có trong hệ thống.',
  ADMIN_CANNOT_DISABLE_SELF: 'Bạn không thể vô hiệu chính tài khoản đang sử dụng.',
  ADMIN_PROFILE_CODE_EXISTS: 'Mã profile đã tồn tại.',
  ADMIN_PROFILE_ASSIGNMENT_EXISTS: 'Người dùng đã có role trong cùng phạm vi đơn vị.',
  ADMIN_CANNOT_MODIFY_ACTIVE_PROFILE: 'Không thể đổi role hoặc vô hiệu profile đang sử dụng.',
  AUTH_CSRF_INVALID: 'Phiên bảo mật đã thay đổi. Vui lòng thử lại.',
};

function formatDate(value: string | null): string {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    return errorMessages[error.errorCode] ?? 'Không thể hoàn tất thao tác quản trị.';
  }
  return 'Không thể kết nối tới máy chủ.';
}

export function UsersAdminPage() {
  const [view, setView] = useState<AdminView>('users');
  const [usersPage, setUsersPage] = useState<AdminPage<AdminUser> | null>(null);
  const [auditPage, setAuditPage] = useState<AdminPage<AdminAuditLog> | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [page, setPage] = useState(1);
  const [auditPageNumber, setAuditPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isImportUsersOpen, setIsImportUsersOpen] = useState(false);
  const [newUser, setNewUser] = useState({ displayName: '', email: '' });
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingProfile, setEditingProfile] = useState<AdminProfile | null>(null);
  const [profileForm, setProfileForm] = useState<SaveAdminProfile>(emptyProfile);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState<StatusConfirmation>(null);
  const [permissionMatrix, setPermissionMatrix] = useState<RolePermissionMatrix[]>([]);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  const activeFilter = statusFilter === 'all' ? null : statusFilter === 'active';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.users(search, activeFilter, page);
      setUsersPage(result);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, page, search]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAuditPage(await adminApi.auditLogs(auditPageNumber));
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }, [auditPageNumber]);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPermissionMatrix(await adminApi.rolePermissions());
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      setRoles(await adminApi.roles());
    } catch (requestError) {
      setError(messageFrom(requestError));
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (view !== 'users') return;
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers, view]);

  useEffect(() => {
    if (view === 'audit') void loadAudit();
  }, [loadAudit, view]);

  useEffect(() => {
    if (view === 'permissions') void loadPermissions();
  }, [loadPermissions, view]);

  const handleTogglePermission = (roleId: string, permissionId: string) => {
    setPermissionMatrix((prev) =>
      prev.map((role) => {
        if (role.roleId !== roleId) return role;
        return {
          ...role,
          permissions: role.permissions.map((p) =>
            p.permissionId === permissionId ? { ...p, isGranted: !p.isGranted } : p,
          ),
        };
      }),
    );
  };

  const handleSaveRolePermissions = async (roleId: string) => {
    const role = permissionMatrix.find((r) => r.roleId === roleId);
    if (!role) return;
    setSavingRoleId(roleId);
    setError(null);
    try {
      const grants = role.permissions.map((p) => ({
        permissionId: p.permissionId,
        isGranted: p.isGranted,
      }));
      await adminApi.updateRolePermissions(roleId, grants);
      toast.success('Đã cập nhật phân quyền', { description: `Vai trò: ${role.roleName}` });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSavingRoleId(null);
    }
  };


  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((usersPage?.totalCount ?? 0) / (usersPage?.pageSize ?? 20))),
    [usersPage],
  );
  const auditTotalPages = useMemo(
    () => Math.max(1, Math.ceil((auditPage?.totalCount ?? 0) / (auditPage?.pageSize ?? 30))),
    [auditPage],
  );

  const replaceUser = (user: AdminUser) => {
    setUsersPage((current) => current
      ? { ...current, items: current.items.map((item) => item.id === user.id ? user : item) }
      : current);
    setSelectedUser((current) => current?.id === user.id ? user : current);
  };

  const replaceProfile = (profile: AdminProfile) => {
    const update = (user: AdminUser): AdminUser => ({
      ...user,
      profiles: user.profiles.some((item) => item.id === profile.id)
        ? user.profiles.map((item) => item.id === profile.id ? profile : item)
        : [...user.profiles, profile],
    });
    setUsersPage((current) => current
      ? { ...current, items: current.items.map((user) => user.id === selectedUser?.id ? update(user) : user) }
      : current);
    setSelectedUser((current) => current ? update(current) : current);
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.createUser(newUser.email, newUser.displayName);
      setNewUser({ displayName: '', email: '' });
      setIsAddUserOpen(false);
      setPage(1);
      await loadUsers();
      toast.success('Đã thêm người dùng', { description: newUser.email });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleUserStatus = async (user: AdminUser) => {
    setBusy(true);
    setError(null);
    try {
      replaceUser(await adminApi.setUserStatus(user.id, !user.isActive));
      setStatusConfirmation(null);
      toast.success(user.isActive ? 'Đã vô hiệu tài khoản' : 'Đã kích hoạt tài khoản', {
        description: user.email,
      });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const openProfileForm = (profile?: AdminProfile) => {
    setEditingProfile(profile ?? null);
    setProfileForm(profile ? {
      name: profile.name,
      code: profile.code,
      roleId: profile.roleId,
      organizationUnitCode: profile.organizationUnitCode,
      organizationUnitName: profile.organizationUnitName,
      isDefault: profile.isDefault,
    } : { ...emptyProfile, roleId: roles[0]?.id ?? '' });
    setShowProfileForm(true);
    setError(null);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) return;
    setBusy(true);
    setError(null);
    try {
      const wasEditing = editingProfile !== null;
      const saved = editingProfile
        ? await adminApi.updateProfile(selectedUser.id, editingProfile.id, profileForm)
        : await adminApi.createProfile(selectedUser.id, profileForm);
      replaceProfile(saved);
      setShowProfileForm(false);
      setEditingProfile(null);
      toast.success(wasEditing ? 'Đã cập nhật hồ sơ' : 'Đã thêm hồ sơ', {
        description: saved.name,
      });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleProfileStatus = async (profile: AdminProfile) => {
    if (!selectedUser) return;
    setBusy(true);
    setError(null);
    try {
      replaceProfile(await adminApi.setProfileStatus(selectedUser.id, profile.id, !profile.isActive));
      setStatusConfirmation(null);
      toast.success(profile.isActive ? 'Đã vô hiệu hồ sơ' : 'Đã kích hoạt hồ sơ', {
        description: profile.name,
      });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const retryCurrentView = () => {
    if (roles.length === 0) void loadRoles();
    if (view === 'users') {
      void loadUsers();
    } else if (view === 'audit') {
      void loadAudit();
    } else {
      void loadPermissions();
    }
  };

  const hasUserFilters = search.trim().length > 0 || statusFilter !== 'all';
  const confirmationItem = statusConfirmation?.item;
  const confirmationIsActive = confirmationItem?.isActive ?? false;

  return (
    <div className="admin-users-page">
      <div className="admin-view-tabs-bar">
        <div className="admin-view-tabs" role="tablist" aria-label="Chế độ quản trị người dùng">
          <button
            id="admin-users-tab"
            type="button"
            className={view === 'users' ? 'active' : ''}
            onClick={() => { setView('users'); setError(null); }}
            role="tab"
            aria-selected={view === 'users'}
            aria-controls="admin-users-panel"
          >
            <UsersRound aria-hidden="true" />
            Tài khoản và hồ sơ
          </button>
          <button
            id="admin-audit-tab"
            type="button"
            className={view === 'audit' ? 'active' : ''}
            onClick={() => { setView('audit'); setError(null); }}
            role="tab"
            aria-selected={view === 'audit'}
            aria-controls="admin-audit-panel"
          >
            <FileClock aria-hidden="true" />
            Nhật ký hệ thống
          </button>
          <button
            id="admin-permissions-tab"
            type="button"
            className={view === 'permissions' ? 'active' : ''}
            onClick={() => { setView('permissions'); setError(null); }}
            role="tab"
            aria-selected={view === 'permissions'}
            aria-controls="admin-permissions-panel"
          >
            <ShieldCheck aria-hidden="true" />
            Phân quyền Module
          </button>
        </div>

        {view === 'users' && (
          <div className="admin-view-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setError(null); setIsImportUsersOpen(true); }}
            >
              <FileUp aria-hidden="true" />
              Import Excel
            </button>
            <button
              type="button"
              className="btn btn-primary admin-primary-action"
              onClick={() => { setError(null); setIsAddUserOpen(true); }}
            >
              <Plus aria-hidden="true" />
              Thêm người dùng
            </button>
          </div>
        )}
      </div>

      {error && !isAddUserOpen && !selectedUser && !statusConfirmation && (
        <div className="admin-alert admin-alert-action" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={retryCurrentView} disabled={loading}>
            <RefreshCw aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {view === 'users' ? (
        <section
          id="admin-users-panel"
          className="admin-table-section"
          role="tabpanel"
          aria-labelledby="admin-users-tab"
        >
          <div className="table-toolbar admin-table-toolbar">
            <label className="search-box admin-search-box">
              <Search aria-hidden="true" />
              <span className="admin-visually-hidden">Tìm người dùng</span>
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Tìm theo email hoặc họ tên"
              />
            </label>
            <div className="admin-toolbar-end">
              <span className="admin-result-count" aria-live="polite">
                {loading ? 'Đang cập nhật' : `${usersPage?.totalCount ?? 0} tài khoản`}
              </span>
              <label className="admin-filter-control">
                <Filter aria-hidden="true" />
                <span className="admin-visually-hidden">Lọc trạng thái tài khoản</span>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as typeof statusFilter);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="disabled">Đã vô hiệu</option>
                </select>
              </label>
            </div>
          </div>

          <div className="table-container admin-table-container" aria-busy={loading}>
            <table className="vmu-table admin-users-table">
              <caption className="admin-visually-hidden">Danh sách tài khoản được phép truy cập hệ thống</caption>
              <thead>
                <tr>
                  <th scope="col">Người dùng</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hồ sơ và vai trò</th>
                  <th scope="col">Đăng nhập gần nhất</th>
                  <th scope="col"><span className="admin-visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="admin-state-row">
                      <LoaderCircle className="auth-spin" aria-hidden="true" />
                      <strong>Đang tải danh sách người dùng</strong>
                    </td>
                  </tr>
                ) : usersPage?.items.length ? usersPage.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName || 'Chưa cập nhật họ tên'}</strong>
                      <span className="admin-cell-subtitle">{user.email}</span>
                    </td>
                    <td>
                      <span className={`admin-status ${user.isActive ? 'is-active' : 'is-disabled'}`}>
                        <span aria-hidden="true" />
                        {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-profile-tags">
                        {user.profiles.length === 0
                          ? <span className="admin-cell-subtitle">Chưa có hồ sơ</span>
                          : user.profiles.map((profile) => (
                            <span
                              key={profile.id}
                              className={`admin-role-label ${profile.isActive ? '' : 'is-disabled'}`}
                              title={`${profile.name}${profile.isActive ? '' : ' - Đã vô hiệu'}`}
                            >
                              {profile.roleCode}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="admin-date-cell">{formatDate(user.lastLoginAt)}</td>
                    <td className="admin-action-cell">
                      <button
                        type="button"
                        className="admin-icon-button"
                        title={`Xem chi tiết ${user.email}`}
                        aria-label={`Xem chi tiết ${user.email}`}
                        onClick={() => {
                          setSelectedUser(user);
                          setShowProfileForm(false);
                          setError(null);
                        }}
                      >
                        <Eye aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="admin-state-row admin-empty-row">
                      <UsersRound aria-hidden="true" />
                      <strong>{hasUserFilters ? 'Không có kết quả phù hợp' : 'Chưa có người dùng'}</strong>
                      <span>
                        {hasUserFilters
                          ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.'
                          : 'Thêm tài khoản Google đầu tiên để cấp quyền truy cập.'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination admin-pagination">
            <div>Trang <strong>{page}</strong> / {totalPages}</div>
            <div className="admin-pagination-actions">
              <button
                type="button"
                className="admin-icon-button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
                aria-label="Trang trước"
                title="Trang trước"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
                aria-label="Trang sau"
                title="Trang sau"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      ) : view === 'audit' ? (
        <section
          id="admin-audit-panel"
          className="admin-table-section"
          role="tabpanel"
          aria-labelledby="admin-audit-tab"
        >
          <div className="admin-audit-heading">
            <div>
              <h3>Lịch sử xác thực và quản trị</h3>
              <p>Các sự kiện mới nhất được ghi nhận trực tiếp từ hệ thống.</p>
            </div>
            <div className="admin-audit-actions">
              <span className="admin-result-count" aria-live="polite">
                {loading ? 'Đang cập nhật' : `${auditPage?.totalCount ?? 0} sự kiện`}
              </span>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => void loadAudit()}
                disabled={loading}
                aria-label="Làm mới nhật ký"
                title="Làm mới nhật ký"
              >
                <RefreshCw className={loading ? 'auth-spin' : ''} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="table-container admin-table-container" aria-busy={loading}>
            <table className="vmu-table admin-audit-table">
              <caption className="admin-visually-hidden">Nhật ký xác thực và thao tác quản trị</caption>
              <thead>
                <tr>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Sự kiện</th>
                  <th scope="col">Tài khoản</th>
                  <th scope="col">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="admin-state-row">
                      <LoaderCircle className="auth-spin" aria-hidden="true" />
                      <strong>Đang tải nhật ký hệ thống</strong>
                    </td>
                  </tr>
                ) : auditPage?.items.length ? (
                  auditPage.items.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-date-cell">{formatDate(log.createdAt)}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {eventNames[log.event] ?? log.event}
                        </span>
                      </td>
                      <td>{log.email ?? 'Hệ thống'}</td>
                      <td className="admin-audit-metadata">{log.metadata ?? '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="admin-state-row admin-empty-row">
                      <FileClock aria-hidden="true" />
                      <strong>Chưa có sự kiện nhật ký</strong>
                      <span>Các hoạt động xác thực và quản trị sẽ xuất hiện tại đây.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination admin-pagination">
            <div>Trang <strong>{auditPageNumber}</strong> / {auditTotalPages}</div>
            <div className="admin-pagination-actions">
              <button
                type="button"
                className="admin-icon-button"
                disabled={auditPageNumber <= 1 || loading}
                onClick={() => setAuditPageNumber(auditPageNumber - 1)}
                aria-label="Trang trước"
                title="Trang trước"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="admin-icon-button"
                disabled={auditPageNumber >= auditTotalPages || loading}
                onClick={() => setAuditPageNumber(auditPageNumber + 1)}
                aria-label="Trang sau"
                title="Trang sau"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section
          id="admin-permissions-panel"
          className="admin-table-section"
          role="tabpanel"
          aria-labelledby="admin-permissions-tab"
        >
          <div className="admin-audit-heading">
            <div>
              <h3>Phân quyền Truy cập & Module Báo cáo</h3>
              <p>Quản trị viên có thể bật/tắt quyền hạn (Permissions) cho từng vai trò (Roles) trong hệ thống.</p>
            </div>
            <div className="admin-audit-actions">
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => void loadPermissions()}
                disabled={loading}
                aria-label="Tải lại phân quyền"
                title="Tải lại phân quyền"
              >
                <RefreshCw className={loading ? 'auth-spin' : ''} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="admin-table-shell" style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Vai trò (Role)</th>
                  {permissionMatrix[0]?.permissions.map((perm) => (
                    <th key={perm.permissionId} style={{ textAlign: 'center', minWidth: '130px' }} title={perm.permissionCode}>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>{perm.permissionName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ops-muted)', fontWeight: 400 }}>{perm.permissionCode}</div>
                    </th>
                  ))}
                  <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {permissionMatrix.map((role) => (
                  <tr key={role.roleId}>
                    <td>
                      <div style={{ fontWeight: 650, fontSize: '13px', color: 'var(--ops-text)' }}>{role.roleName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ops-muted)' }}>{role.roleCode}</div>
                    </td>
                    {role.permissions.map((perm) => (
                      <td key={perm.permissionId} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={perm.isGranted}
                          onChange={() => handleTogglePermission(role.roleId, perm.permissionId)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--ops-primary)' }}
                          aria-label={`${role.roleName} - ${perm.permissionName}`}
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        disabled={savingRoleId === role.roleId}
                        onClick={() => void handleSaveRolePermissions(role.roleId)}
                      >
                        {savingRoleId === role.roleId ? (
                          <RefreshCw className="auth-spin" style={{ width: '14px', height: '14px' }} />
                        ) : (
                          <Save style={{ width: '14px', height: '14px' }} />
                        )}
                        Lưu
                      </button>
                    </td>
                  </tr>
                ))}
                {permissionMatrix.length === 0 && !loading && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                      Chưa có dữ liệu phân quyền.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}


      <Modal
        isOpen={isAddUserOpen}
        onClose={() => { setIsAddUserOpen(false); setError(null); }}
        title="Thêm người dùng vào danh sách truy cập"
      >
        <form className="admin-form" onSubmit={handleCreateUser} aria-busy={busy}>
          <div className="admin-form-intro">
            <ShieldPlus aria-hidden="true" />
            <p>Tài khoản chỉ có thể đăng nhập sau khi được tạo hồ sơ làm việc.</p>
          </div>
          <div className="form-group">
            <label htmlFor="admin-display-name">Họ và tên</label>
            <input
              id="admin-display-name"
              value={newUser.displayName}
              onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })}
              maxLength={200}
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-email">Email tài khoản Google</label>
            <input
              id="admin-email"
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              required
              maxLength={320}
              placeholder="user@gmail.com"
              autoComplete="email"
            />
          </div>
          {error && (
            <div className="admin-alert" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <div className="modal-footer admin-inline-footer">
            <button type="button" className="btn btn-secondary" onClick={() => { setIsAddUserOpen(false); setError(null); }}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <LoaderCircle className="auth-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {busy ? 'Đang lưu...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </Modal>

      <UserImportDialog
        isOpen={isImportUsersOpen}
        onClose={() => setIsImportUsersOpen(false)}
        onImported={() => {
          if (page === 1) void loadUsers();
          else setPage(1);
        }}
      />

      <Modal
        isOpen={selectedUser !== null}
        onClose={() => { setSelectedUser(null); setShowProfileForm(false); setError(null); }}
        title={showProfileForm ? (editingProfile ? 'Cập nhật hồ sơ' : 'Tạo hồ sơ mới') : 'Chi tiết tài khoản'}
      >
        {selectedUser && (showProfileForm ? (
          <form className="admin-form" onSubmit={handleSaveProfile} aria-busy={busy}>
            <button type="button" className="admin-back-button" onClick={() => { setShowProfileForm(false); setError(null); }}>
              <ArrowLeft aria-hidden="true" />
              Quay lại tài khoản
            </button>
            <div className="admin-form-grid">
              <div className="form-group">
                <label htmlFor="profile-name">Tên hồ sơ</label>
                <input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required maxLength={200} />
              </div>
              <div className="form-group">
                <label htmlFor="profile-code">Mã hồ sơ</label>
                <input id="profile-code" value={profileForm.code} onChange={(event) => setProfileForm({ ...profileForm, code: event.target.value })} required maxLength={100} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="profile-role">Vai trò được cấp</label>
              <select id="profile-role" value={profileForm.roleId} onChange={(event) => setProfileForm({ ...profileForm, roleId: event.target.value })} required>
                <option value="">Chọn vai trò</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.code})</option>)}
              </select>
            </div>
            <div className="admin-form-grid">
              <div className="form-group">
                <label htmlFor="organization-code">Mã đơn vị / phạm vi</label>
                <input id="organization-code" value={profileForm.organizationUnitCode ?? ''} onChange={(event) => setProfileForm({ ...profileForm, organizationUnitCode: event.target.value || null })} maxLength={100} />
              </div>
              <div className="form-group">
                <label htmlFor="organization-name">Tên đơn vị / phạm vi</label>
                <input id="organization-name" value={profileForm.organizationUnitName ?? ''} onChange={(event) => setProfileForm({ ...profileForm, organizationUnitName: event.target.value || null })} maxLength={200} />
              </div>
            </div>
            <label className="admin-checkbox-row">
              <input type="checkbox" checked={profileForm.isDefault} onChange={(event) => setProfileForm({ ...profileForm, isDefault: event.target.checked })} />
              Đặt làm hồ sơ mặc định
            </label>
            {error && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="modal-footer admin-inline-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowProfileForm(false); setError(null); }}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <LoaderCircle className="auth-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                {busy ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        ) : (
          <div className="admin-account-detail">
            <div className="admin-account-summary">
              <div className="admin-account-identity">
                <div className="admin-account-avatar" aria-hidden="true">
                  <UsersRound />
                </div>
                <div>
                  <strong>{selectedUser.displayName || 'Chưa cập nhật họ tên'}</strong>
                  <span>{selectedUser.email}</span>
                  <small>Đăng nhập gần nhất: {formatDate(selectedUser.lastLoginAt)}</small>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${selectedUser.isActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => { setError(null); setStatusConfirmation({ type: 'user', item: selectedUser }); }}
                disabled={busy}
              >
                {selectedUser.isActive ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                {selectedUser.isActive ? 'Vô hiệu tài khoản' : 'Kích hoạt tài khoản'}
              </button>
            </div>
            <div className="admin-profile-heading">
              <div>
                <h4>Hồ sơ làm việc</h4>
                <p>Mỗi hồ sơ có vai trò và phạm vi quyền độc lập.</p>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openProfileForm()}>
                <Plus aria-hidden="true" />
                Tạo hồ sơ
              </button>
            </div>
            <div className="admin-profile-list">
              {selectedUser.profiles.length ? selectedUser.profiles.map((profile) => (
                <div className="admin-profile-row" key={profile.id}>
                  <div>
                    <div className="admin-profile-title">
                      <strong>{profile.name}</strong>
                      {profile.isDefault && <span className="admin-role-label is-default">Mặc định</span>}
                      <span className={`admin-status ${profile.isActive ? 'is-active' : 'is-disabled'}`}>
                        <span aria-hidden="true" />
                        {profile.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </div>
                    <span>{profile.roleName} · {profile.code}</span>
                    <small>{profile.organizationUnitName || 'Toàn hệ thống'}{profile.organizationUnitCode ? ` (${profile.organizationUnitCode})` : ''}</small>
                  </div>
                  <div className="admin-row-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProfileForm(profile)}>
                      <Pencil aria-hidden="true" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${profile.isActive ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => { setError(null); setStatusConfirmation({ type: 'profile', item: profile }); }}
                      disabled={busy}
                    >
                      {profile.isActive ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                      {profile.isActive ? 'Vô hiệu' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="admin-empty-state">
                  <ShieldPlus aria-hidden="true" />
                  <strong>Chưa có hồ sơ làm việc</strong>
                  <span>Tài khoản chưa thể đăng nhập cho đến khi được cấp hồ sơ.</span>
                </div>
              )}
            </div>
            {error && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>
        ))}
      </Modal>

      <Modal
        isOpen={statusConfirmation !== null}
        onClose={() => { if (!busy) { setStatusConfirmation(null); setError(null); } }}
        title={confirmationIsActive ? 'Xác nhận vô hiệu' : 'Xác nhận kích hoạt'}
      >
        {statusConfirmation && (
          <div className="admin-confirmation" aria-busy={busy}>
            <div className={`admin-confirmation-icon ${confirmationIsActive ? 'is-danger' : 'is-success'}`}>
              {confirmationIsActive ? <UserX aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            </div>
            <div>
              <p>
                {statusConfirmation.type === 'user'
                  ? `${confirmationIsActive ? 'Vô hiệu' : 'Kích hoạt'} tài khoản ${statusConfirmation.item.email}?`
                  : `${confirmationIsActive ? 'Vô hiệu' : 'Kích hoạt'} hồ sơ ${statusConfirmation.item.name}?`}
              </p>
              <span>
                {confirmationIsActive
                  ? 'Đối tượng này sẽ không thể được sử dụng cho các phiên đăng nhập mới.'
                  : 'Đối tượng này sẽ có thể được sử dụng lại theo quyền đã cấp.'}
              </span>
            </div>
            {error && (
              <div className="admin-alert" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="modal-footer admin-inline-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setStatusConfirmation(null); setError(null); }} disabled={busy}>
                Hủy
              </button>
              <button
                type="button"
                className={`btn ${confirmationIsActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  if (statusConfirmation.type === 'user') {
                    void handleUserStatus(statusConfirmation.item);
                  } else {
                    void handleProfileStatus(statusConfirmation.item);
                  }
                }}
                disabled={busy}
              >
                {busy && <LoaderCircle className="auth-spin" aria-hidden="true" />}
                {busy ? 'Đang xử lý...' : (confirmationIsActive ? 'Xác nhận vô hiệu' : 'Xác nhận kích hoạt')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
