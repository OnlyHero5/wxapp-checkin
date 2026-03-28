import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionExpiredError } from "../../shared/http/errors";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { ActivityRosterPage } from "./ActivityRosterPage";

const staffApiMocks = vi.hoisted(() => ({
  adjustAttendanceStates: vi.fn(),
  getActivityRoster: vi.fn()
}));

vi.mock("../../features/staff/api", () => ({
  adjustAttendanceStates: staffApiMocks.adjustAttendanceStates,
  getActivityRoster: staffApiMocks.getActivityRoster
}));

function renderActivityRosterPage() {
  render(
    <MemoryRouter initialEntries={["/staff/activities/act_101/roster"]}>
      <Routes>
        <Route path="/login" element={<h1>登录页已打开</h1>} />
        <Route path="/staff/activities/:activityId/roster" element={<ActivityRosterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ActivityRosterPage", () => {
  beforeEach(() => {
    saveAuthSession({
      permissions: ["activity:manage", "activity:roster", "activity:attendance-adjust"],
      role: "staff",
      session_token: "sess_staff_roster_123"
    });
    staffApiMocks.getActivityRoster.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      activity_type: "志愿",
      start_time: "2026-03-10 09:00:00",
      location: "本部操场",
      description: "负责现场秩序维护",
      registered_count: 2,
      checkin_count: 1,
      checkout_count: 1,
      items: [
        {
          user_id: 11,
          student_id: "2025000011",
          name: "测试用户",
          checked_in: true,
          checked_out: false,
          checkin_time: "2026-03-10 09:05",
          checkout_time: ""
        },
        {
          user_id: 12,
          student_id: "2025000012",
          name: "补签成员",
          checked_in: false,
          checked_out: false,
          checkin_time: "",
          checkout_time: ""
        }
      ],
      server_time_ms: 1760000003300,
      status: "success"
    });
    staffApiMocks.adjustAttendanceStates.mockResolvedValue({
      activity_id: "act_101",
      affected_count: 1,
      batch_id: "adj_123",
      status: "success"
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearSession();
  });

  it("loads roster summary and participants", async () => {
    renderActivityRosterPage();

    expect(await screen.findByRole("heading", { name: "参会名单" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByText("测试用户")).toBeInTheDocument();
    expect(screen.getByText("2025000011")).toBeInTheDocument();
    expect(screen.getByText("补签成员")).toBeInTheDocument();
    expect(document.querySelectorAll(".t-checkbox").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".t-cell-group--card").length).toBeGreaterThan(1);
    expect(document.querySelector(".t-list")).toBeInTheDocument();
    expect(document.querySelectorAll(".t-swipe-cell").length).toBeGreaterThan(0);
    expect(screen.getByText("0 人").closest("[data-panel-tone]")).toHaveAttribute("data-panel-tone", "staff");
    expect(screen.getByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(document.querySelector(".roster-item__actions")).toBeNull();
  });

  // 名单页的视觉增强必须挂在业务自有 class 上，
  // 否则后续一旦组件库升级，样式会再次直接失控。
  it("renders roster rows and swipe actions through project-owned styling hooks", async () => {
    renderActivityRosterPage();

    expect(await screen.findByText("测试用户")).toBeInTheDocument();
    expect(document.querySelector(".attendance-roster-list")).toBeInTheDocument();
    expect(document.querySelector(".attendance-roster-list__item")).toBeInTheDocument();
    expect(document.querySelector(".attendance-roster-list__group")).toBeInTheDocument();
    expect(document.querySelector(".attendance-roster-list__action")).toBeInTheDocument();
  });

  it("refreshes roster when the page becomes visible again", async () => {
    renderActivityRosterPage();

    expect(await screen.findByText("测试用户")).toBeInTheDocument();
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible"
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(2);
    });
  });

  it("supports single member adjustment", async () => {
    const user = userEvent.setup();
    renderActivityRosterPage();

    expect(await screen.findByText("补签成员")).toBeInTheDocument();
    // 单人动作直接走统一修正接口，页面不再为“单个 / 批量”维护两套写口径。
    await user.click(screen.getByText("设为已签到"));

    await waitFor(() => {
      expect(staffApiMocks.adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
        patch: {
          checked_in: true,
          checked_out: false
        },
        reason: "单人设为已签到",
        user_ids: [12]
      });
    });
  });

  it("supports batch adjustment with confirmation dialog", async () => {
    const user = userEvent.setup();
    renderActivityRosterPage();

    expect(await screen.findByText("测试用户")).toBeInTheDocument();
    const checkboxes = document.querySelectorAll(".t-checkbox");
    await user.click(checkboxes[0] as HTMLElement);
    await user.click(checkboxes[1] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "批量操作" }));
    await user.click(await screen.findByText("批量设为已签退"));

    expect(await screen.findByRole("button", { name: "确认批量修正" })).toBeInTheDocument();
    expect(screen.getAllByText("设为已签退会自动补成已签到。").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "确认批量修正" }));

    await waitFor(() => {
      expect(staffApiMocks.adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
        patch: {
          checked_in: true,
          checked_out: true
        },
        reason: "批量设为已签退",
        user_ids: [11, 12]
      });
    });
  });

  it("redirects to login when roster query hits auth errors", async () => {
    staffApiMocks.getActivityRoster.mockRejectedValueOnce(new SessionExpiredError());

    const firstView = render(
      <MemoryRouter initialEntries={["/staff/activities/act_101/roster"]}>
        <Routes>
          <Route path="/login" element={<h1>登录页已打开</h1>} />
          <Route path="/staff/activities/:activityId/roster" element={<ActivityRosterPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "登录页已打开" })).toBeInTheDocument();

    firstView.unmount();
  });

  it("uses a component-library loading state before roster data arrives", () => {
    staffApiMocks.getActivityRoster.mockReturnValue(new Promise(() => {}));

    renderActivityRosterPage();

    expect(screen.getByText("参会名单加载中...").closest(".t-loading")).toBeInTheDocument();
  });
});
