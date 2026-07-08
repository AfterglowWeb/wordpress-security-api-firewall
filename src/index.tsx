import { createShadowRootMount } from './shadowMount';
import { type AdminData } from '@app-types/admin';

document.addEventListener('DOMContentLoaded', function () {
  const raw = window.bromateSecurityApiFirewall;
  if (!raw) {
	return;
  }

  const adminData: AdminData = {
    ...raw,
    plugin_name: raw.plugin_name,
    plugin_version: raw.plugin_version,
  };

  createShadowRootMount(adminData);
});