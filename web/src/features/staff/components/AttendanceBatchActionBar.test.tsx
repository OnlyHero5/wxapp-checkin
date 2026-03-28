import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const overlayMocks = vi.hoisted(() => ({
  actionSheetClose: vi.fn(),
  actionSheetShow: vi.fn(),
  dialogConfirm: vi.fn()
}));

vi.mock("tdesign-mobile-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("tdesign-mobile-react")>();
  const Dialog = Object.assign(
    () => null,
    {
      confirm: overlayMocks.dialogConfirm
    }
  );
  const ActionSheet = Object.assign(
    () => null,
    {
      close: overlayMocks.actionSheetClose,
      show: overlayMocks.actionSheetShow,
    }
  );

  return {
    ...actual,
    ActionSheet,
    Dialog
  };
});

import { AttendanceBatchActionBar } from "./AttendanceBatchActionBar";

describe("AttendanceBatchActionBar", () => {
  beforeEach(() => {
    overlayMocks.actionSheetClose.mockReset();
    overlayMocks.actionSheetShow.mockReset();
    overlayMocks.dialogConfirm.mockReset();
  });

  // 先锁动作选择层已经改走 `ActionSheet.show`，
  // 避免后续有人再把 visible state 和组件壳写回来。
  it("uses the component-library action-sheet plugin for action picking", async () => {
    const user = userEvent.setup();

    render(<AttendanceBatchActionBar onConfirm={vi.fn()} selectedCount={3} />);

    expect(document.querySelector(".attendance-batch-action-bar")).toHaveClass("attendance-batch-action-bar--bento");
    expect(document.querySelector(".attendance-batch-action-bar__summary")).toBeInTheDocument();
    expect(document.querySelector(".attendance-batch-action-bar__summary")).toHaveTextContent("已选成员");
    expect(document.querySelector(".attendance-batch-action-bar__summary")).toHaveTextContent("3 人");
    expect(document.querySelector(".attendance-batch-action-bar__action")).toBeInTheDocument();
    expect(document.querySelectorAll(".t-cell-group--card")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "批量操作" }));

    expect(overlayMocks.actionSheetShow).toHaveBeenCalledTimes(1);
  });

  // 再锁“选中动作后直接进 confirm 插件”，
  // 防止 action sheet 之后又回退成第二层受控 Dialog。
  it("opens the component-library confirm plugin after an action is selected", async () => {
    const user = userEvent.setup();

    render(<AttendanceBatchActionBar onConfirm={vi.fn()} selectedCount={3} />);

    await user.click(screen.getByRole("button", { name: "批量操作" }));
    const [config] = overlayMocks.actionSheetShow.mock.calls[0] ?? [];
    expect(config).toBeDefined();

    config.onSelected?.({ label: "批量设为已签退" }, 2);

    expect(overlayMocks.dialogConfirm).toHaveBeenCalledTimes(1);
  });

  // `取消` 必须真的把动作层收掉，否则 staff 在批量修正里会被卡住。
  it("closes the component-library action-sheet plugin when the cancel action is triggered", async () => {
    const user = userEvent.setup();

    render(<AttendanceBatchActionBar onConfirm={vi.fn()} selectedCount={3} />);

    await user.click(screen.getByRole("button", { name: "批量操作" }));
    const [config] = overlayMocks.actionSheetShow.mock.calls[0] ?? [];
    expect(config).toBeDefined();

    config.onCancel?.();

    expect(overlayMocks.actionSheetClose).toHaveBeenCalledTimes(1);
  });
});
