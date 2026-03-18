import { useState } from "react";
import { Dialog } from "tdesign-mobile-react";
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
  confirmText?: string;
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
  const [dialogVisible, setDialogVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<AttendanceActionKey | null>(null);
  const activeAction = ACTIONS.find((action) => action.value === pendingAction) ?? null;

  async function handleConfirm() {
    if (!pendingAction) {
      return;
    }
    await onConfirm(pendingAction);
    setDialogVisible(false);
    setPendingAction(null);
  }

  return (
    <section className="roster-batch-bar">
      <p className="roster-batch-bar__summary">已选 {selectedCount} 人</p>
      <div className="roster-batch-bar__actions">
        {ACTIONS.map((action) => (
          <AppButton
            disabled={disabled || selectedCount === 0}
            key={action.value}
            onClick={() => {
              setPendingAction(action.value);
              setDialogVisible(true);
            }}
            tone={action.value === "clear_checked_in" ? "secondary" : "primary"}
          >
            {action.label}
          </AppButton>
        ))}
      </div>
      <Dialog
        cancelBtn="取消"
        confirmBtn="确认批量修正"
        content={activeAction?.content ?? ""}
        onCancel={() => {
          setDialogVisible(false);
          setPendingAction(null);
        }}
        onClose={() => {
          setDialogVisible(false);
          setPendingAction(null);
        }}
        onConfirm={() => void handleConfirm()}
        title={activeAction?.label ?? "确认批量修正"}
        visible={dialogVisible}
      />
    </section>
  );
}
