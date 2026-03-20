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
    expect(screen.getByRole("button", { name: "立即刷新" })).toHaveClass(
      "app-button",
      "app-button--secondary",
      "app-button--accent-staff"
    );
  });
});
