import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("logs in and navigates directly to activities", async () => {
    const user = userEvent.setup();
    authApiMocks.login.mockResolvedValue({
      session_token: "sess_login_123",
      status: "success"
    });

    renderLoginPage();

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByText("账号为学号，请输入当前可用密码。")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
    expect(screen.getByRole("button", { name: "登录" })).toHaveClass("app-button--accent-brand");
    expect(screen.getByRole("button", { name: "登录" })).toHaveAttribute("type", "submit");
    expect(screen.getByPlaceholderText("请输入学号").closest(".t-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入密码").closest(".t-input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("请输入学号").closest(".t-form")).toBeInTheDocument();

    const form = screen.getByPlaceholderText("请输入学号").closest("form");
    expect(form).not.toBeNull();

    await user.type(screen.getByPlaceholderText("请输入学号"), " 2025000011 ");
    await user.type(screen.getByPlaceholderText("请输入密码"), " 123 ");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(authApiMocks.login).toHaveBeenCalledWith({
        password: "123",
        student_id: "2025000011"
      });
    });
    expect(getSession()).toBe("sess_login_123");
    expect(await screen.findByRole("heading", { name: "活动页已打开" })).toBeInTheDocument();
  });

  it("shows error message when login fails", async () => {
    const user = userEvent.setup();
    authApiMocks.login.mockRejectedValue(new Error("密码错误"));

    renderLoginPage();

    await user.type(screen.getByPlaceholderText("请输入学号"), "2025000011");
    await user.type(screen.getByPlaceholderText("请输入密码"), "wrong");
    fireEvent.submit(screen.getByPlaceholderText("请输入学号").closest("form")!);

    expect(await screen.findByText("密码错误")).toBeInTheDocument();
    expect(getSession()).toBe("");
  });
});
