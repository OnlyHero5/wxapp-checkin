import { buildActivityDetailPath, buildActivityManagePath, type ActivitySummary } from "../api";
import { resolveActivityDisplayStatus, resolveJoinStatus, resolveProgressStatus } from "../view-model";
import { ActivityMetaPanel } from "../../../shared/ui/ActivityMetaPanel";
import { AppTextLink } from "../../../shared/ui/AppTextLink";
import { StatusTag } from "../../../shared/ui/StatusTag";

/**
 * 活动卡片是列表页最小展示单元。
 *
 * 这里刻意只暴露“查看详情”一个动作，
 * 把“去签到 / 去签退”的真正入口收口到详情页，
 * 这样能减少用户在列表页误点错误动作的概率。
 */
type ActivityCardProps = {
  activity: ActivitySummary;
  showManageEntry?: boolean;
};

export function ActivityCard({ activity, showManageEntry = false }: ActivityCardProps) {
  // 统一通过 view-model 归一化，避免卡片自己复制一份业务判断。
  const progressStatus = resolveProgressStatus(activity);
  const joinStatus = resolveJoinStatus(activity);
  const displayStatus = showManageEntry ? progressStatus : resolveActivityDisplayStatus(activity);
  // 列表卡片只区分“普通用户浏览”与“工作人员管理入口”两种语境，
  // 这样 tone 决策集中在这里，ActivitiesPage 不必散落重复判断。
  const panelTone = showManageEntry ? "staff" : "brand";

  return (
    <ActivityMetaPanel
      as="article"
      // 列表里的每张活动卡都应该暴露稳定的 heading 语义，
      // 这样页面级测试与辅助技术都能明确识别“一活动一主卡”。
      titleAs="h2"
      // 普通用户列表只关心“我现在能不能操作 / 我处于什么状态”，
      // 管理口径的签到统计只在 staff 入口开启时展示。
      counts={showManageEntry ? {
        checkin: activity.checkin_count,
        checkout: activity.checkout_count
      } : undefined}
      footer={(
        <>
          <AppTextLink to={buildActivityDetailPath(activity.activity_id)}>查看详情</AppTextLink>
          {showManageEntry ? (
            <AppTextLink to={buildActivityManagePath(activity.activity_id)}>进入管理</AppTextLink>
          ) : null}
        </>
      )}
      joinStatusText={joinStatus}
      locationText={activity.location}
      statusSlot={<StatusTag status={displayStatus} />}
      subtitle={activity.activity_type}
      timeText={activity.start_time}
      tone={panelTone}
      title={activity.activity_title}
    />
  );
}
