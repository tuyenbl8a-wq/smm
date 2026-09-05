import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./playwright",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 768 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "pnpm build && node dist/main.js",
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: true,
  },
});
