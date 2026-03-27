import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function createActivity(overrides: Partial<{
  activity_id: string;
  activity_title: string;
  activity_type: string;
  start_time: string;
  location: string;
  progress_status: string;
  support_checkin: boolean;
  support_checkout: boolean;
  my_registered: boolean;
  my_checked_in: boolean;
  my_checked_out: boolean;
  checkin_count: number;
  checkout_count: number;
}> = {}) {
  return {
    activity_id: "act_default_101",
    activity_title: "默认活动",
    activity_type: "活动",
    start_time: "2026-03-10 09:00:00",
    location: "独墅湖校区",
    progress_status: "ongoing",
    support_checkin: true,
    support_checkout: true,
    my_registered: true,
    my_checked_in: false,
    my_checked_out: false,
    checkin_count: 18,
    checkout_count: 3,
    ...overrides
  };
}

describe("ActivitiesPage", () => {
  beforeEach(() => {
    setSession("sess_activities_123");
  });

  afterEach(() => {
    vi.resetAllMocks();
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
    expect(document.querySelector(".t-tabs")).toBeInTheDocument();
    expect(document.querySelector(".t-list")).toBeInTheDocument();
    expect(screen.getByText("正在进行")).toBeInTheDocument();
    expect(screen.getByText("历史活动")).toBeInTheDocument();
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByText("创新论坛")).toBeInTheDocument();
    expect(screen.getByText("已报名")).toBeInTheDocument();
    expect(screen.getAllByText("已签退").length).toBeGreaterThan(0);
    expect(screen.queryByText("不应展示的活动")).not.toBeInTheDocument();
    expect(screen.queryByText("累计签到")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "活动分段" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "页面导航" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { hidden: true, name: "查看详情" })).toHaveLength(2);
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
    expect(screen.getAllByRole("link", { hidden: true, name: "进入管理" })).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByText("管理态活动 A").closest("article")).toHaveAttribute("data-panel-tone", "staff");
  });

  it("marks the active business nav item with a stable accent class", () => {
    renderBusinessNav("/activities");

    expect(screen.getByRole("navigation", { name: "业务导航" })).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("活动")).toBeInTheDocument();
    expect(screen.getByText("我的")).toBeInTheDocument();
  });

  it("uses a component-library loading state while the first page is still pending", () => {
    activitiesApiMocks.getActivities.mockReturnValue(new Promise(() => {}));

    renderActivitiesPage();

    expect(screen.getByText("活动列表加载中...").closest(".t-loading")).toBeInTheDocument();
  });

  it("uses component-library empty states instead of handwritten empty paragraphs", async () => {
    activitiesApiMocks.getActivities.mockResolvedValue({
      activities: []
    });

    renderActivitiesPage();

    expect(await screen.findByText("正在进行暂无活动。")).toBeInTheDocument();
    expect(screen.getAllByText(/暂无活动/)[0].closest(".t-empty")).toBeInTheDocument();
    expect(screen.getAllByText(/暂无活动/)[1].closest(".t-empty")).toBeInTheDocument();
  });

  it("submits search with the first page and keeps the keyword while loading more", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.getActivities
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_initial_101",
          activity_title: "默认第一页活动"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_101",
          activity_title: "奖学金补录专场"
        })],
        has_more: true,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_202",
          activity_title: "奖学金历史补签"
        })],
        has_more: false,
        page: 2
      });

    renderActivitiesPage();

    expect(await screen.findByText("默认第一页活动")).toBeInTheDocument();
    expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(1, {
      page: 1,
      page_size: 50
    });

    const searchInput = screen.getByPlaceholderText(/搜索活动/i);
    await user.type(searchInput, "奖学金");
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(2, {
        keyword: "奖学金",
        page: 1,
        page_size: 50
      });
    });
    expect(await screen.findByText("奖学金补录专场")).toBeInTheDocument();

    await user.click(screen.getByText("加载更多"));

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(3, {
        keyword: "奖学金",
        page: 2,
        page_size: 50
      });
    });
    expect(await screen.findByText("奖学金历史补签")).toBeInTheDocument();
  });

  it("clears the submitted keyword and reloads the default first page", async () => {
    const user = userEvent.setup();
    activitiesApiMocks.getActivities
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_initial_301",
          activity_title: "默认活动列表"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_search_301",
          activity_title: "漏加分专场"
        })],
        has_more: false,
        page: 1
      })
      .mockResolvedValueOnce({
        activities: [createActivity({
          activity_id: "act_reset_301",
          activity_title: "恢复默认列表"
        })],
        has_more: false,
        page: 1
      });

    renderActivitiesPage();

    expect(await screen.findByText("默认活动列表")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/搜索活动/i);
    await user.type(searchInput, "漏加分");
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    expect(await screen.findByText("漏加分专场")).toBeInTheDocument();

    await user.clear(searchInput);
    fireEvent.keyDown(searchInput, { code: "Enter", key: "Enter" });

    await waitFor(() => {
      expect(activitiesApiMocks.getActivities).toHaveBeenNthCalledWith(3, {
        page: 1,
        page_size: 50
      });
    });
    expect(await screen.findByText("恢复默认列表")).toBeInTheDocument();
  });
});
