import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceActionDetailSection } from "./AttendanceActionDetailSection";

const detail = {
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
  my_checked_in: false,
  my_checked_out: false,
  checkin_count: 18,
  checkout_count: 3
};

describe("AttendanceActionDetailSection", () => {
  it("renders activity detail rows plus the code input when the action is allowed", () => {
    render(
      <AttendanceActionDetailSection
        actionType="checkin"
        code="123456"
        detail={detail}
        errorMessage=""
        onCodeChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={false}
      />
    );

    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByText("负责现场秩序维护")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交签到码" })).toBeInTheDocument();
  });

  it("falls back to the shared empty state when the action is unavailable", () => {
    render(
      <AttendanceActionDetailSection
        actionType="checkout"
        code=""
        detail={{
          ...detail,
          can_checkout: false
        }}
        errorMessage=""
        onCodeChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={false}
      />
    );

    expect(screen.getByText("当前状态下暂不可执行该动作，请先返回详情页确认活动状态。").closest(".t-empty")).toBeInTheDocument();
  });
});
