import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserCapability } from "./browser-capability";

const originalPublicKeyCredential = window.PublicKeyCredential;
const originalCredentials = navigator.credentials;
const originalWakeLock = navigator.wakeLock;

afterEach(() => {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: originalPublicKeyCredential
  });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: originalCredentials
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: originalWakeLock
  });
});

describe("detectBrowserCapability", () => {
  it("reports baseline passkey support when required APIs exist", () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredentialMock {
        static isUserVerifyingPlatformAuthenticatorAvailable() {
          return Promise.resolve(true);
        }
      }
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: vi.fn(),
        get: vi.fn()
      }
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: vi.fn()
      }
    });

    expect(detectBrowserCapability()).toEqual({
      hasCredentialManager: true,
      hasPasskeySupport: true,
      hasVisibilityLifecycle: true,
      hasWakeLock: true
    });
  });

  it("reports unsupported passkey when baseline APIs are missing", () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: undefined
    });

    expect(detectBrowserCapability()).toEqual({
      hasCredentialManager: false,
      hasPasskeySupport: false,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });
  });

  it("does not report passkey support when only basic WebAuthn APIs exist", () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: class PublicKeyCredentialMock {}
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: vi.fn(),
        get: vi.fn()
      }
    });

    expect(detectBrowserCapability()).toEqual({
      hasCredentialManager: true,
      hasPasskeySupport: false,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });
  });
});
