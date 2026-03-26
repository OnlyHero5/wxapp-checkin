import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AppRoutes } from "./router";
import { clearSession, saveAuthSession, setSession } from "../shared/session/session-store";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn().mockResolvedValue({
    activity_id: "act_101",
    activity_title: "校园志愿活动",
    checkin_count: 18,
    checkout_count: 3,
    progress_status: "ongoing"
  }),
  getActivities: vi.fn().mockResolvedValue({
    activities: []
  })
}));

const staffApiMocks = vi.hoisted(() => ({
  adjustAttendanceStates: vi.fn(),
  bulkCheckout: vi.fn(),
  getCodeSession: vi.fn().mockResolvedValue({
    action_type: "checkin",
    activity_id: "act_101",
    checkin_count: 18,
    checkout_count: 3,
    code: "483920",
    expires_at: 1760000007500,
    expires_in_ms: 4200,
    server_time_ms: 1760000003300,
    status: "success"
  }),
  getActivityRoster: vi.fn().mockResolvedValue({
    activity_id: "act_101",
    activity_title: "校园志愿活动",
    items: [],
    status: "success"
  }),
}));

vi.mock("../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/activities/api")>();
  return {
    ...actual,
    getActivityDetail: activitiesApiMocks.getActivityDetail,
    getActivities: activitiesApiMocks.getActivities
  };
});

vi.mock("../features/staff/api", () => ({
  adjustAttendanceStates: staffApiMocks.adjustAttendanceStates,
  bulkCheckout: staffApiMocks.bulkCheckout,
  getCodeSession: staffApiMocks.getCodeSession,
  getActivityRoster: staffApiMocks.getActivityRoster
}));

function renderPath(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe("AppRoutes", () => {
  afterEach(() => {
    clearSession();
  });

  it("redirects the root path to login when session is missing", () => {
    renderPath("/");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("renders the login shell at /login", () => {
    renderPath("/login");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByText("账号为学号，请输入当前可用密码。")).toBeInTheDocument();
  });

  it("renders the activities shell at /activities", async () => {
    setSession("sess_123");
    renderPath("/activities");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "业务导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "活动" })).toHaveAttribute("href", "/activities");
    expect(screen.getByRole("link", { name: "活动" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "我的" })).toHaveAttribute("href", "/profile");
  });

  it("keeps the activities business nav active on activity action routes", async () => {
    setSession("sess_123");
    renderPath("/activities/test-1/checkin");

    expect(await screen.findByRole("heading", { name: "活动签到" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "业务导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "活动" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "我的" })).not.toHaveAttribute("aria-current");
  });

  it("redirects /activities to login when session is missing", () => {
    renderPath("/activities");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("redirects /login to activities when session exists", async () => {
    setSession("sess_123");
    renderPath("/login");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
  });

  it("does not show the business nav on /login", () => {
    renderPath("/login");

    expect(screen.queryByRole("navigation", { name: "业务导航" })).not.toBeInTheDocument();
  });

  it("redirects non-staff sessions away from the staff manage route", async () => {
    setSession("sess_123");
    renderPath("/staff/activities/act_101/manage");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
  });

  it("allows staff sessions to access the staff manage route", async () => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_123"
    });
    renderPath("/staff/activities/act_101/manage");

    expect(await screen.findByRole("heading", { name: "活动管理" })).toBeInTheDocument();
  });

  it("redirects non-staff sessions away from the staff roster route", async () => {
    setSession("sess_123");
    renderPath("/staff/activities/act_101/roster");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
  });

  it("allows staff sessions to access the staff roster route", async () => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_roster_123"
    });
    // 名单页和管理页是两个职责不同的入口，这里单独锁定名单页路由守卫，防止后续只挂了按钮却没挂 staff 保护。
    renderPath("/staff/activities/act_101/roster");

    expect(await screen.findByRole("heading", { name: "参会名单" })).toBeInTheDocument();
  });
});
