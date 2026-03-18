import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveAuthSession, setSession } from "../../shared/session/session-store";
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

function DetailRouteHarness({ nextPath }: { nextPath?: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (nextPath) {
      navigate(nextPath);
    }
  }, [navigate, nextPath]);

  return (
    <Routes>
      <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
      <Route path="/activities/:activityId/checkin" element={<h1>签到页已打开</h1>} />
      <Route path="/activities/:activityId/checkout" element={<h1>签退页已打开</h1>} />
    </Routes>
  );
}

function DetailTestApp({ initialPath = "/activities/act_101", nextPath }: { initialPath?: string; nextPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <DetailRouteHarness nextPath={nextPath} />
    </MemoryRouter>
  );
}

function renderActivityDetailPage(initialPath?: string) {
  return render(<DetailTestApp initialPath={initialPath} />);
}

describe("ActivityDetailPage", () => {
  beforeEach(() => {
    setSession("sess_detail_123");
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSession();
  });

  it("shows activity detail and available actions", async () => {
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
      can_checkout: false,
      my_registered: true,
      my_checked_in: false,
      my_checked_out: false,
      checkin_count: 18,
      checkout_count: 3
    });

    renderActivityDetailPage();

    expect(await screen.findByRole("heading", { name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByText("负责现场秩序维护")).toBeInTheDocument();
    expect(screen.getByText("已报名")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去签到" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "去签退" })).not.toBeInTheDocument();
  });

  it("clears the previous activity detail when the route switches to another activity", async () => {
    let resolveSecondDetail: ((value: unknown) => void) | undefined;
    activitiesApiMocks.getActivityDetail
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        description: "负责现场秩序维护",
        progress_status: "ongoing",
        can_checkin: true,
        can_checkout: false,
        my_registered: true
      })
      .mockImplementationOnce(() => {
        return new Promise((resolve) => {
          resolveSecondDetail = resolve;
        });
      });

    const view = renderActivityDetailPage();

    expect(await screen.findByRole("heading", { name: "校园志愿活动" })).toBeInTheDocument();

    view.rerender(<DetailTestApp nextPath="/activities/act_202" />);

    expect(screen.getByRole("heading", { name: "活动详情" })).toBeInTheDocument();
    expect(screen.getByText("活动详情加载中...")).toBeInTheDocument();
    expect(screen.queryByText("校园志愿活动")).not.toBeInTheDocument();
    expect(screen.queryByText("负责现场秩序维护")).not.toBeInTheDocument();

    resolveSecondDetail?.({
      activity_id: "act_202",
      activity_title: "创新论坛",
      description: "路由切换后的新详情",
      progress_status: "ongoing",
      can_checkin: false,
      can_checkout: false,
      my_registered: true
    });

    expect(await screen.findByRole("heading", { name: "创新论坛" })).toBeInTheDocument();
  });

  it("shows the management entry for staff sessions", async () => {
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

    expect(await screen.findByRole("heading", { name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入管理" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "去签到" })).not.toBeInTheDocument();
  });
});
