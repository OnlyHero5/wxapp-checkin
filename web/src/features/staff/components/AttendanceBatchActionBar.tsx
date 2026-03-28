import { ActionSheet, Dialog } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";

export type AttendanceActionKey =
  | "set_checked_in"
  | "clear_checked_in"
  | "set_checked_out"
  | "clear_checked_out";

type AttendanceBatchActionBarProps = {
  disabled?: boolean;
  onConfirm: (action: AttendanceActionKey) => Promise<void> | void;
  selectedCount: number;
};

type ActionConfig = {
  content: string;
  label: string;
  value: AttendanceActionKey;
};

const ACTIONS: ActionConfig[] = [
  {
    content: "该操作会把已选成员统一标记为已签到，且保留未签退状态。",
    label: "批量设为已签到",
    value: "set_checked_in"
  },
  {
    content: "设为未签到会同时清空签退，避免出现“未签到但已签退”的非法组合。",
    label: "批量设为未签到",
    value: "clear_checked_in"
  },
  {
    content: "设为已签退会自动补成已签到。",
    label: "批量设为已签退",
    value: "set_checked_out"
  },
  {
    content: "该操作会把已选成员统一恢复为“已签到未签退”。",
    label: "批量设为未签退",
    value: "clear_checked_out"
  }
];

/**
 * 批量操作条把“动作按钮”和“确认层”收口到一起，
 * 避免页面层自己重复维护四类动作的确认文案。
 */
export function AttendanceBatchActionBar({
  disabled = false,
  onConfirm,
  selectedCount
}: AttendanceBatchActionBarProps) {
  function handleActionSelect(index: number) {
    const nextAction = ACTIONS[index];
    if (!nextAction) {
      return;
    }

    /**
     * 选中动作后直接进入组件库 confirm 插件，避免 action sheet / dialog
     * 两层都由业务组件自己保一份可见状态。
     */
    Dialog.confirm?.({
      cancelBtn: "取消",
      confirmBtn: "确认批量修正",
      content: nextAction.content,
      onConfirm: () => onConfirm(nextAction.value),
      title: nextAction.label
    });
  }

  function handleOpenActionSheet() {
    /**
     * 动作选择层改走 `ActionSheet.show`：
     * 1. 交互仍由 TDesign 负责；
     * 2. 组件只维护动作配置；
     * 3. 不再因为单次使用而额外挂载受控弹层节点。
     *
     * `取消` 这里必须显式回调 `ActionSheet.close`：
     * - 运行态已经证明仅传 `cancelText` 时，底部按钮会显示但不会自动收层；
     * - staff 连续修名单时，卡住一次就会直接打断整条业务链路。
     */
    ActionSheet.show?.({
      cancelText: "取消",
      description: "请选择要批量修正的签到状态。",
      items: ACTIONS.map((action) => ({
        description: action.content,
        label: action.label
      })),
      onCancel: () => {
        ActionSheet.close?.();
      },
      onSelected: (_, index) => handleActionSelect(index)
    });
  }

  return (
    <section className="attendance-batch-action-bar attendance-batch-action-bar--bento stack-form" data-panel-tone="staff">
      <div className="attendance-batch-action-bar__summary">
        {/* 批量条的左侧只承担“现在选了多少、这条工具带在做什么”两件事。 */}
        <p className="attendance-batch-action-bar__eyebrow">批量修正</p>
        <div className="attendance-batch-action-bar__summary-row">
          <div className="attendance-batch-action-bar__summary-copy">
            <p className="attendance-batch-action-bar__summary-label">已选成员</p>
            <p className="attendance-batch-action-bar__summary-hint">先勾选成员，再统一修正签到或签退状态。</p>
          </div>
          <p className="attendance-batch-action-bar__summary-value">{selectedCount} 人</p>
        </div>
      </div>
      <div className="attendance-batch-action-bar__action">
        <p className="attendance-batch-action-bar__action-hint">动作选择与确认层仍统一走组件库插件，页面只负责给出上下文。</p>
        <AppButton
          disabled={disabled || selectedCount === 0}
          onClick={handleOpenActionSheet}
          tone="secondary"
        >
          批量操作
        </AppButton>
      </div>
    </section>
  );
}
