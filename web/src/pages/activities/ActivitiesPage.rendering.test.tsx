import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { clearSession, saveAuthSession, setSession } from "../../shared/session/session-store";
import { AppBusinessNav } from "../../shared/ui/AppBusinessNav";
import { createActivity, renderActivitiesPage } from "./activities-page-test-helpers";

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

describe("ActivitiesPage rendering", () => {
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
        createActivity({
          activity_id: "act_ongoing",
          activity_title: "校园志愿活动",
          activity_type: "志愿",
          location: "本部操场"
        }),
        createActivity({
          activity_id: "act_completed",
          activity_title: "创新论坛",
          activity_type: "论坛",
          location: "学术报告厅",
          progress_status: "completed",
          support_checkin: false,
          support_checkout: false,
          my_checked_in: true,
          my_checked_out: true,
          checkin_count: 56,
          checkout_count: 56
        }),
        createActivity({
          activity_id: "act_hidden",
          activity_title: "不应展示的活动",
          activity_type: "路演",
          location: "隐藏地点",
          my_registered: false,
          checkin_count: 0,
          checkout_count: 0
        })
      ]
    });

    renderActivitiesPage();

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
    expect(screen.getByText("查看你当前可见的活动，并进入详情页继续签到或签退。")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { hidden: true, level: 2 }).map((heading) => heading.textContent)
    ).toEqual(expect.arrayContaining(["校园志愿活动", "创新论坛"]));
    expect(document.querySelector(".mobile-page__masthead")).toBeInTheDocument();
    expect(document.querySelector(".mobile-page__content-stack")).toBeInTheDocument();
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
    expect(screen.getAllByRole("link", { hidden: true, name: "查看详情" })).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
    expect(document.querySelectorAll("article.activity-meta-panel")).toHaveLength(2);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
  });

  it("shows all activities and management entries for staff sessions", async () => {
    saveAuthSession({
      permissions: ["activity:manage"],
      role: "staff",
      session_token: "sess_staff_123"
    });
    activitiesApiMocks.getActivities.mockResolvedValue({
      activities: [
        createActivity({
          activity_id: "act_manage_101",
          activity_title: "管理态活动 A",
          activity_type: "竞赛",
          location: "创新中心",
          my_registered: false
        }),
        createActivity({
          activity_id: "act_manage_202",
          activity_title: "管理态活动 B",
          activity_type: "讲座",
          location: "学术报告厅",
          progress_status: "completed",
          support_checkin: false,
          support_checkout: false,
          my_registered: false,
          checkin_count: 56,
          checkout_count: 56
        })
      ]
    });

    renderActivitiesPage();

    expect(await screen.findByRole("heading", { name: "活动列表" })).toBeInTheDocument();
    expect(screen.getByText("查看活动并进入管理页展示动态码、处理批量签退。")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { hidden: true, level: 2 }).map((heading) => heading.textContent)
    ).toEqual(expect.arrayContaining(["管理态活动 A", "管理态活动 B"]));
    expect(screen.getAllByRole("link", { hidden: true, name: "进入管理" })).toHaveLength(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
    expect(screen.getByRole("heading", { level: 2, name: "管理态活动 A" }).closest("article")).toHaveAttribute("data-panel-tone", "staff");
    expect(document.querySelectorAll("article.activity-meta-panel")).toHaveLength(2);
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
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

  it("keeps the business tab bar as a direct TDesign navigation", () => {
    render(
      <MemoryRouter initialEntries={["/activities"]}>
        <AppBusinessNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "业务导航" })).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "false");
  });
});
