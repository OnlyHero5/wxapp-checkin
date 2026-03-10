import { Link } from "react-router-dom";
import { buildActivityDetailPath, buildActivityManagePath, type ActivitySummary } from "../api";
import { resolveJoinStatus, resolveProgressStatus } from "../view-model";
import { ActivityMetaPanel } from "../../../shared/ui/ActivityMetaPanel";
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

  return (
    <ActivityMetaPanel
      as="article"
      counts={{
        checkin: activity.checkin_count,
        checkout: activity.checkout_count
      }}
      footer={(
        <>
          <Link className="text-link" to={buildActivityDetailPath(activity.activity_id)}>
            查看详情
          </Link>
          {showManageEntry ? (
            <Link className="text-link" to={buildActivityManagePath(activity.activity_id)}>
              进入管理
            </Link>
          ) : null}
        </>
      )}
      joinStatusText={joinStatus}
      locationText={activity.location}
      statusSlot={<StatusTag status={progressStatus} />}
      subtitle={activity.activity_type}
      timeText={activity.start_time}
      title={activity.activity_title}
    />
  );
}
