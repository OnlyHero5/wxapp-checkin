import { useState } from "react";
import { Dialog } from "tdesign-mobile-react";
import { AppButton } from "../../../shared/ui/AppButton";

type BulkCheckoutButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
};

const DEFAULT_REASON = "活动结束统一签退";

/**
 * 一键全部签退是高风险动作，必须在组件内部自带确认层，
 * 而不是把“先确认”这件事丢给每个页面自己重复实现。
 */
export function BulkCheckoutButton({
  disabled = false,
  loading = false,
  onConfirm
}: BulkCheckoutButtonProps) {
  const [dialogVisible, setDialogVisible] = useState(false);

  async function handleConfirm() {
    await onConfirm(DEFAULT_REASON);
    setDialogVisible(false);
  }

  return (
    <>
      <AppButton disabled={disabled} loading={loading} onClick={() => setDialogVisible(true)} tone="secondary">
        一键全部签退
      </AppButton>
      <Dialog
        cancelBtn="取消"
        confirmBtn="确认全部签退"
        content="该操作会把当前活动下所有“已签到未签退”成员统一签退。"
        onCancel={() => setDialogVisible(false)}
        onClose={() => setDialogVisible(false)}
        onConfirm={() => void handleConfirm()}
        title="确认批量签退"
        visible={dialogVisible}
      />
    </>
  );
}
