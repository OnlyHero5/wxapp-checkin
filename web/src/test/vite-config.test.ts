// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createAppViteConfig } from "../../vite.config";

describe("createAppViteConfig", () => {
  it("proxies only the web api to the local backend by default", () => {
    const config = createAppViteConfig({});

    expect(config.base).toBe("/");
    expect(config.server?.proxy).toMatchObject({
      "/api/web": {
        changeOrigin: true,
        target: "http://127.0.0.1:9989"
      }
    });
    expect(config.server?.proxy).not.toHaveProperty("/api");
  });

  it("supports sub-path deployment without changing source code", () => {
    const config = createAppViteConfig({
      VITE_API_BASE_PATH: "/checkin-api/web",
      VITE_API_PROXY_TARGET: "http://127.0.0.1:8080",
      VITE_APP_BASE_PATH: "/checkin/"
    });

    expect(config.base).toBe("/checkin/");
    expect(config.server?.proxy).toMatchObject({
      "/checkin-api/web": {
        changeOrigin: true,
        target: "http://127.0.0.1:8080"
      }
    });
  });
});
