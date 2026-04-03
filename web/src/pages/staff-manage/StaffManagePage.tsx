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
    refreshFromUserIntent,
    riskActionsBlocked,
    resultMessage,
    setActionType,
    wakeLockMessage
  } = useStaffManageState(activityId);
  // 阻断态下不能继续把旧动态码当成当前可用码展示，所以这里显式掩掉上一轮会话快照。
  const visibleCodeSession = riskActionsBlocked ? null : codeSession;

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
      <div className="staff-manage-workbench">
        {detail ? (
          <section className="staff-manage-workbench__summary">
            {/* 摘要块复用共享 ActivityMetaPanel，避免 staff 页再造一份活动头部。 */}
            <ActivityMetaPanel
              counts={{
                expected: visibleCodeSession?.registered_count ?? detail.registered_count,
                checkin: visibleCodeSession?.checkin_count ?? detail.checkin_count,
                checkout: visibleCodeSession?.checkout_count ?? detail.checkout_count
              }}
              description={detail.description}
              locationText={detail.location}
              subtitle={detail.activity_type}
              timeText={detail.start_time}
              title={detail.activity_title}
              tone="staff"
            />
          </section>
        ) : null}
        <section className="staff-manage-workbench__hero">
          {/* 动态码和它的统计、刷新条保持在同一工作台里，避免页面层再拆第二套逻辑。 */}
          <div className="staff-manage-workbench__stats">
            <DynamicCodePanel
              activityId={activityId}
              actionType={actionType}
              codeSession={visibleCodeSession}
              loading={codeSessionLoading && !riskActionsBlocked}
              // 自愈重检失败后，这里的高风险交互统一冻结，直到下一次完整安全刷新成功。
              onActionChange={riskActionsBlocked ? () => {} : setActionType}
              onRefresh={() => void refreshFromUserIntent()}
            />
          </div>
        </section>
        <section className="staff-manage-workbench__danger" data-panel-tone="staff">
          <div className="staff-manage-workbench__danger-copy">
            <p className="staff-manage-workbench__danger-eyebrow">危险动作</p>
            <h2 className="staff-manage-workbench__danger-title">活动结束统一签退</h2>
            <p className="staff-manage-workbench__danger-description">
              活动结束后，可在这里统一完成签退。
            </p>
          </div>
          <BulkCheckoutButton
            disabled={loading || !detail || riskActionsBlocked}
            loading={bulkPending}
            onConfirm={handleBulkCheckout}
          />
        </section>
      </div>
    </MobilePage>
  );
}
