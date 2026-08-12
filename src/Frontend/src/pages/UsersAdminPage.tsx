import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import type {
  AdminAuditLog,
  AdminPage,
  AdminProfile,
  AdminRole,
  AdminUser,
  SaveAdminProfile,
} from '../types';

type AdminView = 'users' | 'audit';

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
  const [newUser, setNewUser] = useState({ displayName: '', email: '' });
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingProfile, setEditingProfile] = useState<AdminProfile | null>(null);
  const [profileForm, setProfileForm] = useState<SaveAdminProfile>(emptyProfile);
  const [showProfileForm, setShowProfileForm] = useState(false);

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

  useEffect(() => {
    void adminApi.roles().then(setRoles).catch((requestError) => setError(messageFrom(requestError)));
  }, []);

  useEffect(() => {
    if (view !== 'users') return;
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers, view]);

  useEffect(() => {
    if (view === 'audit') void loadAudit();
  }, [loadAudit, view]);

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
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleUserStatus = async (user: AdminUser) => {
    const action = user.isActive ? 'vô hiệu' : 'kích hoạt';
    if (!window.confirm(`Xác nhận ${action} tài khoản ${user.email}?`)) return;
    setBusy(true);
    setError(null);
    try {
      replaceUser(await adminApi.setUserStatus(user.id, !user.isActive));
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
      const saved = editingProfile
        ? await adminApi.updateProfile(selectedUser.id, editingProfile.id, profileForm)
        : await adminApi.createProfile(selectedUser.id, profileForm);
      replaceProfile(saved);
      setShowProfileForm(false);
      setEditingProfile(null);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleProfileStatus = async (profile: AdminProfile) => {
    if (!selectedUser) return;
    const action = profile.isActive ? 'vô hiệu' : 'kích hoạt';
    if (!window.confirm(`Xác nhận ${action} profile ${profile.name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      replaceProfile(await adminApi.setProfileStatus(selectedUser.id, profile.id, !profile.isActive));
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-users-page">
      <div className="page-header admin-page-header">
        <div className="page-title-group">
          <h2>Quản trị người dùng và phân quyền</h2>
          <p>Quản lý allowlist tài khoản Google, profile làm việc và lịch sử xác thực.</p>
        </div>
        {view === 'users' && (
          <button className="btn btn-primary" onClick={() => setIsAddUserOpen(true)}>
            + Thêm người dùng
          </button>
        )}
      </div>

      <div className="admin-view-tabs" role="tablist" aria-label="Chế độ quản trị người dùng">
        <button
          className={view === 'users' ? 'active' : ''}
          onClick={() => setView('users')}
          role="tab"
          aria-selected={view === 'users'}
        >
          Tài khoản &amp; profile
        </button>
        <button
          className={view === 'audit' ? 'active' : ''}
          onClick={() => setView('audit')}
          role="tab"
          aria-selected={view === 'audit'}
        >
          Nhật ký audit
        </button>
      </div>

      {error && <div className="admin-alert" role="alert">{error}</div>}

      {view === 'users' ? (
        <section className="admin-table-section">
          <div className="table-toolbar">
            <div className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Tìm theo email hoặc họ tên..."
                aria-label="Tìm người dùng"
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as typeof statusFilter);
                setPage(1);
              }}
              aria-label="Lọc trạng thái tài khoản"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="disabled">Đã vô hiệu</option>
            </select>
          </div>

          <div className="table-container">
            <table className="vmu-table admin-users-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Trạng thái</th>
                  <th>Profile</th>
                  <th>Lần đăng nhập cuối</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="admin-empty-row">Đang tải dữ liệu...</td></tr>
                ) : usersPage?.items.length ? usersPage.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName || 'Chưa cập nhật họ tên'}</strong>
                      <span className="admin-cell-subtitle">{user.email}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-profile-tags">
                        {user.profiles.length === 0
                          ? <span className="admin-cell-subtitle">Chưa có profile</span>
                          : user.profiles.map((profile) => (
                            <span
                              key={profile.id}
                              className={`badge ${profile.isActive ? 'badge-info' : 'badge-danger'}`}
                            >
                              {profile.roleCode}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setSelectedUser(user);
                        setShowProfileForm(false);
                        setError(null);
                      }}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="admin-empty-row">Không có người dùng phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div>Trang <strong>{page}</strong> / {totalPages} · {usersPage?.totalCount ?? 0} tài khoản</div>
            <div className="admin-pagination-actions">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Trước</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>Sau</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="admin-table-section">
          <div className="admin-audit-heading">
            <div>
              <h3>Lịch sử xác thực và quản trị</h3>
              <p>Các sự kiện mới nhất được ghi nhận trực tiếp từ backend.</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadAudit()} disabled={loading}>Làm mới</button>
          </div>
          <div className="table-container">
            <table className="vmu-table admin-audit-table">
              <thead><tr><th>Thời gian</th><th>Sự kiện</th><th>Tài khoản</th><th>Đối tượng</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="admin-empty-row">Đang tải nhật ký...</td></tr>
                ) : auditPage?.items.length ? auditPage.items.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td><span className="badge badge-info">{eventNames[log.event] ?? log.event}</span></td>
                    <td>{log.email ?? 'Không xác định'}</td>
                    <td><code>{log.profileId ? `Profile ${log.profileId.slice(0, 8)}` : `User ${log.userId?.slice(0, 8) ?? '-'}`}</code></td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="admin-empty-row">Chưa có sự kiện audit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <div>Trang <strong>{auditPageNumber}</strong> / {auditTotalPages} · {auditPage?.totalCount ?? 0} sự kiện</div>
            <div className="admin-pagination-actions">
              <button className="btn btn-secondary btn-sm" disabled={auditPageNumber <= 1 || loading} onClick={() => setAuditPageNumber(auditPageNumber - 1)}>Trước</button>
              <button className="btn btn-secondary btn-sm" disabled={auditPageNumber >= auditTotalPages || loading} onClick={() => setAuditPageNumber(auditPageNumber + 1)}>Sau</button>
            </div>
          </div>
        </section>
      )}

      <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="THÊM NGƯỜI DÙNG VÀO ALLOWLIST">
        <form onSubmit={handleCreateUser}>
          <div className="form-group">
            <label htmlFor="admin-display-name">Họ và tên</label>
            <input id="admin-display-name" value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} maxLength={200} />
          </div>
          <div className="form-group">
            <label htmlFor="admin-email">Email tài khoản Google</label>
            <input id="admin-email" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required maxLength={320} placeholder="user@gmail.com" />
          </div>
          {error && <div className="admin-alert" role="alert">{error}</div>}
          <div className="modal-footer admin-inline-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Tạo tài khoản'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={selectedUser !== null}
        onClose={() => { setSelectedUser(null); setShowProfileForm(false); }}
        title={showProfileForm ? (editingProfile ? 'CẬP NHẬT PROFILE' : 'TẠO PROFILE MỚI') : 'CHI TIẾT TÀI KHOẢN'}
      >
        {selectedUser && (showProfileForm ? (
          <form onSubmit={handleSaveProfile}>
            <div className="admin-form-grid">
              <div className="form-group">
                <label htmlFor="profile-name">Tên profile</label>
                <input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required maxLength={200} />
              </div>
              <div className="form-group">
                <label htmlFor="profile-code">Mã profile</label>
                <input id="profile-code" value={profileForm.code} onChange={(event) => setProfileForm({ ...profileForm, code: event.target.value })} required maxLength={100} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="profile-role">Role được cấp</label>
              <select id="profile-role" value={profileForm.roleId} onChange={(event) => setProfileForm({ ...profileForm, roleId: event.target.value })} required>
                <option value="">Chọn role</option>
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
              Đặt làm profile mặc định
            </label>
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <div className="modal-footer admin-inline-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowProfileForm(false)}>Quay lại</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu profile'}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="admin-account-summary">
              <div>
                <strong>{selectedUser.displayName || 'Chưa cập nhật họ tên'}</strong>
                <span>{selectedUser.email}</span>
                <small>Đăng nhập cuối: {formatDate(selectedUser.lastLoginAt)}</small>
              </div>
              <button
                className={`btn btn-sm ${selectedUser.isActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => void handleUserStatus(selectedUser)}
                disabled={busy}
              >
                {selectedUser.isActive ? 'Vô hiệu tài khoản' : 'Kích hoạt tài khoản'}
              </button>
            </div>
            <div className="admin-profile-heading">
              <div><h4>Profile làm việc</h4><p>Mỗi profile có role và phạm vi quyền độc lập.</p></div>
              <button className="btn btn-primary btn-sm" onClick={() => openProfileForm()}>+ Tạo profile</button>
            </div>
            <div className="admin-profile-list">
              {selectedUser.profiles.length ? selectedUser.profiles.map((profile) => (
                <div className="admin-profile-row" key={profile.id}>
                  <div>
                    <div className="admin-profile-title">
                      <strong>{profile.name}</strong>
                      {profile.isDefault && <span className="badge badge-warning">Mặc định</span>}
                      <span className={`badge ${profile.isActive ? 'badge-success' : 'badge-danger'}`}>{profile.isActive ? 'Hoạt động' : 'Vô hiệu'}</span>
                    </div>
                    <span>{profile.roleName} · {profile.code}</span>
                    <small>{profile.organizationUnitName || 'Toàn hệ thống'}{profile.organizationUnitCode ? ` (${profile.organizationUnitCode})` : ''}</small>
                  </div>
                  <div className="admin-row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openProfileForm(profile)}>Sửa</button>
                    <button className={`btn btn-sm ${profile.isActive ? 'btn-danger' : 'btn-secondary'}`} onClick={() => void handleProfileStatus(profile)} disabled={busy}>
                      {profile.isActive ? 'Vô hiệu' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>
              )) : <div className="admin-empty-state">Tài khoản chưa có profile nên chưa thể đăng nhập hệ thống.</div>}
            </div>
            {error && <div className="admin-alert" role="alert">{error}</div>}
          </div>
        ))}
      </Modal>
    </div>
  );
}
