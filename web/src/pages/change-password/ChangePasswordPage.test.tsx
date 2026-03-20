import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "../../shared/http/errors";
import { getMustChangePassword, saveAuthSession } from "../../shared/session/session-store";
import { AppRoutes } from "../../app/router";
import { ChangePasswordPage } from "./ChangePasswordPage";

const authApiMocks = vi.hoisted(() => ({
  changePassword: vi.fn()
}));

const activitiesApiMocks = vi.hoisted(() => ({
  getActivities: vi.fn().mockResolvedValue({
    activities: []
  })
}));

vi.mock("../../features/auth/api", () => ({
  changePassword: authApiMocks.changePassword
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivities: activitiesApiMocks.getActivities
  };
});

function renderChangePasswordPage() {
  render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/activities" element={<h1>活动页已打开</h1>} />
        <Route path="/login" element={<h1>登录页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderSelfServiceChangePasswordRoute() {
  render(
    <MemoryRouter initialEntries={["/change-password?mode=self-service"]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe("ChangePasswordPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveAuthSession({
      must_change_password: true,
      session_token: "sess_change_123"
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("submits the password change and navigates to activities", async () => {
    const user = userEvent.setup();
    authApiMocks.changePassword.mockResolvedValue({
      must_change_password: false,
      status: "success"
    });

    renderChangePasswordPage();

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
    expect(screen.getByRole("button", { name: "修改密码" })).toHaveClass("app-button--accent-brand");

    await user.type(screen.getByLabelText("旧密码"), " 123 ");
    await user.type(screen.getByLabelText("新密码"), " new-pass ");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    await waitFor(() => {
      expect(authApiMocks.changePassword).toHaveBeenCalledWith({
        new_password: "new-pass",
        old_password: "123"
      });
    });
    expect(getMustChangePassword()).toBe(false);
    expect(await screen.findByRole("heading", { name: "活动页已打开" })).toBeInTheDocument();
  });

  it("redirects to login when the session expires", async () => {
    const user = userEvent.setup();
    authApiMocks.changePassword.mockRejectedValue(new SessionExpiredError());

    renderChangePasswordPage();

    await user.type(screen.getByLabelText("旧密码"), "123");
    await user.type(screen.getByLabelText("新密码"), "new-pass");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    expect(await screen.findByRole("heading", { name: "登录页已打开" })).toBeInTheDocument();
  });

  it("shows error message when change password fails", async () => {
    const user = userEvent.setup();
    authApiMocks.changePassword.mockRejectedValue(new Error("旧密码不正确"));

    renderChangePasswordPage();

    await user.type(screen.getByLabelText("旧密码"), "wrong");
    await user.type(screen.getByLabelText("新密码"), "new-pass");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    expect(await screen.findByText("旧密码不正确")).toBeInTheDocument();
  });

  it("allows the self-service entry and returns to profile after success", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    saveAuthSession({
      must_change_password: false,
      session_token: "sess_self_service_123",
      user_profile: {
        name: "李四",
        student_id: "20230002"
      }
    });
    authApiMocks.changePassword.mockResolvedValue({
      must_change_password: false,
      status: "success"
    });

    renderSelfServiceChangePasswordRoute();

    expect(await screen.findByRole("heading", { name: "修改密码" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("旧密码"), "123");
    await user.type(screen.getByLabelText("新密码"), "safe-pass");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    await waitFor(() => {
      expect(authApiMocks.changePassword).toHaveBeenCalledWith({
        new_password: "safe-pass",
        old_password: "123"
      });
    });
    expect(await screen.findByRole("heading", { name: "我的" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "活动列表" })).not.toBeInTheDocument();
  });
});
