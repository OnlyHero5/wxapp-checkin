import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("tdesign-mobile-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("tdesign-mobile-react")>();

  return {
    ...actual,
    CountDown: ({ onFinish }: { onFinish?: () => void }) => (
      <button className="t-count-down" onClick={onFinish} type="button">
        触发倒计时结束
      </button>
    )
  };
});

import { DynamicCodePanel } from "./DynamicCodePanel";

describe("DynamicCodePanel countdown integration", () => {
  // 这里故意把 CountDown mock 成“可手动点一下就 finish”的最小壳，
  // 目的不是测试 TDesign 自己，而是锁住父组件有没有真正接 `onFinish`。
  it("refreshes through the component-library count-down finish callback", async () => {
    const user = userEvent.setup();
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
        onActionChange={vi.fn()}
        onRefresh={onRefresh}
      />
    );

    await user.click(screen.getByRole("button", { name: "触发倒计时结束" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
