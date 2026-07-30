import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],

  manifest: {
    name: 'Corsair HTTP Interceptor',
    description:
        'Intercepta, inspecciona y modifica solicitudes y respuestas HTTP.',
    version: '0.1.0',

    minimum_chrome_version: '116',

    permissions: [
      'debugger',
      'storage',
      'tabs',
      'activeTab',
      'sidePanel',
    ],

    host_permissions: ['<all_urls>'],

    action: {
      default_title: 'Abrir Corsair HTTP Interceptor',
    },
  },
});