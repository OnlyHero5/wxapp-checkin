import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession, setSession } from "../../shared/session/session-store";
import { AppBusinessNav } from "../../shared/ui/AppBusinessNav";
import { ActivitiesPage } from "./ActivitiesPage";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivities: vi.fn()
}));

vi.mock("../../features/activities/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/activities/api")>();
  return {
    ...actual,
    getActivities: activitiesApiMocks.getActivities
  };
});

function renderActivitiesPage() {
  render(
    <MemoryRouter initialEntries={["/activities"]}>
      <Routes>
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activities/:activityId" element={<h1>详情页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderBusinessNav(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppBusinessNav />
    </MemoryRouter>
  );
}

describe("ActivitiesPage", () => {
  beforeEach(() => {
    setSession("sess_activities_123");
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("renders visible activities by progress sections", async () => {
    activitiesApiMocks.getActivities.mockResolvedValue({
      activities: [
        {
          activity_id: "act_ongoing",
          activity_title: "校园志愿活动",
          activity_type: "志愿",
          start_time: "2026-03-10 09:00:00",
          location: "本部操场",
          progress_status: "ongoing",
          support_checkin: true,
          support_checkout: true,
          my_registered: true,
          my_checked_in: false,
          my_checked_out: false,
          checkin_count: 18,
          checkout_count: 3
        },
        {
          activity_id: "act_completed",
          activity_title: "创新论坛",
          activity_type: "论坛",
          start_time: "2026-03-01 19:00:00",
          location: "学术报告厅",
          progress_status: "completed",
          support_checkin: false,
          support_checkout: false,
          my_registered: true,
          my_checked_in: true,
          my_checked_out: true,
          checkin_count: 56,
          checkout_count: 56
        },
        {
          activity_id: "act_hidden",
          activity_title: "不应展示的活动",
          activity_type: "路演",
          start_time: "2026-03-09 19:00:00",
          location: "隐藏地点",
          progress_status: "ongoing",
          support_checkin: true,
          support_checkout: true,
          my_registered: false,
          my_checked_in: false,
          my_checked_out: false,
          checkin_count: 0,
          checkout_count: 0
        }
      ]
    });

    renderActivitiesPage();

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
    expect(screen.getByText("查看你当前可见的活动，并进入详情页继续签到或签退。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "正在进行" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "历史活动" })).toBeInTheDocument();
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByText("创新论坛")).toBeInTheDocument();
    expect(screen.getByText("已报名")).toBeInTheDocument();
    expect(screen.getAllByText("已签退").length).toBeGreaterThan(0);
    expect(screen.queryByText("不应展示的活动")).not.toBeInTheDocument();
    expect(screen.queryByText("累计签到")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "活动分段" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "历史活动" })).toHaveAttribute("href", "#completed");
    expect(screen.getAllByRole("link", { name: "查看详情" })).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
  });

  it("shows all activities and management entries for staff sessions", async () => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_123"
    });
    activitiesApiMocks.getActivities.mockResolvedValue({
      activities: [
        {
          activity_id: "act_manage_101",
          activity_title: "管理态活动 A",
          activity_type: "竞赛",
          start_time: "2026-03-10 09:00:00",
          location: "创新中心",
          progress_status: "ongoing",
          support_checkin: true,
          support_checkout: true,
          my_registered: false,
          my_checked_in: false,
          my_checked_out: false,
          checkin_count: 18,
          checkout_count: 3
        },
        {
          activity_id: "act_manage_202",
          activity_title: "管理态活动 B",
          activity_type: "讲座",
          start_time: "2026-03-01 19:00:00",
          location: "学术报告厅",
          progress_status: "completed",
          support_checkin: false,
          support_checkout: false,
          my_registered: false,
          my_checked_in: false,
          my_checked_out: false,
          checkin_count: 56,
          checkout_count: 56
        }
      ]
    });

    renderActivitiesPage();

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
    expect(screen.getByText("查看活动并进入管理页展示动态码、处理批量签退。")).toBeInTheDocument();
    expect(screen.getByText("管理态活动 A")).toBeInTheDocument();
    expect(screen.getByText("管理态活动 B")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "进入管理" })).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByText("管理态活动 A").closest("article")).toHaveAttribute("data-panel-tone", "staff");
  });

  it("marks the active business nav item with a stable accent class", () => {
    renderBusinessNav("/activities");

    expect(screen.getByRole("link", { name: "活动" })).toHaveClass(
      "page-bottom-nav__item",
      "page-bottom-nav__item--active",
      "page-bottom-nav__item--accent-staff"
    );
    expect(screen.getByRole("link", { name: "我的" })).toHaveClass("page-bottom-nav__item--accent-brand");
  });
});
