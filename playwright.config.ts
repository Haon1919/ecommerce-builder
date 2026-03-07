import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'admin',
            testDir: './tests/e2e/admin',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://127.0.0.1:3002',
            },
        },
        {
            name: 'store',
            testDir: './tests/e2e/store',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://127.0.0.1:3003',
            },
        },
        {
            name: 'super-admin',
            testDir: './tests/e2e/super-admin',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://127.0.0.1:3004',
            },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3002', // Checking one is usually enough, or wait for all to be up
        timeout: 120 * 1000,
        reuseExistingServer: !process.env.CI,
    },
});
