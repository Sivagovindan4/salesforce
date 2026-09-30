import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './e2e', fullyParallel: false, reporter: 'list', timeout: 30_000, use: { baseURL: 'http://127.0.0.1:3100', ...devices['Desktop Chrome'] }, webServer: { command: 'npm run dev -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 120_000 } });
