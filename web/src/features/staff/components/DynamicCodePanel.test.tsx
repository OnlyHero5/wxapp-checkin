import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicCodePanel } from "./DynamicCodePanel";

describe("DynamicCodePanel", () => {
  it("exposes stable staff tone hooks for the manage page", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel
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

  it("renders a stable placeholder code and action label before the first code session arrives", () => {
    const onActionChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <DynamicCodePanel actionType="checkout" codeSession={null} onActionChange={onActionChange} onRefresh={onRefresh} />
    );

    expect(screen.getByText("当前签退码")).toBeInTheDocument();
    expect(screen.getByText("------")).toBeInTheDocument();
    expect(screen.getByText("------").closest(".staff-code-panel")).toHaveAttribute("data-display-zone", "hero");
  });
});
