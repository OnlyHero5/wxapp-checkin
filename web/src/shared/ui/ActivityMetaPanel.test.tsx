import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityMetaPanel } from "./ActivityMetaPanel";

describe("ActivityMetaPanel", () => {
  it("renders one activity card shell instead of three card groups", () => {
    const { container } = render(
      <ActivityMetaPanel
        counts={{ checkin: 12, checkout: 3 }}
        description="负责现场秩序维护"
        joinStatusText="已报名"
        locationText="本部操场"
        subtitle="志愿"
        timeText="2026-03-10 09:00:00"
        title="校园志愿活动"
      />
    );

    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(container.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(container.querySelectorAll(".activity-meta-panel__section")).toHaveLength(3);
    expect(container.querySelectorAll(".activity-meta-panel")).toHaveLength(1);
  });

  it("keeps description and status summary inside the hero section of the single outer card", () => {
    const { container } = render(
      <ActivityMetaPanel
        description="负责现场秩序维护与物资分发，说明文案应继续走组件库原生 description 区域。"
        progressText="进行中"
        subtitle="志愿"
        title="校园志愿活动"
      />
    );

    const heroSection = container.querySelector(".activity-meta-panel__section--hero");
    const descriptionNode = container.querySelector(".activity-meta-panel__description");
    const statusNode = container.querySelector(".activity-meta-panel__status-slot");

    expect(heroSection).not.toBeNull();
    expect(descriptionNode).not.toBeNull();
    expect(descriptionNode?.textContent).toContain("说明文案应继续走组件库原生 description 区域");
    expect(statusNode?.textContent).toContain("进行中");
  });

  it("renders detail rows inside one project-owned detail section so long values stay in the same card", () => {
    const { container } = render(
      <ActivityMetaPanel
        locationText="苏州大学独墅湖校区二期图书馆西侧报告厅外长廊集合点与备用签到处"
        subtitle="志愿"
        timeText="2026-03-10 09:00:00"
        title="校园志愿活动"
      />
    );

    const detailRows = container.querySelectorAll(".activity-meta-panel__detail-row");

    expect(detailRows.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".t-cell-group--card")).toHaveLength(0);
    expect(screen.getByText("苏州大学独墅湖校区二期图书馆西侧报告厅外长廊集合点与备用签到处")).toBeInTheDocument();
  });

  it("renders footer actions through the shared actions section model instead of stitching them outside the builder", () => {
    const { container } = render(
      <ActivityMetaPanel
        footer={<button type="button">查看详情</button>}
        subtitle="志愿"
        title="校园志愿活动"
      />
    );

    expect(container.querySelector(".activity-meta-panel__section--actions")).toBeInTheDocument();
    expect(container.querySelectorAll(".activity-meta-panel__section")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "查看详情" })).toBeInTheDocument();
  });

  it("marks a single footer block as full-width so action pages can stretch one input shell across the main card", () => {
    const { container } = render(
      <ActivityMetaPanel
        footer={(
          // 动作页会把验证码表单包成一个 footer block，
          // 共享面板必须显式暴露“单动作”语义，样式层才能安全铺满。
          <section aria-label="签到码输入区">
            <button type="button">提交签到码</button>
          </section>
        )}
        subtitle="志愿"
        title="校园志愿活动"
      />
    );

    const actionsSection = container.querySelector(".activity-meta-panel__section--actions");

    expect(actionsSection).not.toBeNull();
    expect(actionsSection?.getAttribute("data-actions-layout")).toBe("single");
    expect(actionsSection?.classList.contains("activity-meta-actions--single")).toBe(true);
  });

  it("keeps multiple footer items on the shared two-column layout for detail and list cards", () => {
    const { container } = render(
      <ActivityMetaPanel
        footer={(
          <>
            {/* 多动作场景仍然要维持双列入口，避免把详情/列表页按钮重新堆成单列。 */}
            <button type="button">查看详情</button>
            <button type="button">进入管理</button>
          </>
        )}
        subtitle="志愿"
        title="校园志愿活动"
      />
    );

    const actionsSection = container.querySelector(".activity-meta-panel__section--actions");

    expect(actionsSection).not.toBeNull();
    expect(actionsSection?.getAttribute("data-actions-layout")).toBe("multiple");
    expect(actionsSection?.classList.contains("activity-meta-actions--multiple")).toBe(true);
  });

  it("keeps the activity title visible without creating a second named heading under the page h1", () => {
    render(
      <ActivityMetaPanel
        subtitle="志愿"
        title="校园志愿活动"
      />
    );

    expect(screen.getByText("校园志愿活动")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "校园志愿活动" })).toBeNull();
  });

  it("falls back to progressText when statusSlot is false and omits the actions section when footer is false", () => {
    const { container } = render(
      <ActivityMetaPanel
        footer={false}
        progressText="进行中"
        statusSlot={false}
        title="校园志愿活动"
      />
    );

    expect(container.querySelector(".activity-meta-panel__status-slot")?.textContent).toContain("进行中");
    expect(container.querySelector(".activity-meta-panel__section--actions")).toBeNull();
  });

  it("allows callers to opt into heading semantics for the title without changing the shared default", () => {
    render(
      <ActivityMetaPanel
        subtitle="志愿"
        title="校园志愿活动"
        titleAs="h2"
      />
    );

    expect(screen.getByRole("heading", { level: 2, name: "校园志愿活动" })).toBeInTheDocument();
  });
});
