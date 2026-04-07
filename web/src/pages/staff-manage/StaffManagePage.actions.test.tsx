import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { buildActivityDetail, renderStaffManagePage } from "./staff-manage-test-helpers";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

const staffApiMocks = vi.hoisted(() => ({
  adjustAttendanceStates: vi.fn(),
  bulkCheckout: vi.fn(),
  getActivityRoster: vi.fn(),
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
  adjustAttendanceStates: staffApiMocks.adjustAttendanceStates,
  bulkCheckout: staffApiMocks.bulkCheckout,
  getActivityRoster: staffApiMocks.getActivityRoster,
  getCodeSession: staffApiMocks.getCodeSession
}));

function readAppStyles() {
  const stylesDir = path.resolve(import.meta.dirname, "../../app/styles");
  return fs.readdirSync(stylesDir)
    .filter((fileName) => fileName.endsWith(".css"))
    .sort()
    .map((fileName) => fs.readFileSync(path.join(stylesDir, fileName), "utf8"))
    .join("\n");
}

const baseCss = readAppStyles();

describe("StaffManagePage actions", () => {
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
      affected_count: 0,
      status: "success"
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearSession();
  });

  it("shows the code hero as the only primary card on the manage page", async () => {
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
    expect(document.querySelector(".staff-manage-workbench")).toBeInTheDocument();
    expect(document.querySelector(".staff-manage-workbench__summary")).toHaveTextContent("校园志愿活动");
    expect(document.querySelector(".staff-manage-workbench__hero")).toContainElement(screen.getByText("483920"));
    expect(document.querySelector(".staff-manage-workbench__stats .staff-panel__stats-strip")).toHaveTextContent("累计签到");
    expect(document.querySelector(".staff-manage-workbench__danger")).toContainElement(
      screen.getByRole("button", { name: "一键全部签退" })
    );
    expect(document.querySelectorAll(".staff-code-panel__card")).toHaveLength(1);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
  });

  it("renders user-facing helper copy instead of development terminology", async () => {
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
    expect(screen.getByText("刷新动态码")).toBeInTheDocument();
    expect(screen.getByText("如需获取最新验证码或人数变化，可手动刷新。")).toBeInTheDocument();
    expect(screen.getByText("活动结束后，可在这里统一完成签退。")).toBeInTheDocument();
    expect(screen.queryByText("刷新工作台")).not.toBeInTheDocument();
    expect(screen.queryByText("正常态下只刷新当前动态码；阻断态会走完整安全刷新。")).not.toBeInTheDocument();
    expect(screen.queryByText("这里保留唯一的批量高风险入口，避免它和发码、刷新动作混在同一层里。")).not.toBeInTheDocument();
  });

  it("defines a desktop workbench layout that promotes the dynamic code area out of the single mobile column", () => {
    expect(baseCss).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*\.mobile-page\[data-page-layout="showcase-auto"\]\s+\.staff-manage-workbench\s*\{[\s\S]*grid-template-columns:/);
    expect(baseCss).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*\.mobile-page\[data-page-layout="showcase-auto"\]\s+\.staff-manage-workbench__hero\s*\{[\s\S]*grid-column:\s*2/);
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
