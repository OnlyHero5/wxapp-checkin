import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/http/errors";
import { getSession } from "../../shared/session/session-store";
import { LoginPage } from "./LoginPage";

const capabilityMocks = vi.hoisted(() => ({
  detectBrowserCapability: vi.fn()
}));

const authApiMocks = vi.hoisted(() => ({
  completePasskeyLogin: vi.fn(),
  getLoginOptions: vi.fn()
}));

const webauthnMocks = vi.hoisted(() => ({
  getPasskeyAssertion: vi.fn()
}));

vi.mock("../../shared/device/browser-capability", () => ({
  detectBrowserCapability: capabilityMocks.detectBrowserCapability
}));

vi.mock("../../features/auth/api", () => ({
  completePasskeyLogin: authApiMocks.completePasskeyLogin,
  getLoginOptions: authApiMocks.getLoginOptions
}));

vi.mock("../../features/auth/webauthn", () => ({
  getPasskeyAssertion: webauthnMocks.getPasskeyAssertion
}));

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bind" element={<h1>绑定页已打开</h1>} />
        <Route path="/activities" element={<h1>活动页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows the unsupported browser page when passkey is unavailable", () => {
    capabilityMocks.detectBrowserCapability.mockReturnValue({
      hasCredentialManager: false,
      hasPasskeySupport: false,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });

    renderLoginPage();

    expect(screen.getByRole("heading", { name: "当前浏览器暂不支持登录" })).toBeInTheDocument();
  });

  it("logs in with passkey and navigates to activities", async () => {
    const user = userEvent.setup();
    capabilityMocks.detectBrowserCapability.mockReturnValue({
      hasCredentialManager: true,
      hasPasskeySupport: true,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });
    authApiMocks.getLoginOptions.mockResolvedValue({
      request_id: "req_login_123",
      public_key_options: {
        challenge: "challenge"
      }
    });
    webauthnMocks.getPasskeyAssertion.mockResolvedValue({
      id: "assertion-id",
      raw_id: "raw-id",
      response: {
        authenticator_data: "authenticator",
        client_data_json: "client",
        signature: "signature",
        user_handle: "user"
      },
      type: "public-key"
    });
    authApiMocks.completePasskeyLogin.mockResolvedValue({
      session_token: "sess_login_123"
    });

    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "使用 Passkey 登录" }));

    await waitFor(() => {
      expect(authApiMocks.getLoginOptions).toHaveBeenCalled();
    });
    expect(webauthnMocks.getPasskeyAssertion).toHaveBeenCalledWith({
      challenge: "challenge"
    });
    expect(authApiMocks.completePasskeyLogin).toHaveBeenCalledWith({
      assertion_response: {
        id: "assertion-id",
        raw_id: "raw-id",
        response: {
          authenticator_data: "authenticator",
          client_data_json: "client",
          signature: "signature",
          user_handle: "user"
        },
        type: "public-key"
      },
      request_id: "req_login_123"
    });
    expect(getSession()).toBe("sess_login_123");
    expect(screen.getByRole("heading", { name: "活动页已打开" })).toBeInTheDocument();
  });

  it("redirects to bind when the current browser has no registered passkey", async () => {
    const user = userEvent.setup();
    capabilityMocks.detectBrowserCapability.mockReturnValue({
      hasCredentialManager: true,
      hasPasskeySupport: true,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });
    authApiMocks.getLoginOptions.mockRejectedValue(
      new ApiError("当前浏览器尚未完成绑定", {
        code: "passkey_not_registered",
        status: "forbidden"
      })
    );

    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "使用 Passkey 登录" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "绑定页已打开" })).toBeInTheDocument();
    });
  });
});
