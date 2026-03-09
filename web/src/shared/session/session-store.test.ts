import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSession, getSession, setSession } from "./session-store";

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

  it("degrades safely when localStorage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      }
    });

    expect(getSession()).toBe("");
    expect(() => setSession("session-token")).not.toThrow();
    expect(() => clearSession()).not.toThrow();
  });
});
