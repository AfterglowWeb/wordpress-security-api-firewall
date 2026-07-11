import type { IpEntry } from "@services/ip";

export type JwtAlgorithm =
  | 'RS256' | 'RS384' | 'RS512'
  | 'HS256' | 'HS384' | 'HS512'
  | 'ES256';

export type AuthMethod = 'jwt' | 'wp_auth';

export type UserStatus = 'active' | 'revoked';

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
  status:        'active' | 'revoked';
  expires_at:    string;
}

export interface AuthSettings {
  auth_control_enabled: boolean;
  auth_methods: AuthMethod;
  auth_jwt_algorithm: JwtAlgorithm;
  auth_jwt_public_key: string;
  auth_jwt_audience: string;
  auth_jwt_issuer: string;
  auth_jwt_jwks_url: string;
  auth_jwt_cache_jwks: boolean;
  auth_jwt_cache_duration: number;
}
