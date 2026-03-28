import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import {
  buildActivityDetail,
  renderStaffManagePage,
  renderStaffManagePageWithControlledRoute
} from "./staff-manage-test-helpers";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

const staffApiMocks = vi.hoisted(() => ({
  adjustAttendanceStates: vi.fn(),
  getActivityRoster: vi.fn(),
  bulkCheckout: vi.fn(),
  getCodeSession: vi.fn()
}));

vi.mock("tdesign-mobile-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("tdesign-mobile-react")>();

  return {
    ...actual,
    CountDown: ({ onFinish }: { onFinish?: () => void }) => (
      <button className="t-count-down" onClick={onFinish} type="button">
        触发动态码过期
      </button>
    )
  };
});

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivityDetail: activitiesApiMocks.getActivityDetail
  };
});

vi.mock("../../features/staff/api", () => ({
  adjustAttendanceStates: staffApiMocks.adjustAttendanceStates,
  getActivityRoster: staffApiMocks.getActivityRoster,
  bulkCheckout: staffApiMocks.bulkCheckout,
  getCodeSession: staffApiMocks.getCodeSession
}));

describe("StaffManagePage lifecycle", () => {
  beforeEach(() => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_manage_123"
    });
    activitiesApiMocks.getActivityDetail.mockImplementation(async (activityId: string) => buildActivityDetail(activityId));
    staffApiMocks.getActivityRoster.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      items: []
    });
    staffApiMocks.adjustAttendanceStates.mockResolvedValue({
      activity_id: "act_101",
      affected_count: 1,
      status: "success"
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    clearSession();
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

  it("self-heals dirty checkout members and refreshes detail plus code session again", async () => {
    staffApiMocks.getActivityRoster
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 12,
            student_id: "2025000012",
            name: "异常成员",
            checked_in: false,
            checked_out: true,
            checkin_time: "",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      })
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 12,
            student_id: "2025000012",
            name: "异常成员",
            checked_in: true,
            checked_out: true,
            checkin_time: "2026-03-10 09:05",
            checkout_time: "2026-03-10 10:10"
          }
        ]
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

    expect(await screen.findByText("483920")).toBeInTheDocument();
    await waitFor(() => {
      expect(staffApiMocks.adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
        user_ids: [12],
        patch: { checked_out: true },
        reason: "自动修复异常签退状态"
      });
    });
    await waitFor(() => {
      expect(activitiesApiMocks.getActivityDetail).toHaveBeenCalledTimes(2);
      expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps roster self-heal off pure code-session refreshes", async () => {
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
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 19,
        checkout_count: 3,
        code: "111222",
        expires_at: 1760000011500,
        expires_in_ms: 5000,
        server_time_ms: 1760000006500,
        status: "success"
      })
      .mockResolvedValueOnce({
        action_type: "checkout",
        activity_id: "act_101",
        checkin_count: 19,
        checkout_count: 3,
        code: "654321",
        expires_at: 1760000019500,
        expires_in_ms: 5000,
        server_time_ms: 1760000014500,
        status: "success"
      });

    renderStaffManagePage();

    expect(await screen.findByText("483920")).toBeInTheDocument();
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "立即刷新" }));

    expect(await screen.findByText("111222")).toBeInTheDocument();
    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(2);
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(1);
    const codeRefreshCallCount = staffApiMocks.getCodeSession.mock.calls.length;

    await user.click(screen.getByText("签退码"));

    await waitFor(() => {
      expect(staffApiMocks.getCodeSession.mock.calls.length).toBeGreaterThan(codeRefreshCallCount);
      expect(staffApiMocks.getCodeSession).toHaveBeenLastCalledWith("act_101", "checkout");
    });
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(1);
  });

  it("blocks risky staff actions when a required self-heal check fails", async () => {
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
        action_type: "checkin",
        activity_id: "act_101",
        checkin_count: 19,
        checkout_count: 4,
        code: "222333",
        expires_at: 1760000017500,
        expires_in_ms: 4200,
        server_time_ms: 1760000013300,
        status: "success"
      });
    staffApiMocks.getActivityRoster
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: []
      })
      .mockRejectedValueOnce(new Error("heal check failed"))
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: []
      });

    renderStaffManagePage();

    expect(await screen.findByText("483920")).toBeInTheDocument();
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(1);
    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(1);
    expect(activitiesApiMocks.getActivityDetail).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible"
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText("heal check failed")).toBeInTheDocument();
    expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(2);
    expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(1);
    expect(activitiesApiMocks.getActivityDetail).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("483920")).not.toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.getByRole("button", { name: "一键全部签退" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "立即刷新" }));

    await waitFor(() => {
      expect(staffApiMocks.getActivityRoster).toHaveBeenCalledTimes(3);
      expect(staffApiMocks.getCodeSession).toHaveBeenCalledTimes(2);
      expect(activitiesApiMocks.getActivityDetail).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("222333")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一键全部签退" })).not.toBeDisabled();
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
});
