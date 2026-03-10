import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getBrowserBindingKey,
  getSession,
  getSessionPermissions,
  getSessionRole,
  getSessionUserProfile,
  saveAuthSession,
  setSession
} from "./session-store";

const originalLocalStorage = window.localStorage;

describe("session-store", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage
    });
    window.localStorage.clear();
  });

  it("returns an empty session when storage is blank", () => {
    expect(getSession()).toBe("");
  });

  it("persists the normalized session token", () => {
    setSession("  session-token  ");

    expect(getSession()).toBe("session-token");
    expect(window.localStorage.getItem("session_token")).toBe("session-token");
  });

  it("clears the session token", () => {
    setSession("session-token");

    clearSession();

    expect(getSession()).toBe("");
    expect(window.localStorage.getItem("session_token")).toBeNull();
  });

  it("persists role, permissions and user profile together with auth session", () => {
    saveAuthSession({
      permissions: ["activity:manage", "unbind:review"],
      role: "staff",
      session_token: "  session-token  ",
      user_profile: {
        name: "刘洋",
        student_id: "2025000007"
      }
    });

    expect(getSession()).toBe("session-token");
    expect(getSessionRole()).toBe("staff");
    expect(getSessionPermissions()).toEqual(["activity:manage", "unbind:review"]);
    expect(getSessionUserProfile()).toEqual({
      name: "刘洋",
      student_id: "2025000007"
    });
  });

  it("creates and reuses a stable browser binding key", () => {
    const firstKey = getBrowserBindingKey();
    const secondKey = getBrowserBindingKey();

    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
    expect(window.localStorage.getItem("browser_binding_key")).toBe(firstKey);
  });

  it("degrades safely when localStorage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      }
    });

    expect(getSession()).toBe("");
    expect(() => setSession("session-token")).not.toThrow();
    expect(() => saveAuthSession({ role: "staff", session_token: "session-token" })).not.toThrow();
    expect(() => clearSession()).not.toThrow();
  });
});
