import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushSync } from "react-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAuthSession, clearSession } from "../../shared/session/session-store";
import { StaffManagePage } from "./StaffManagePage";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

const staffApiMocks = vi.hoisted(() => ({
  bulkCheckout: vi.fn(),
  getCodeSession: vi.fn()
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivityDetail: activitiesApiMocks.getActivityDetail
  };
});

vi.mock("../../features/staff/api", () => ({
  bulkCheckout: staffApiMocks.bulkCheckout,
  getCodeSession: staffApiMocks.getCodeSession
}));

function buildActivityDetail(activityId: string) {
  return {
    activity_id: activityId,
    activity_title: activityId === "act_202" ? "迎新引导活动" : "校园志愿活动",
    activity_type: "志愿",
    start_time: "2026-03-10 09:00:00",
    location: activityId === "act_202" ? "图书馆前广场" : "本部操场",
    description: "负责现场秩序维护",
    progress_status: "ongoing",
    support_checkin: true,
    support_checkout: true,
    can_checkin: false,
    can_checkout: false,
    my_registered: false,
    my_checked_in: false,
    my_checked_out: false,
    checkin_count: 18,
    checkout_count: 3
  };
}

function renderStaffManagePage() {
  render(
    <MemoryRouter initialEntries={["/staff/activities/act_101/manage"]}>
      <Routes>
        <Route path="/staff/activities/:activityId/manage" element={<StaffManagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderStaffManagePageWithControlledRoute() {
  let switchToNextActivity: (() => void) | undefined;

  function ControlledRouteHarness() {
    const [pathname, setPathname] = useState("/staff/activities/act_101/manage");
    switchToNextActivity = () => {
      setPathname("/staff/activities/act_202/manage");
    };

    return (
      <MemoryRouter initialEntries={["/staff/activities/act_101/manage"]}>
        <Routes location={pathname}>
          <Route path="/staff/activities/:activityId/manage" element={<StaffManagePage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  render(<ControlledRouteHarness />);

  return {
    switchToNextActivity() {
      switchToNextActivity?.();
    }
  };
}

describe("StaffManagePage", () => {
  beforeEach(() => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_manage_123"
    });
    activitiesApiMocks.getActivityDetail.mockImplementation(async (activityId: string) => buildActivityDetail(activityId));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    clearSession();
  });

  it("loads the current code session and allows switching action type", async () => {
    const user = userEvent.setup();
    staffApiMocks.getCodeSession
      .mockResolvedValueOnce({
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 18,
        checkout_count: 3,
        code: "483920",
        expires_at: 1760000007500,
        expires_in_ms: 4200,
        server_time_ms: 1760000003300,
        status: "success"
      })
      .mockResolvedValueOnce({
        action_type: "checkout",
        activity_id: "act_101",
        checkin_count: 18,
        checkout_count: 3,
        code: "654321",
        expires_at: 1760000015000,
        expires_in_ms: 5000,
        server_time_ms: 1760000010000,
        status: "success"
      });

    renderStaffManagePage();

    expect(await screen.findByRole("heading", { name: "活动管理" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "showcase-auto");
    expect(screen.getByText("483920")).toBeInTheDocument();
    expect(screen.getByText("483920").closest(".staff-panel")).toHaveAttribute("data-panel-tone", "staff");
    expect(screen.getByText("483920").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.getByText("实时统计")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即刷新" })).toHaveClass("app-button--accent-staff");
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回活动详情" })).toHaveAttribute("href", "/activities/act_101");
    expect(screen.getByRole("link", { name: "返回活动详情" }).closest(".mobile-page__actions")).toBeInTheDocument();

    await user.click(screen.getByText("签退码"));

    expect(await screen.findByText("654321")).toBeInTheDocument();
    expect(staffApiMocks.getCodeSession).toHaveBeenLastCalledWith("act_101", "checkout");
  });

  it("shows a placeholder hero while the next action code is still loading", async () => {
    const user = userEvent.setup();
    let resolveCheckout: ((value: unknown) => void) | undefined;
    const checkoutPromise = new Promise((resolve) => {
      resolveCheckout = resolve;
    });

    staffApiMocks.getCodeSession
      .mockResolvedValueOnce({
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 18,
        checkout_count: 3,
        code: "483920",
        expires_at: 1760000007500,
        expires_in_ms: 4200,
        server_time_ms: 1760000003300,
        status: "success"
      })
      .mockReturnValueOnce(checkoutPromise);

    renderStaffManagePage();

    expect(await screen.findByText("483920")).toBeInTheDocument();

    await user.click(screen.getByText("签退码"));

    expect(screen.getByText("当前签退码")).toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.queryByText("483920")).not.toBeInTheDocument();
    expect(staffApiMocks.getCodeSession).toHaveBeenLastCalledWith("act_101", "checkout");

    resolveCheckout?.({
      action_type: "checkout",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "654321",
      expires_at: 1760000015000,
      expires_in_ms: 5000,
      server_time_ms: 1760000010000,
      status: "success"
    });

    expect(await screen.findByText("654321")).toBeInTheDocument();
  });

  it("does not keep the previous activity title, code, or stats while switching routes on the same action tab", async () => {
    let resolveNextActivityDetail: ((value: unknown) => void) | undefined;
    let resolveNextActivityCode: ((value: unknown) => void) | undefined;
    const nextActivityDetailPromise = new Promise((resolve) => {
      resolveNextActivityDetail = resolve;
    });
    const nextActivityCodePromise = new Promise((resolve) => {
      resolveNextActivityCode = resolve;
    });

    activitiesApiMocks.getActivityDetail.mockImplementation(async (activityId: string) => {
      if (activityId === "act_101") {
        return {
          ...buildActivityDetail(activityId),
          activity_title: "旧活动标题 act_101",
          location: "旧活动场地",
          registered_count: 1200
        };
      }

      return nextActivityDetailPromise;
    });

    staffApiMocks.getCodeSession.mockImplementation(async (activityId: string) => {
      if (activityId === "act_101") {
        return {
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 900,
          checkout_count: 101,
          code: "483920",
          expires_at: 1760000007500,
          expires_in_ms: 4200,
          server_time_ms: 1760000003300,
          status: "success"
        };
      }

      return nextActivityCodePromise;
    });

    const routeDriver = renderStaffManagePageWithControlledRoute();

    expect(await screen.findByText("旧活动标题 act_101")).toBeInTheDocument();
    expect(await screen.findByText("483920")).toBeInTheDocument();
    expect(screen.getAllByText("1001")).toHaveLength(2);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      flushSync(() => {
        routeDriver.switchToNextActivity();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }

    expect(screen.getByText("当前签到码")).toBeInTheDocument();
    expect(screen.queryByText("旧活动标题 act_101")).not.toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.queryByText("483920")).not.toBeInTheDocument();
    expect(screen.queryAllByText("1001")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "返回活动详情" })).toHaveAttribute("href", "/activities/act_202");

    await act(async () => {
      await Promise.resolve();
    });

    expect(staffApiMocks.getCodeSession).toHaveBeenLastCalledWith("act_202", "checkin");

    resolveNextActivityCode?.({
      action_type: "checkin",
      activity_id: "act_202",
      checkin_count: 9,
      checkout_count: 1,
      code: "202202",
      expires_at: 1760000021000,
      expires_in_ms: 4500,
      server_time_ms: 1760000016500,
      status: "success"
    });
    resolveNextActivityDetail?.({
      ...buildActivityDetail("act_202"),
      activity_title: "新活动标题 act_202",
      location: "新活动场地",
      registered_count: 66
    });

    expect(await screen.findByText("202202")).toBeInTheDocument();
    expect(await screen.findByText("新活动标题 act_202")).toBeInTheDocument();
  });

  it("refreshes the current code session when the page becomes visible again", async () => {
    staffApiMocks.getCodeSession.mockResolvedValue({
      action_type: "checkin",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "483920",
      expires_at: 1760000007500,
      expires_in_ms: 4200,
      server_time_ms: 1760000003300,
      status: "success"
    });

    renderStaffManagePage();

    expect(await screen.findByText("483920")).toBeInTheDocument();
    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible"
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(2);
  });

  it("shows a wake lock hint when the browser cannot keep the screen awake", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: undefined
    });
    staffApiMocks.getCodeSession.mockResolvedValue({
      action_type: "checkin",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "483920",
      expires_at: 1760000007500,
      expires_in_ms: 4200,
      server_time_ms: 1760000003300,
      status: "success"
    });

    renderStaffManagePage();

    expect(await screen.findByText("当前浏览器不支持自动保持屏幕常亮，请手动关闭自动锁屏或保持屏幕常亮。")).toBeInTheDocument();
  });

  it("keeps the latest action code when an earlier request resolves late", async () => {
    const user = userEvent.setup();
    let resolveCheckin: ((value: unknown) => void) | undefined;
    let resolveCheckout: ((value: unknown) => void) | undefined;
    const checkinPromise = new Promise((resolve) => {
      resolveCheckin = resolve;
    });
    const checkoutPromise = new Promise((resolve) => {
      resolveCheckout = resolve;
    });

    staffApiMocks.getCodeSession
      .mockReturnValueOnce(checkinPromise)
      .mockReturnValueOnce(checkoutPromise);

    renderStaffManagePage();
    await user.click(await screen.findByText("签退码"));

    resolveCheckout?.({
      action_type: "checkout",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "654321",
      expires_at: 1760000015000,
      expires_in_ms: 5000,
      server_time_ms: 1760000010000,
      status: "success"
    });

    expect(await screen.findByText("654321")).toBeInTheDocument();

    resolveCheckin?.({
      action_type: "checkin",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "483920",
      expires_at: 1760000007500,
      expires_in_ms: 4200,
      server_time_ms: 1760000003300,
      status: "success"
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("654321")).toBeInTheDocument();
  });

  it("updates the countdown and refreshes the code when it expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T03:00:03.300Z"));

    staffApiMocks.getCodeSession
      .mockResolvedValueOnce({
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 18,
        checkout_count: 3,
        code: "483920",
        expires_at: 1760000005300,
        expires_in_ms: 2000,
        server_time_ms: 1760000003300,
        status: "success"
      })
      .mockResolvedValueOnce({
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 19,
        checkout_count: 3,
        code: "111222",
        expires_at: 1760000012800,
        expires_in_ms: 7500,
        server_time_ms: 1760000005300,
        status: "success"
      });

    renderStaffManagePage();

    await act(async () => {
      vi.advanceTimersByTime(16);
      await Promise.resolve();
    });

    expect(document.querySelector(".staff-code-panel__meta")).toHaveTextContent("剩余时间：");
    expect(document.querySelector(".staff-code-panel__countdown")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(document.querySelector(".staff-code-panel__countdown")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(2);
    expect(screen.getByText("111222")).toBeInTheDocument();
  });

  it("confirms bulk checkout and refreshes the page state", async () => {
    const user = userEvent.setup();
    staffApiMocks.getCodeSession.mockResolvedValue({
      action_type: "checkin",
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "483920",
      expires_at: 1760000007500,
      expires_in_ms: 4200,
      server_time_ms: 1760000003300,
      status: "success"
    });
    staffApiMocks.bulkCheckout.mockResolvedValue({
      activity_id: "act_101",
      affected_count: 12,
      batch_id: "batch_123",
      message: "批量签退完成",
      server_time_ms: 1760000005000,
      status: "success"
    });

    renderStaffManagePage();

    expect(await screen.findByText("483920")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "一键全部签退" }));
    await user.click(screen.getByRole("button", { name: "确认全部签退" }));

    expect(staffApiMocks.bulkCheckout).toHaveBeenCalledWith("act_101", {
      confirm: true,
      reason: "活动结束统一签退"
    });
    expect(await screen.findByText("批量签退完成")).toBeInTheDocument();
  });
});
