import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const heroRenderSpy = vi.fn();

vi.mock("./DynamicCodeHero", () => ({
  DynamicCodeHero: (props: {
    countdownTimeMs: number;
    codeText: string;
  }) => {
    heroRenderSpy(props);
    return (
      <div data-testid="dynamic-code-hero-probe">
        {props.codeText}:{props.countdownTimeMs}
      </div>
    );
  }
}));

import { DynamicCodePanel } from "./DynamicCodePanel";

describe("DynamicCodePanel countdown logic", () => {
  afterEach(() => {
    heroRenderSpy.mockClear();
    vi.restoreAllMocks();
  });

  it("shrinks the remaining countdown after time passes instead of resetting to the original duration", () => {
    // 同一轮 code-session 在重新渲染时，倒计时必须继续减少；
    // 这条测试专门防回归“每次重渲染又回到初始剩余秒数”的 bug。
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(4000)
      .mockReturnValueOnce(4000);

    const codeSession = {
      action_type: "checkin" as const,
      activity_id: "act_101",
      checkin_count: 18,
      checkout_count: 3,
      code: "483920",
      expires_at: 5000,
      expires_in_ms: 4000,
      server_time_ms: 1000,
      status: "success" as const
    };

    const view = render(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={codeSession}
        onActionChange={() => undefined}
        onRefresh={() => undefined}
      />
    );

    expect(heroRenderSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      countdownTimeMs: 4000
    }));

    view.rerender(
      <DynamicCodePanel
        activityId="act_101"
        actionType="checkin"
        codeSession={codeSession}
        onActionChange={() => undefined}
        onRefresh={() => undefined}
      />
    );

    expect(heroRenderSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      countdownTimeMs: 1000
    }));
  });
});
