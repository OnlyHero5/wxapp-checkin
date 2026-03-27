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

describe("StaffManagePage code session", () => {
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
    expect(screen.getByRole("button", { name: "立即刷新" }).className).toContain("t-button");
    expect(screen.getByRole("button", { name: "立即刷新" })).not.toHaveClass("app-button");
    expect(screen.getByRole("link", { name: "返回活动详情" })).toHaveAttribute("href", "/activities/act_101");
    expect(screen.getByRole("link", { name: "返回活动详情" }).closest(".t-navbar__right")).toBeInTheDocument();

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
});
