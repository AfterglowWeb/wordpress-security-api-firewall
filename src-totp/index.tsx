import { createShadowRootMount } from './shadowMount';
import { type AdminData } from '@totp-types/admin';

document.addEventListener('DOMContentLoaded', function () {
  const raw = (window as any).bromate_totp_data;
  if (!raw) {
	return;
  }

  const adminData: AdminData = {
    ...raw
  };

  createShadowRootMount(adminData);
});
