import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DynamicCodeHero } from "./DynamicCodeHero";

describe("DynamicCodeHero", () => {
  it("renders the action header, code display, and countdown without the legacy badge ribbon wrapper", async () => {
    render(
      <DynamicCodeHero
        actionLabel="当前签到码"
        actionType="checkin"
        countdownTimeMs={4000}
        codeText="483920"
        onCountdownFinish={() => undefined}
        showSkeleton={false}
      />
    );

    expect(document.querySelector(".app-surface")).toBeNull();
    expect(document.querySelector(".staff-code-panel__card")).toBeInTheDocument();
    expect(document.querySelector(".staff-code-hero__header")).toBeInTheDocument();
    expect(screen.getByText("当前签到码").closest(".t-badge")).toBeNull();
    expect(screen.getByText("483920")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector(".staff-code-panel__meta .t-count-down")).toBeInTheDocument();
    });
  });
});
