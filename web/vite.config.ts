import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import { resolveRuntimeConfig, shouldProxyApiBase } from "./src/shared/runtime/runtime-config";

export function createAppViteConfig(env: Record<string, string | undefined>): UserConfig {
  const { apiBasePath, apiProxyTarget, appBasePath } = resolveRuntimeConfig(env);

  return {
    base: appBasePath,
    plugins: [react()],
    server: shouldProxyApiBase(apiBasePath)
      ? {
          // 只代理 wxapp-checkin 自己的 Web API，避免把 `suda-gs-ams` 那类更宽的 `/api/*` 命名空间一起吞掉。
          proxy: {
            [apiBasePath]: {
              changeOrigin: true,
              target: apiProxyTarget
            }
          }
        }
      : undefined,
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts"
    }
  };
}

export default defineConfig(({ mode }) => {
  return createAppViteConfig(loadEnv(mode, process.cwd(), ""));
});
