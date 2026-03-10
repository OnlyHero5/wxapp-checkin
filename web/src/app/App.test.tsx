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
  approveUnbindReview: vi.fn(),
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
  getUnbindReviews: vi.fn().mockResolvedValue({
    items: [],
    status: "success"
  }),
  rejectUnbindReview: vi.fn()
}));

vi.mock("../shared/device/browser-capability", () => ({
  detectBrowserCapability: () => ({
    hasCredentialManager: true,
    hasPasskeySupport: true,
    hasVisibilityLifecycle: true,
    hasWakeLock: false
  })
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
  approveUnbindReview: staffApiMocks.approveUnbindReview,
  bulkCheckout: staffApiMocks.bulkCheckout,
  getCodeSession: staffApiMocks.getCodeSession,
  getUnbindReviews: staffApiMocks.getUnbindReviews,
  rejectUnbindReview: staffApiMocks.rejectUnbindReview
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
  });

  it("renders the bind shell at /bind", () => {
    renderPath("/bind");

    expect(screen.getByRole("heading", { name: "身份绑定" })).toBeInTheDocument();
  });

  it("renders the activities shell at /activities", async () => {
    setSession("sess_123");
    renderPath("/activities");

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
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

  it("allows review-capable sessions to access the unbind review route", async () => {
    saveAuthSession({
      permissions: ["unbind:review"],
      role: "staff",
      session_token: "sess_review_123"
    });
    renderPath("/staff/unbind-reviews");

    expect(await screen.findByRole("heading", { name: "解绑审核" })).toBeInTheDocument();
  });
});
