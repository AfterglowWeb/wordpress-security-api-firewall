import { apiRequest } from '@services/api';

export interface SaltRotationStatus {
  last_rotation: string | null;
  next_rotation: string | null;
}

export interface RevokeAllUsersResult {
  message: string;
  affected: number;
}

export const UserSessionsAPI = {
  getSaltRotationStatus: () =>
    apiRequest<SaltRotationStatus>(
      'bromate_security_api_firewall_salt_rotation_status'
    ),

  rotateSaltsNow: () =>
    apiRequest<SaltRotationStatus>(
      'bromate_security_api_firewall_rotate_salt_now'
    ),

  revokeAllTrustedDevices: () =>
   apiRequest<RevokeAllUsersResult>(
      'bromate_security_api_firewall_revoke_all_users'
    ),
};
