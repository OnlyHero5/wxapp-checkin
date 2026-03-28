import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { buildActivityDetail, renderStaffManagePage } from "./staff-manage-test-helpers";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

const staffApiMocks = vi.hoisted(() => ({
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
  bulkCheckout: staffApiMocks.bulkCheckout,
  getCodeSession: staffApiMocks.getCodeSession
}));

describe("StaffManagePage actions", () => {
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

  it("updates the countdown and refreshes the code when it expires", async () => {
    const user = userEvent.setup();

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
      await Promise.resolve();
    });

    expect(document.querySelector(".staff-code-panel__meta")).toHaveTextContent("剩余时间");
    expect(document.querySelector(".staff-code-panel__countdown")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "触发动态码过期" }));
    await act(async () => {
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
