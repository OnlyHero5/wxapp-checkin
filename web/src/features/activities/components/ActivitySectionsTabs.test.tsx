import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivitySectionsTabs } from "./ActivitySectionsTabs";
import type { ActivitySummary } from "../api";

const baseActivity: ActivitySummary = {
  activity_id: "act_101",
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
};

describe("ActivitySectionsTabs", () => {
  it("renders sticky tabs with a component-library list per section", () => {
    const renderActivity = vi.fn((activity: ActivitySummary) => <article>{activity.activity_title}</article>);

    render(
      <ActivitySectionsTabs
        activeSectionKey="ongoing"
        onSectionChange={vi.fn()}
        renderActivity={renderActivity}
        sections={[
          {
            items: [baseActivity],
            key: "ongoing",
            title: "正在进行"
          },
          {
            items: [],
            key: "completed",
            title: "历史活动"
          }
        ]}
      />
    );

    expect(document.querySelector(".t-sticky")).toBeInTheDocument();
    expect(document.querySelector(".t-list")).toBeInTheDocument();
    expect(screen.getByText("正在进行")).toBeInTheDocument();
    expect(screen.getByText("历史活动")).toBeInTheDocument();
    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(renderActivity).toHaveBeenCalledTimes(1);
    expect(screen.getByText("历史活动暂无活动。").closest(".t-empty")).toBeInTheDocument();
  });
});
