import { apiRequest } from '@services/api';

export interface SaltsRotationStatus {
  last_rotation: string | null;
  next_rotation: string | null;
}

export interface RevokeAllUsersResult {
  message: string;
  affected: number;
}

export const UserSessionsAPI = {
  getSaltsRotationStatus: () =>
    apiRequest<SaltsRotationStatus>(
      'bromate_security_api_firewall_salts_rotation_status'
    ),

  rotateSaltsNow: () =>
    apiRequest<SaltsRotationStatus>(
      'bromate_security_api_firewall_rotate_salts_now'
    ),

  revokeAllTrustedDevices: () =>
   apiRequest<RevokeAllUsersResult>(
      'bromate_security_api_firewall_revoke_all_users'
    ),
};
