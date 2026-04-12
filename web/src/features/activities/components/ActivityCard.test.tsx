import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "./ActivityCard";

describe("ActivityCard", () => {
  it("encodes special characters in activity detail links and exposes the card title as a heading", () => {
    render(
      <MemoryRouter>
        <ActivityCard
          activity={{
            activity_id: "act/ 101?#",
            activity_title: "校园志愿活动",
            activity_type: "志愿",
            checkin_count: 12,
            checkout_count: 5,
            location: "本部操场",
            my_registered: true,
            progress_status: "ongoing",
            start_time: "2026-03-10 09:00:00"
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 2, name: "校园志愿活动" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute(
      "href",
      "/activities/act%2F%20101%3F%23"
    );
  });

  it("uses the staff panel tone when management entries are shown", () => {
    const { container } = render(
      <MemoryRouter>
        <ActivityCard
          activity={{
            activity_id: "act_manage",
            activity_title: "工作人员活动",
            activity_type: "志愿",
            checkin_count: 12,
            checkout_count: 5,
            location: "本部操场",
            my_registered: false,
            progress_status: "ongoing",
            start_time: "2026-03-10 09:00:00"
          }}
          showManageEntry
        />
      </MemoryRouter>
    );

    expect(screen.getByText("工作人员活动").closest("article")).toHaveAttribute("data-panel-tone", "staff");
    expect(screen.getByRole("heading", { level: 2, name: "工作人员活动" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入管理" })).toBeInTheDocument();
    expect(container.querySelectorAll("article.activity-meta-panel")).toHaveLength(1);
    expect(container.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
  });

  it("shows explicit incomplete labels for completed activities that missed attendance steps", () => {
    render(
      <MemoryRouter>
        <ActivityCard
          activity={{
            activity_id: "act_missed_checkout",
            activity_title: "结项答辩",
            activity_type: "答辩",
            checkin_count: 12,
            checkout_count: 5,
            location: "独墅湖校区",
            my_registered: true,
            my_checked_in: true,
            my_checked_out: false,
            progress_status: "completed",
            start_time: "2026-03-10 09:00:00"
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText("未签退").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("已完成")).toHaveLength(0);
  });
});
