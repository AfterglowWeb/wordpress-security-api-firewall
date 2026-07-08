import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WordPress Application Layer',
  description: 'A secure, extensible REST API layer for WordPress. Isolate, filter, and extend the WordPress REST API for headless and multi-application architectures.',

  head: [
    ['meta', { name: 'theme-color', content: '#1565c0' }],
  ],

  themeConfig: {
    siteTitle: 'Bromate Application Layer',

    nav: [
      { text: 'Overview', link: '/presentation' },
      {
        text: 'Docs',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Applications', link: '/applications/applications' },
          { text: 'Auth & Rate Limiting', link: '/users/users' },
          { text: 'Auth Hardening', link: '/login-hardening/login-hardening' },
          { text: 'WordPress Mode', link: '/wordpress-mode/wordpress-mode' },
          { text: 'Migration & Fallback', link: '/migration/migration' },
          { text: 'Properties & Models', link: '/models/models' },
          { text: 'Settings Route', link: '/settings/settings' },
          { text: 'Routes & Exposure', link: '/routes/routes' },
          { text: 'Global IP Filtering', link: '/global-ip-filtering/global-ip-filtering' },
          { text: 'Collections', link: '/collections/collections' },
          { text: 'Automations', link: '/automations/automations' },
          { text: 'Webhooks', link: '/webhooks/webhooks' },
          { text: 'Emails', link: '/mails/mails' },
          { text: 'Hooks & Filters', link: '/hooks' },
          { text: 'Global Security', link: '/global-security/global-security' },
          { text: 'Theme', link: '/theme/theme' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/AfterglowWeb/wordpress-security-api-firewall', target: '_blank' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Application Layer?', link: '/presentation' },
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Core Pillars',
        items: [
          {
            text: 'Authentication & Rate Limiting',
            items: [
              { text: 'Auth & Rate Limiting', link: '/users/users' },
              { text: 'Auth Hardening', link: '/login-hardening/login-hardening' },
            ],
          },
          {
            text: 'IP Filtering & Security',
            items: [
              { text: 'Global IP Filtering', link: '/global-ip-filtering/global-ip-filtering' },
              { text: 'Per-Application IP Filtering (Pro)', link: '/ipsfilter/ipsfilter' },
              { text: 'Global Security', link: '/global-security/global-security' },
            ],
          },
          {
            text: 'Routes & Exposure Control',
            items: [
              { text: 'Routes & Exposure Control', link: '/routes/routes' },
              { text: 'Per-Route Policy (Pro)', link: '/routes/routes' },
            ],
          },
          {
            text: 'Properties & Data Shaping',
            items: [
              { text: 'Properties & Models', link: '/models/models' },
              { text: 'Settings Route (Pro)', link: '/settings/settings' },
              { text: 'Collections (Pro)', link: '/collections/collections' },
            ],
          },
        ],
      },
      {
        text: 'Multi-Application & Infrastructure',
        items: [
          { text: 'Applications (Pro)', link: '/applications/applications' },
          { text: 'WordPress Mode (Pro)', link: '/wordpress-mode/wordpress-mode' },
          { text: 'Migration & Fallback (Pro)', link: '/migration/migration' },
        ],
      },
      {
        text: 'Advanced Features',
        items: [
          { text: 'Automations (Pro)', link: '/automations/automations' },
          { text: 'Webhooks (Pro)', link: '/webhooks/webhooks' },
          { text: 'Emails (Pro)', link: '/mails/mails' },
          { text: 'Hooks & Filters API', link: '/hooks' },
          { text: 'Theme (Pro)', link: '/theme/theme' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/AfterglowWeb/wordpress-security-api-firewall' },
    ],

    editLink: {
      pattern: 'https://github.com/AfterglowWeb/wordpress-security-api-firewall/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the GPL-2.0-or-later License.',
      copyright: 'Copyright © 2024-present Cédric Moris Kelly',
    },

    search: {
      provider: 'local',
    },
  },
})
