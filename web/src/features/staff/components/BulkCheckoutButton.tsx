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
  async function handleOpenConfirm() {
    /**
     * 这里直接复用组件库 confirm 插件：
     * 1. 不再自己维护 `visible` 状态；
     * 2. 业务层只保留“确认后执行什么”；
     * 3. 页面不会再挂一层长期存在的受控弹窗外壳。
     */
    await Dialog.confirm?.({
      cancelBtn: "取消",
      confirmBtn: "确认全部签退",
      content: "该操作会把当前活动下所有有效报名成员统一收敛为“已签到且已签退”状态。",
      onConfirm: () => onConfirm(DEFAULT_REASON),
      title: "确认批量签退"
    });
  }

  return (
    <AppButton disabled={disabled} loading={loading} onClick={() => void handleOpenConfirm()} tone="secondary">
      一键全部签退
    </AppButton>
  );
}
