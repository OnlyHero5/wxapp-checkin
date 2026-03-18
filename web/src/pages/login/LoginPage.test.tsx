import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../../shared/session/session-store";
import { LoginPage } from "./LoginPage";

const authApiMocks = vi.hoisted(() => ({
  login: vi.fn()
}));

vi.mock("../../features/auth/api", () => ({
  login: authApiMocks.login
}));

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<h1>改密页已打开</h1>} />
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

  it("logs in and navigates to change-password when must_change_password is true", async () => {
    const user = userEvent.setup();
    authApiMocks.login.mockResolvedValue({
      must_change_password: true,
      session_token: "sess_login_123",
      status: "success"
    });

    renderLoginPage();

    const heading = screen.getByRole("heading", { name: "登录" });
    const description = screen.getByText("账号为学号，初始密码统一为 123。首次登录成功后需要先修改密码。");

    expect(heading.closest(".mobile-page__hero")).not.toBeNull();
    expect(description.closest(".mobile-page__description")).not.toBeNull();

    await user.type(screen.getByLabelText("学号"), " 2025000011 ");
    await user.type(screen.getByLabelText("密码"), " 123 ");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(authApiMocks.login).toHaveBeenCalledWith({
        password: "123",
        student_id: "2025000011"
      });
    });
    expect(getSession()).toBe("sess_login_123");
    expect(await screen.findByRole("heading", { name: "改密页已打开" })).toBeInTheDocument();
  });

  it("logs in and navigates to activities when must_change_password is false", async () => {
    const user = userEvent.setup();
    authApiMocks.login.mockResolvedValue({
      must_change_password: false,
      session_token: "sess_login_123",
      status: "success"
    });

    renderLoginPage();

    await user.type(screen.getByLabelText("学号"), "2025000011");
    await user.type(screen.getByLabelText("密码"), "123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(authApiMocks.login).toHaveBeenCalled();
    });
    expect(await screen.findByRole("heading", { name: "活动页已打开" })).toBeInTheDocument();
  });

  it("shows error message when login fails", async () => {
    const user = userEvent.setup();
    authApiMocks.login.mockRejectedValue(new Error("密码错误"));

    renderLoginPage();

    expect(screen.getByRole("button", { name: "登录" }).closest(".mobile-page__section")).not.toBeNull();

    await user.type(screen.getByLabelText("学号"), "2025000011");
    await user.type(screen.getByLabelText("密码"), "wrong");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("密码错误")).toBeInTheDocument();
    expect(getSession()).toBe("");
  });
});
