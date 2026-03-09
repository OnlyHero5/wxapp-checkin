import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../../shared/session/session-store";
import { BindPage } from "./BindPage";

const capabilityMocks = vi.hoisted(() => ({
  detectBrowserCapability: vi.fn()
}));

const authApiMocks = vi.hoisted(() => ({
  completePasskeyRegistration: vi.fn(),
  getRegisterOptions: vi.fn(),
  verifyIdentity: vi.fn()
}));

const webauthnMocks = vi.hoisted(() => ({
  createPasskeyCredential: vi.fn()
}));

vi.mock("../../shared/device/browser-capability", () => ({
  detectBrowserCapability: capabilityMocks.detectBrowserCapability
}));

vi.mock("../../features/auth/api", () => ({
  completePasskeyRegistration: authApiMocks.completePasskeyRegistration,
  getRegisterOptions: authApiMocks.getRegisterOptions,
  verifyIdentity: authApiMocks.verifyIdentity
}));

vi.mock("../../features/auth/webauthn", () => ({
  createPasskeyCredential: webauthnMocks.createPasskeyCredential
}));

function renderBindPage() {
  render(
    <MemoryRouter initialEntries={["/bind"]}>
      <Routes>
        <Route path="/bind" element={<BindPage />} />
        <Route path="/activities" element={<h1>活动页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BindPage", () => {
  beforeEach(() => {
    capabilityMocks.detectBrowserCapability.mockReturnValue({
      hasCredentialManager: true,
      hasPasskeySupport: true,
      hasVisibilityLifecycle: true,
      hasWakeLock: false
    });
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

    renderBindPage();

    expect(screen.getByRole("heading", { name: "当前浏览器暂不支持登录" })).toBeInTheDocument();
  });

  it("disables submit until student id and name are filled", async () => {
    const user = userEvent.setup();
    renderBindPage();

    const submitButton = screen.getByRole("button", { name: "验证身份并注册 Passkey" });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("学号"), "20234227087");
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText("姓名"), "张三");
    expect(submitButton).toBeEnabled();
  });

  it("verifies identity, completes passkey registration, and navigates to activities", async () => {
    const user = userEvent.setup();
    authApiMocks.verifyIdentity.mockResolvedValue({
      bind_ticket: "bind_123"
    });
    authApiMocks.getRegisterOptions.mockResolvedValue({
      request_id: "req_123",
      public_key_options: {
        challenge: "challenge"
      }
    });
    webauthnMocks.createPasskeyCredential.mockResolvedValue({
      id: "credential-id",
      raw_id: "raw-id",
      response: {
        attestation_object: "attestation",
        client_data_json: "client"
      },
      type: "public-key"
    });
    authApiMocks.completePasskeyRegistration.mockResolvedValue({
      session_token: "sess_bind_123"
    });

    renderBindPage();

    await user.type(screen.getByLabelText("学号"), "20234227087");
    await user.type(screen.getByLabelText("姓名"), "张三");
    await user.click(screen.getByRole("button", { name: "验证身份并注册 Passkey" }));

    await waitFor(() => {
      expect(authApiMocks.verifyIdentity).toHaveBeenCalledWith({
        name: "张三",
        student_id: "20234227087"
      });
    });
    expect(authApiMocks.getRegisterOptions).toHaveBeenCalledWith({
      bind_ticket: "bind_123"
    });
    expect(webauthnMocks.createPasskeyCredential).toHaveBeenCalledWith({
      challenge: "challenge"
    });
    expect(authApiMocks.completePasskeyRegistration).toHaveBeenCalledWith({
      attestation_response: {
        id: "credential-id",
        raw_id: "raw-id",
        response: {
          attestation_object: "attestation",
          client_data_json: "client"
        },
        type: "public-key"
      },
      bind_ticket: "bind_123",
      request_id: "req_123"
    });
    expect(getSession()).toBe("sess_bind_123");
    expect(screen.getByRole("heading", { name: "活动页已打开" })).toBeInTheDocument();
  });
});
