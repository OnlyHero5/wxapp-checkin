import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSession, getSession, saveAuthSession } from "../../shared/session/session-store";
import { ProfilePage } from "./ProfilePage";

const profileFieldsCount = 4;

function renderProfilePage() {
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<h1>登录页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_profile_123",
      user_profile: {
        club: "青年志愿者协会",
        department: "计算机科学与技术学院",
        name: "张三",
        student_id: "20230001"
      }
    });
  });

  afterEach(() => {
    clearSession();
  });

  it("shows the current session profile and account actions", () => {
    renderProfilePage();

    expect(screen.getByRole("heading", { name: "我的" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
    expect(document.querySelectorAll(".profile-page__panel")).toHaveLength(1);
    expect(document.querySelector(".profile-page__panel")).toHaveAttribute("data-panel-tone", "brand");
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(document.querySelector(".profile-page__title")).toHaveTextContent("张三");
    expect(screen.getByText("姓名")).toBeInTheDocument();
    expect(screen.getByText("姓名").closest(".profile-page__field-row")).toHaveTextContent("张三");
    expect(screen.getByText("学号")).toBeInTheDocument();
    expect(screen.getByText("20230001")).toBeInTheDocument();
    expect(screen.getByText("院系")).toBeInTheDocument();
    expect(screen.getByText("计算机科学与技术学院")).toBeInTheDocument();
    expect(screen.getByText("社团")).toBeInTheDocument();
    expect(screen.getByText("青年志愿者协会")).toBeInTheDocument();
    expect(screen.getByText(/工作人员/)).toBeInTheDocument();
    expect(document.querySelectorAll(".profile-page__field-row").length).toBe(profileFieldsCount);
    expect(screen.getByRole("button", { name: "退出登录" }).className).toContain("t-button");
    expect(screen.getByRole("button", { name: "退出登录" })).toHaveClass("app-button");
  });

  it("clears the session and goes back to login after logout", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(screen.getByRole("button", { name: "退出登录" }));

    expect(screen.getByRole("heading", { name: "登录页已打开" })).toBeInTheDocument();
    expect(getSession()).toBe("");
  });
});
