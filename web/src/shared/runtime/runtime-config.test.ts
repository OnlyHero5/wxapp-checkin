import { describe, expect, it } from "vitest";
import {
  getRouterBasename,
  normalizeApiBasePath,
  normalizeAppBasePath,
  resolveRuntimeConfig
} from "./runtime-config";

describe("runtime-config", () => {
  it("uses web-only defaults when env is empty", () => {
    expect(resolveRuntimeConfig({})).toEqual({
      apiBasePath: "/api/web",
      apiProxyTarget: "http://127.0.0.1:9989",
      appBasePath: "/",
      routerBasename: "/"
    });
  });

  it("normalizes app base path into a deployable sub-path", () => {
    expect(normalizeAppBasePath("checkin")).toBe("/checkin/");
    expect(normalizeAppBasePath("/checkin")).toBe("/checkin/");
    expect(normalizeAppBasePath(" /checkin/ ")).toBe("/checkin/");
  });

  it("normalizes api base path without a trailing slash", () => {
    expect(normalizeApiBasePath("checkin-api/web")).toBe("/checkin-api/web");
    expect(normalizeApiBasePath("/checkin-api/web/")).toBe("/checkin-api/web");
    expect(normalizeApiBasePath(" https://checkin.example.com/api/web/ ")).toBe(
      "https://checkin.example.com/api/web"
    );
  });

  it("derives router basename from the configured app base path", () => {
    expect(getRouterBasename("/")).toBe("/");
    expect(getRouterBasename("/checkin/")).toBe("/checkin");
  });
});
