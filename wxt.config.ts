import {defineConfig} from 'wxt';

export default defineConfig({
    modules: ['@wxt-dev/module-vue'],

    manifest: {
        name: 'Corsair HTTP Interceptor',
        description:
            'Intercept, inspect, and modify HTTP requests and responses.',
        version: '0.1.4',

        minimum_chrome_version: '116',

        permissions: [
            'debugger',
            'storage',
            'tabs',
            'activeTab',
            'sidePanel',
        ],
        host_permissions: [
            "https://*/**",
            "<all_urls>"
        ],
        action: {
            default_title: 'Open Corsair HTTP Interceptor',
        },
    },
});