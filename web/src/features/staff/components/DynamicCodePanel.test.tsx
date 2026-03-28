import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicCodePanel } from "./DynamicCodePanel";

describe("DynamicCodePanel", () => {
  it("exposes stable staff tone hooks for the manage page", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("483920").closest(".staff-panel")).toHaveAttribute("data-panel-tone", "staff");
    expect(screen.getByText("483920").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
    expect(screen.getByText("实时统计").closest(".staff-panel__stats")).toHaveAttribute("data-display-zone", "stats");
    expect(screen.getByRole("button", { name: "立即刷新" }).closest(".staff-panel__actions")).toHaveAttribute(
      "data-display-zone",
      "actions"
    );
    expect(screen.getByText("签到码").closest(".staff-panel__controls")).toHaveAttribute("data-display-zone", "controls");
  });

  it("renders the hero through project-owned header structure and component-library count-down", async () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(document.querySelector(".staff-code-hero__header")).toBeInTheDocument();
    expect(document.querySelector(".staff-code-panel__card")).toBeInTheDocument();
    expect(screen.getByText("483920")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector(".staff-code-panel__meta .t-count-down")).toBeInTheDocument();
    });
  });

  it("uses a component-library skeleton in the hero while the latest code is still loading", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        loading
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(document.querySelector(".staff-code-panel__value-skeleton")).toBeInTheDocument();
  });

  it("renders a stable placeholder code and action label before the first code session arrives", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkout"
        codeSession={null}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("当前签退码")).toBeInTheDocument();
    expect(screen.getByText("------")).toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
  });

  it("keeps the hero placeholder when the incoming code session still belongs to the previous action", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkout"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("当前签退码")).toBeInTheDocument();
    expect(screen.getByText("------")).toBeInTheDocument();
    expect(screen.queryByText("483920")).not.toBeInTheDocument();
  });

  it("keeps the hero placeholder when the incoming code session still belongs to the previous activity", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_202"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText("当前签到码")).toBeInTheDocument();
    expect(screen.getByText("------")).toBeInTheDocument();
    expect(screen.queryByText("483920")).not.toBeInTheDocument();
  });

  it("keeps the mobile reading order as controls, hero, stats, then actions", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    const panel = screen.getByText("签到码").closest(".staff-panel");
    expect(panel).not.toBeNull();
    expect(
      Array.from(panel?.querySelectorAll("[data-display-zone]") ?? []).map((child) => child.getAttribute("data-display-zone"))
    ).toEqual(["controls", "hero", "stats", "actions"]);
  });

  it("renders the panel through TDesign row and col layout primitives instead of a project-owned desktop grid shell", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    const { container } = render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(container.querySelector(".t-row")).not.toBeNull();
    expect(container.querySelectorAll(".t-col").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".staff-panel__layout")).not.toBeNull();
  });

  // staff 页首先服务手机值班场景，所以默认栅格必须先保证单列阅读顺序。
  it("uses full-width columns as the mobile-first baseline before desktop breakpoints intervene", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    const { container } = render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={{
          action_type: "checkin",
          activity_id: "act_101",
          checkin_count: 18,
          checkout_count: 3,
          code: "483920",
          expires_at: Date.now() + 4000,
          expires_in_ms: 4000,
          server_time_ms: Date.now(),
          status: "success"
        }}
        onActionChange={onActionChange}
        onRefresh={onRefresh}
      />
    );

    expect(container.querySelectorAll(".t-col--24").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".t-col--12")).toBeNull();
  });
});
