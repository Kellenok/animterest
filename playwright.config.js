const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: 'playwright_perf_test.spec.js',
    fullyParallel: true,
    reporter: 'line',
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        }
    ],
    webServer: {
        command: 'npx http-server -p 8080',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
