import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "./ActivityCard";

describe("ActivityCard", () => {
  it("encodes special characters in activity detail links", () => {
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

    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute(
      "href",
      "/activities/act%2F%20101%3F%23"
    );
  });

  it("uses the staff panel tone when management entries are shown", () => {
    render(
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
    expect(screen.getByRole("link", { name: "进入管理" })).toBeInTheDocument();
  });
});
