import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setSession } from "../../shared/session/session-store";
import { ActivityDetailPage } from "./ActivityDetailPage";

const activitiesApiMocks = vi.hoisted(() => ({
  getActivityDetail: vi.fn()
}));

vi.mock("../../features/activities/api", () => ({
  getActivityDetail: activitiesApiMocks.getActivityDetail
}));

function renderActivityDetailPage() {
  render(
    <MemoryRouter initialEntries={["/activities/act_101"]}>
      <Routes>
        <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
        <Route path="/activities/:activityId/checkin" element={<h1>签到页已打开</h1>} />
        <Route path="/activities/:activityId/checkout" element={<h1>签退页已打开</h1>} />
      </Routes>
    </MemoryRouter>
  );
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
    expect(screen.getByText(/我的状态：已报名/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去签到" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去签退" })).not.toBeInTheDocument();
  });
});
