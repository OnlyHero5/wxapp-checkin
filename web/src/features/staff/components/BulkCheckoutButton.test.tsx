import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const dialogMocks = vi.hoisted(() => ({
  confirm: vi.fn()
}));

vi.mock("tdesign-mobile-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("tdesign-mobile-react")>();
  const Dialog = Object.assign(
    () => null,
    {
      confirm: dialogMocks.confirm
    }
  );

  return {
    ...actual,
    Dialog
  };
});

import { BulkCheckoutButton } from "./BulkCheckoutButton";

describe("BulkCheckoutButton", () => {
  beforeEach(() => {
    dialogMocks.confirm.mockReset();
  });

  // 这一条测试锁的是“组件只调插件，不再自己挂一层受控 Dialog”。
  it("opens the component-library confirm plugin instead of mounting a controlled dialog shell", async () => {
    const user = userEvent.setup();

    render(<BulkCheckoutButton onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "一键全部签退" }));

    expect(dialogMocks.confirm).toHaveBeenCalledTimes(1);
    expect(dialogMocks.confirm).toHaveBeenCalledWith(expect.objectContaining({
      content: "该操作会把当前活动下所有有效报名成员统一收敛为“已签到且已签退”状态。"
    }));
  });
});
