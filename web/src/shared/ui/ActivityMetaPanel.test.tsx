import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityMetaPanel } from "./ActivityMetaPanel";

describe("ActivityMetaPanel", () => {
  it("renders detail rows through direct TDesign groups without a project-specific panel shell", () => {
    const { container } = render(
      <ActivityMetaPanel
        description="负责现场秩序维护"
        joinStatusText="已报名"
        locationText="本部操场"
        subtitle="志愿"
        timeText="2026-03-10 09:00:00"
        title="校园志愿活动"
      />
    );

    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(container.querySelector(".app-surface")).toBeNull();
    expect(container.querySelector(".activity-meta-panel")).toBeNull();
    expect(container.querySelectorAll(".t-cell").length).toBeGreaterThan(0);
  });

  it("allows long detail values to shrink and wrap inside narrow groups", () => {
    const { container } = render(
      <ActivityMetaPanel
        locationText="苏州大学独墅湖校区二期图书馆西侧报告厅外长廊集合点与备用签到处"
        subtitle="志愿"
        timeText="2026-03-10 09:00:00"
        title="校园志愿活动"
      />
    );

    const detailValue = container.querySelector(".t-cell__note");

    expect(detailValue).not.toBeNull();
    expect(screen.getByText("苏州大学独墅湖校区二期图书馆西侧报告厅外长廊集合点与备用签到处")).toBeInTheDocument();
  });
});
