import { Link } from "react-router-dom";
import type { ActivitySummary } from "../api";
import { resolveJoinStatus, resolveProgressStatus } from "../view-model";

/**
 * 活动卡片是列表页最小展示单元。
 *
 * 这里刻意只暴露“查看详情”一个动作，
 * 把“去签到 / 去签退”的真正入口收口到详情页，
 * 这样能减少用户在列表页误点错误动作的概率。
 */
type ActivityCardProps = {
  activity: ActivitySummary;
};

export function ActivityCard({ activity }: ActivityCardProps) {
  // 统一通过 view-model 归一化，避免卡片自己复制一份业务判断。
  const progressStatus = resolveProgressStatus(activity);
  const joinStatus = resolveJoinStatus(activity);

  return (
    <article className="activity-card">
      <div className="activity-card__header">
        <div>
          <h3>{activity.activity_title}</h3>
          {activity.activity_type ? <p className="activity-card__meta">{activity.activity_type}</p> : null}
        </div>
        {/* 进度标签给用户一个“能不能继续操作”的第一眼判断。 */}
        <span className={`status-chip status-chip--${progressStatus}`}>
          {progressStatus === "completed" ? "已完成" : "进行中"}
        </span>
      </div>
      <div className="activity-card__meta-list">
        {activity.start_time ? <p>时间：{activity.start_time}</p> : null}
        {activity.location ? <p>地点：{activity.location}</p> : null}
        <p>我的状态：{joinStatus}</p>
        <p>
          统计：签到 {activity.checkin_count ?? 0} / 签退 {activity.checkout_count ?? 0}
        </p>
      </div>
      {/* 列表页只提供详情入口，动作入口统一在详情页判定。 */}
      <Link className="text-link" to={`/activities/${activity.activity_id}`}>
        查看详情
      </Link>
    </article>
  );
}
