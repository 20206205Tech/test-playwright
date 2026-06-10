import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Đường dẫn gốc của ứng dụng */
    // baseURL: 'http://localhost:3000',
    // baseURL: 'https://api.20206205.tech/api/prod/supabase-auth-service',
    baseURL: "https://20206205.tech",
    /* Base URL to use in actions like `await page.goto('')`. */

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    // trace: "on-first-retry",
    /* Chỉ định lấy trace nếu test bị fail (Tối ưu hơn on-first-retry) */
    trace: "retain-on-failure",

    /* Chỉ giữ lại video nếu test bị fail để tiết kiệm bộ nhớ */
    video: "on",
    // video: "retain-on-failure",

    /* Tự động chụp ảnh màn hình (screenshot) khi test bị fail */
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    // 1. Setup project (Đăng ký/Đăng nhập và lưu Auth State)
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 2. Project chạy API tests - CHỈ chạy 1 lần trên Chromium
    {
      name: 'api-tests',
      testMatch: /tests\/api\/.*/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // 3. Các Projects chạy UI E2E tests - Chạy trên nhiều trình duyệt khác nhau
    {
      name: 'chromium-ui',
      testMatch: /tests\/ui\/.*/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-ui',
      testMatch: /tests\/ui\/.*/,
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-ui',
      testMatch: /tests\/ui\/.*/,
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome-ui',
      testMatch: /tests\/ui\/.*/,
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari-ui',
      testMatch: /tests\/ui\/.*/,
      use: {
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
