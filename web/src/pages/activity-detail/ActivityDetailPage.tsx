import { useNavigate, useParams } from "react-router-dom";
import {
  buildActivityActionPath,
  buildActivityManagePath,
  buildActivityRosterPath
} from "../../features/activities/api";
import {
  resolveCanCheckin,
  resolveCanCheckout,
  resolveJoinStatus,
  resolveProgressStatus
} from "../../features/activities/view-model";
import { ActivityMetaPanel } from "../../shared/ui/ActivityMetaPanel";
import { AppButton } from "../../shared/ui/AppButton";
import { AppEmptyState } from "../../shared/ui/AppEmptyState";
import { AppLoadingState } from "../../shared/ui/AppLoadingState";
import { AppTextLink } from "../../shared/ui/AppTextLink";
import { InlineNotice } from "../../shared/ui/InlineNotice";
import { MobilePage } from "../../shared/ui/MobilePage";
import { StatusTag } from "../../shared/ui/StatusTag";
import { useActivityDetailPageState } from "./use-activity-detail-page-state";

function resolveActionAccentTone(actionType: "checkin" | "checkout") {
  // 详情页按钮只按动作语义映射 accent，避免把 tone 判断散在 JSX 分支里。
  return actionType === "checkout" ? "checkout" : "checkin";
}

export function ActivityDetailPage() {
  const { activityId = "" } = useParams();

  // 路由参数变化时强制 remount，确保上一条活动的 state 不会漏进下一条活动。
  return <ActivityDetailPageContent activityId={activityId} key={activityId} />;
}

type ActivityDetailPageContentProps = {
  activityId: string;
};

function ActivityDetailPageContent({ activityId }: ActivityDetailPageContentProps) {
  const navigate = useNavigate();
  const {
    detail,
    detailTone,
    errorMessage,
    isStaff
  } = useActivityDetailPageState(activityId);

  // 详情未加载完成前，也要保证页面结构稳定，并给用户一个返回入口。
  if (!detail) {
    return (
      <MobilePage
        headerActions={(
          <AppTextLink to="/activities">返回活动列表</AppTextLink>
        )}
        eyebrow="活动详情"
        tone={detailTone}
        title="活动详情"
      >
        {errorMessage ? <InlineNotice message={errorMessage} /> : <AppLoadingState message="活动详情加载中..." />}
      </MobilePage>
    );
  }

  // 两个动作的最终可执行性统一通过 view-model 推导。
  const progressStatus = resolveProgressStatus(detail);
  const canCheckin = resolveCanCheckin(detail);
  const canCheckout = resolveCanCheckout(detail);
  return (
    <MobilePage
      description={isStaff ? "查看活动状态，并进入管理页展示动态码和批量操作。" : "先确认活动状态，再继续签到或签退。"}
      headerActions={(
        <AppTextLink to="/activities">返回活动列表</AppTextLink>
      )}
      eyebrow="活动详情"
      tone={detailTone}
      title={detail.activity_title}
    >
      <ActivityMetaPanel
        checkinTimeText={!isStaff ? detail.my_checkin_time : undefined}
        counts={isStaff ? {
          checkin: detail.checkin_count,
          checkout: detail.checkout_count
        } : undefined}
        checkoutTimeText={!isStaff ? detail.my_checkout_time : undefined}
        description={detail.description}
        joinStatusText={resolveJoinStatus(detail)}
        locationText={detail.location}
        progressText={progressStatus === "completed" ? "已完成" : "进行中"}
        statusSlot={<StatusTag status={progressStatus} />}
        subtitle={detail.activity_type}
        timeText={detail.start_time}
        tone={detailTone}
        title={detail.activity_title}
        titleAs="p"
      />
      <section className="stack-form detail-actions">
        {isStaff ? (
          <>
            {/* staff 先分流到“发码管理”和“名单修正”两个入口，避免在单页里混放两类高频操作。 */}
            <AppButton onClick={() => navigate(buildActivityManagePath(detail.activity_id))}>进入管理</AppButton>
            <AppButton onClick={() => navigate(buildActivityRosterPath(detail.activity_id))} tone="secondary">
              参会名单
            </AppButton>
          </>
        ) : null}
        {/* 签到和签退入口互相独立显示，避免用一个按钮切来切去造成误操作。 */}
        {!isStaff && canCheckin ? (
          <AppButton
            accentTone={resolveActionAccentTone("checkin")}
            onClick={() => navigate(buildActivityActionPath(detail.activity_id, "checkin"))}
          >
            去签到
          </AppButton>
        ) : null}
        {!isStaff && canCheckout ? (
          <AppButton
            accentTone={resolveActionAccentTone("checkout")}
            onClick={() => navigate(buildActivityActionPath(detail.activity_id, "checkout"))}
            tone="secondary"
          >
            去签退
          </AppButton>
        ) : null}
        {/* 两个动作都不可用时，也明确告诉用户是“当前状态不允许”，而不是页面坏了。 */}
        {!isStaff && !canCheckin && !canCheckout ? <AppEmptyState message="当前状态下暂无可执行动作。" /> : null}
      </section>
    </MobilePage>
  );
}
