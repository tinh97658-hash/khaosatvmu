import type {
  AdminAuditLog,
  AdminPage,
  AdminProfile,
  AdminRole,
  AdminUser,
  SaveAdminProfile,
} from '../types';
import { apiRequest, csrfRequest } from './apiClient';

function queryString(values: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export const adminApi = {
  users: (search: string, isActive: boolean | null, page: number, pageSize = 20) =>
    apiRequest<AdminPage<AdminUser>>(
      `/api/admin/users?${queryString({ search, isActive, page, pageSize })}`,
    ),
  createUser: (email: string, displayName: string) =>
    csrfRequest<AdminUser>('/api/admin/users', 'POST', { email, displayName }),
  setUserStatus: (userId: string, isActive: boolean) =>
    csrfRequest<AdminUser>(`/api/admin/users/${userId}/status`, 'PATCH', { isActive }),
  roles: () => apiRequest<AdminRole[]>('/api/admin/roles'),
  createProfile: (userId: string, profile: SaveAdminProfile) =>
    csrfRequest<AdminProfile>(`/api/admin/users/${userId}/profiles`, 'POST', profile),
  updateProfile: (userId: string, profileId: string, profile: SaveAdminProfile) =>
    csrfRequest<AdminProfile>(
      `/api/admin/users/${userId}/profiles/${profileId}`,
      'PUT',
      profile,
    ),
  setProfileStatus: (userId: string, profileId: string, isActive: boolean) =>
    csrfRequest<AdminProfile>(
      `/api/admin/users/${userId}/profiles/${profileId}/status`,
      'PATCH',
      { isActive },
    ),
  auditLogs: (page: number, userId?: string, pageSize = 30) =>
    apiRequest<AdminPage<AdminAuditLog>>(
      `/api/admin/audit-logs?${queryString({ userId, page, pageSize })}`,
    ),
};
