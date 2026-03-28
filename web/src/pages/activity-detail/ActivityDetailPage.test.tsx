import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession } from "../../shared/session/session-store";
import { ActivityDetailPage } from "./ActivityDetailPage";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivityDetail: activitiesApiMocks.getActivityDetail
  };
});

function renderActivityDetailPage(path = "/activities/act_101") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
        <Route path="/staff/activities/:activityId/manage" element={<h1>管理页已打开</h1>} />
        <Route path="/staff/activities/:activityId/roster" element={<h1>名单页已打开</h1>} />
        <Route path="/activities/:activityId/checkin" element={<h1>签到页已打开</h1>} />
        <Route path="/activities/:activityId/checkout" element={<h1>签退页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ActivityDetailPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    saveAuthSession({
      permissions: [],
      role: "normal",
      session_token: "sess_detail_123"
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("shows the loading state before the detail is ready", () => {
    activitiesApiMocks.getActivityDetail.mockReturnValue(new Promise(() => undefined));

    renderActivityDetailPage();

    expect(screen.getByRole("heading", { name: "活动详情" })).toBeInTheDocument();
    expect(screen.getByText("活动详情加载中...")).toBeInTheDocument();
  });

  it("renders the staff detail tone and management entry", async () => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_detail_123"
    });
    activitiesApiMocks.getActivityDetail.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      activity_type: "志愿",
      start_time: "2026-03-10 09:00:00",
      location: "本部操场",
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
    });

    renderActivityDetailPage();

    expect(await screen.findByRole("heading", { level: 1, name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByText("负责现场秩序维护").closest("[data-panel-tone]")).toHaveAttribute("data-panel-tone", "staff");
    expect(document.querySelectorAll("section.activity-meta-panel")).toHaveLength(1);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(document.querySelector(".detail-actions--bento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入管理" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "去签到" })).not.toBeInTheDocument();
  });

  it("renders attendee actions through thin TDesign buttons instead of custom accent classes", async () => {
    activitiesApiMocks.getActivityDetail.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      activity_type: "志愿",
      start_time: "2026-03-10 09:00:00",
      location: "本部操场",
      description: "负责现场秩序维护",
      progress_status: "ongoing",
      support_checkin: true,
      support_checkout: true,
      can_checkin: true,
      can_checkout: true,
      my_registered: true,
      my_checked_in: true,
      my_checked_out: false,
      checkin_count: 18,
      checkout_count: 3
    });

    renderActivityDetailPage();

    expect(await screen.findByRole("heading", { level: 1, name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "校园志愿活动" })).toBeInTheDocument();
    expect(document.querySelectorAll("section.activity-meta-panel")).toHaveLength(1);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(document.querySelector(".detail-actions--bento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去签到" }).className).toContain("t-button");
    expect(screen.getByRole("button", { name: "去签到" })).toHaveClass("app-button");
    expect(screen.getByRole("button", { name: "去签退" }).className).toContain("t-button");
    expect(screen.getByRole("button", { name: "去签退" })).toHaveClass("app-button");
  });

  it("shows the roster entry for staff sessions and navigates to roster page", async () => {
    const user = userEvent.setup();
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_roster_detail_123"
    });
    activitiesApiMocks.getActivityDetail.mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      activity_type: "志愿",
      start_time: "2026-03-10 09:00:00",
      location: "本部操场",
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
    });

    renderActivityDetailPage();

    expect(await screen.findByRole("heading", { level: 1, name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "校园志愿活动" })).toBeInTheDocument();
    expect(document.querySelectorAll("section.activity-meta-panel")).toHaveLength(1);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(document.querySelector(".detail-actions--bento")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "参会名单" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "名单页已打开" })).toBeInTheDocument();
    });
  });
});
