import { defineConfig } from "@playwright/test";

export default defineConfig({
  // 真实浏览器测试产物统一落到工作区 output，避免再回落到系统缓存或临时目录。
  testDir: "./e2e",
  outputDir: "/home/psx/app/output/playwright/wxapp-checkin/test-results",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    // 这里直接拉起本地 Vite 服务，让 Playwright 走和用户接近的真实浏览器链路。
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: true
  }
});
