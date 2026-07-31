import type { IpEntry } from "@services/ip";
import { GridRowId } from '@mui/x-data-grid';
export type JwtAlgorithm =
  | 'RS256' | 'RS384' | 'RS512'
  | 'HS256' | 'HS384' | 'HS512'
  | 'ES256';

export type AuthMethod = 'jwt' | 'wp_auth';

export type UserStatus = 'active' | 'revoked' | 'disabled';

export interface WordPressRole {
  name: string;
  label: string;
}

export interface AuthorizedUser {
  id: number;
  display_name: string;
  email: string;
  roles: string[];
  current_user: boolean;
  admin_url: string;
  status: UserStatus;
  has_wp_app_password: boolean;
  jwt_subclaim?: string;
  expires_at?: string;
  ip_entries?: IpEntry[];
}

export interface AuthorizedUserMeta {
  id:            number;
  jwt_subclaim: string;
  status:        'active' | 'revoked' | 'disabled';
  expires_at:    string;
}

export interface AuthSettings {
  auth_control_enabled: boolean;
  auth_methods: AuthMethod;
  auth_jwt_algorithm: JwtAlgorithm;
  auth_authorized_roles: string[];
  auth_jwt_public_key: string;
  auth_jwt_audience: string;
  auth_jwt_issuer: string;
  auth_jwt_jwks_url: string;
  auth_attempts_limit_enabled: false,
  auth_attempts_limit: number,
  auth_attempts_limit_window: number,
  auth_attempts_violation_block_time: number,
  auth_attempts_blacklist_after_violations: number,
}

export interface AuthorizedUserDialogProps {
  open: boolean;
  user: AuthorizedUser | null;
  onSave: (user: AuthorizedUser) => void;
  onClose: () => void;
  onDelete: (id: GridRowId, onDeleted?: () => void) => void;  wpUsers: AuthorizedUser[];
  wpUsersLoading: boolean;
  fetchWordPressUsers: () => void;
  authorizedUserIds: number[];
  authorizedUsers: AuthorizedUserMeta[];
  authMethod: AuthMethod;
  authorizedRoles: string[];
}