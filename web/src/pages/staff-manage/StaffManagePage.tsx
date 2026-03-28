import { useParams } from "react-router-dom";
import { buildActivityDetailPath } from "../../features/activities/api";
import { DynamicCodePanel } from "../../features/staff/components/DynamicCodePanel";
import { BulkCheckoutButton } from "../../features/staff/components/BulkCheckoutButton";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { AppTextLink } from "../../shared/ui/AppTextLink";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { useStaffManageState } from "./use-staff-manage-state";

/**
 * staff 管理页负责把“活动元信息 + 当前动态码 + 批量签退动作”收口到一屏内。
 *
 * 这页不重复实现角色判断，默认假设外层路由已经完成 staff 守卫。
 */
export function StaffManagePage() {
  const { activityId = "" } = useParams();

  // 活动切换时直接 remount 内容层，避免旧活动的详情、统计、提示语短暂串到新活动页面。
  return <StaffManagePageContent activityId={activityId} key={activityId} />;
}

type StaffManagePageContentProps = {
  activityId: string;
};

function StaffManagePageContent({ activityId }: StaffManagePageContentProps) {
  const {
    actionType,
    bulkPending,
    codeSession,
    codeSessionLoading,
    detail,
    errorMessage,
    handleBulkCheckout,
    loading,
    refreshCurrentCodeSession,
    riskActionsBlocked,
    resultMessage,
    setActionType,
    wakeLockMessage
  } = useStaffManageState(activityId);

  // staff 管理页先只声明“展示型壳层”，具体桌面重排由后续任务接管。
  return (
    <MobilePage
      eyebrow="工作人员"
      headerActions={(
        <AppTextLink to={buildActivityDetailPath(activityId)}>返回活动详情</AppTextLink>
      )}
      layout="showcase-auto"
      tone="staff"
      title="活动管理"
    >
      {wakeLockMessage ? <InlineNotice message={wakeLockMessage} theme="warning" /> : null}
      {errorMessage ? <InlineNotice message={errorMessage} /> : null}
      {resultMessage ? <InlineNotice message={resultMessage} theme="success" /> : null}
      {detail ? (
        <ActivityMetaPanel
          counts={{
            expected: codeSession?.registered_count ?? detail.registered_count,
            checkin: codeSession?.checkin_count ?? detail.checkin_count,
            checkout: codeSession?.checkout_count ?? detail.checkout_count
          }}
          description={detail.description}
          locationText={detail.location}
          subtitle={detail.activity_type}
          timeText={detail.start_time}
          tone="staff"
          title={detail.activity_title}
        />
      ) : null}
      <DynamicCodePanel
        activityId={activityId}
        actionType={actionType}
        codeSession={codeSession}
        loading={codeSessionLoading}
        // 自愈重检失败后，这里的高风险交互统一冻结，直到下一次完整安全刷新成功。
        onActionChange={riskActionsBlocked ? () => {} : setActionType}
        onRefresh={() => void (riskActionsBlocked ? Promise.resolve() : refreshCurrentCodeSession())}
      />
      <BulkCheckoutButton
        disabled={loading || !detail || riskActionsBlocked}
        loading={bulkPending}
        onConfirm={handleBulkCheckout}
      />
    </MobilePage>
  );
}
