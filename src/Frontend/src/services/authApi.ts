import type {
  AuthAccess,
  AuthConfiguration,
  AuthMeResponse,
  AuthProfile,
} from '../types';
import { ApiError, apiRequest, csrfRequest } from './apiClient';

export { ApiError as AuthApiError };

interface DevProfileSelectionResponse {
  profileSelectionRequired: true;
}

export const authApi = {
  configuration: () => apiRequest<AuthConfiguration>('/api/auth/config'),
  me: () => apiRequest<AuthMeResponse>('/api/auth/me'),
  access: () => apiRequest<AuthAccess>('/api/auth/access'),
  pendingProfiles: async () => {
    const response = await apiRequest<{ availableProfiles: AuthProfile[] }>('/api/auth/pending-profiles');
    return response.availableProfiles;
  },
  selectProfile: (profileId: string) =>
    csrfRequest<AuthMeResponse>('/api/auth/select-profile', 'POST', { profileId }),
  switchProfile: (profileId: string) =>
    csrfRequest<AuthMeResponse>('/api/auth/switch-profile', 'POST', { profileId }),
  logout: () => csrfRequest<{ success: boolean }>('/api/auth/logout', 'POST'),
  devLogin: () =>
    apiRequest<AuthMeResponse | DevProfileSelectionResponse>(
      '/api/auth/dev/login?email=abc%40vmu.edu.vn',
    ),
};
