export interface LoginSettings {
  login_attempts_limit_enabled: boolean;
  login_attempts_limit: number;
  login_attempts_limit_window: number;
  login_attempts_violation_block_time: number;
  login_attempts_blacklist_after_violations: number;

  login_recaptcha_enabled: boolean;
  login_recaptcha_site_key: string;
  login_recaptcha_secret_key: string;
  login_recaptcha_threshold: number;

  login_totp_enabled: boolean;
  login_totp_issuer: string;
  login_totp_policy: 'grace' | 'mandatory' | 'free';
  login_totp_grace_period: number;

  cookie_hardening_samesite_enabled: boolean;
  cookie_hardening_samesite_mode: 'Strict' | 'Lax';
  cookie_hardening_max_concurrent_sessions: number;

  salts_rotation_enabled: boolean;
  salts_rotation_recurrence: 'daily' | 'weekly' | 'monthly';
  salts_rotation_time: string;
}

export const DEFAULT_SETTINGS: LoginSettings = {
  login_attempts_limit_enabled: false,
  login_attempts_limit: 5,
  login_attempts_limit_window: 300,
  login_attempts_violation_block_time: 600,
  login_attempts_blacklist_after_violations: 3,

  login_recaptcha_enabled: false,
  login_recaptcha_site_key: '',
  login_recaptcha_secret_key: '',
  login_recaptcha_threshold: 0.5,

  login_totp_enabled: false,
  login_totp_issuer: 'Bromate Security API Firewall',
  login_totp_policy: 'grace',
  login_totp_grace_period: 7,

  cookie_hardening_samesite_enabled: false,
  cookie_hardening_samesite_mode: 'Strict',

  salts_rotation_enabled: false,
  salts_rotation_recurrence: 'weekly',
  salts_rotation_time: '03:00',

  cookie_hardening_max_concurrent_sessions: 0,
};