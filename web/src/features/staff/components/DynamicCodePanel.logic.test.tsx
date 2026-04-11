import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const heroRenderSpy = vi.fn();

vi.mock("./DynamicCodeHero", () => ({
  DynamicCodeHero: (props: {
    countdownTimeMs: number;
    codeText: string;
    onCountdownFinish: () => void;
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

  it("proactively refreshes an already expired code session twice at most for the same expired key", async () => {
    /**
     * 这个场景对应真实回归：
     * - 管理员手动刷新后，后端返回的 code-session 在前端落地时已经过期；
     * - TDesign CountDown 初始 time=0 只会显示 00，不会自己触发 onFinish；
     * - 因此前端必须主动补刷新；
     * - 但同一轮过期 key 最多只能补两次，避免页面进入无限刷新环。
     */
    vi.spyOn(Date, "now").mockReturnValue(5000);

    const onRefresh = vi.fn();
    const expiredCodeSession = {
      action_type: "checkin" as const,
      activity_id: "act_202",
      checkin_count: 8,
      checkout_count: 1,
      code: "000111",
      expires_at: 5000,
      expires_in_ms: 0,
      server_time_ms: 5000,
      status: "success" as const
    };

    const view = render(
      <DynamicCodePanel
        activityId="act_202"
        actionType="checkin"
        codeSession={expiredCodeSession}
        onActionChange={() => undefined}
        onRefresh={onRefresh}
      />
    );

    expect(heroRenderSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      countdownTimeMs: 0
    }));

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <DynamicCodePanel
        activityId="act_202"
        actionType="checkin"
        codeSession={{ ...expiredCodeSession }}
        onActionChange={() => undefined}
        onRefresh={onRefresh}
      />
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(2);
    });

    view.rerender(
      <DynamicCodePanel
        activityId="act_202"
        actionType="checkin"
        codeSession={{ ...expiredCodeSession }}
        onActionChange={() => undefined}
        onRefresh={onRefresh}
      />
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(2);
    });
  });

  it("retries once more when the first refresh still resolves to the same expired key after countdown finish", async () => {
    /**
     * 这个场景对应线上真正更棘手的边界：
     * - 倒计时归零后，前端已经发起过一次刷新；
     * - 但这次请求回来时，仍然是上一轮已经过期的 code-session；
     * - 面板必须允许再补一次刷新，否则 UI 会卡在 `00` 和旧码上。
     */
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const onRefresh = vi.fn();
    const codeSession = {
      action_type: "checkin" as const,
      activity_id: "act_303",
      checkin_count: 6,
      checkout_count: 1,
      code: "123456",
      expires_at: 5000,
      expires_in_ms: 4000,
      server_time_ms: 1000,
      status: "success" as const
    };

    const view = render(
      <DynamicCodePanel
        activityId="act_303"
        actionType="checkin"
        codeSession={codeSession}
        onActionChange={() => undefined}
        onRefresh={onRefresh}
      />
    );

    const firstHeroProps = heroRenderSpy.mock.calls[heroRenderSpy.mock.calls.length - 1]?.[0] as {
      onCountdownFinish: () => void;
    };

    firstHeroProps.onCountdownFinish();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    now = 5000;
    view.rerender(
      <DynamicCodePanel
        activityId="act_303"
        actionType="checkin"
        codeSession={{ ...codeSession }}
        onActionChange={() => undefined}
        onRefresh={onRefresh}
      />
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(2);
    });
  });
});
