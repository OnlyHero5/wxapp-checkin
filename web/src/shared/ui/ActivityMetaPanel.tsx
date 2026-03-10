import { ElementType, ReactNode } from "react";

/**
 * 活动信息块在列表、详情、输入页重复度最高，因此单独抽成公共面板。
 *
 * 这层只负责：
 * 1. 统一标题、副标题和状态位布局
 * 2. 统一时间 / 地点 / 我的状态 / 统计这些字段的渲染顺序
 * 3. 让页面层只关心“传什么信息”，而不是再手写一组 `<p>`
 */
type ActivityMetaPanelProps = {
  as?: ElementType;
  counts?: {
    checkin?: number;
    checkout?: number;
  };
  description?: string;
  footer?: ReactNode;
  joinStatusText?: string;
  locationText?: string;
  progressText?: string;
  statusSlot?: ReactNode;
  subtitle?: string;
  timeText?: string;
  title: string;
  titleAs?: "h3" | "p";
};

function renderRows({
  counts,
  description,
  joinStatusText,
  locationText,
  progressText,
  timeText
}: Omit<ActivityMetaPanelProps, "as" | "footer" | "statusSlot" | "subtitle" | "title">) {
  /**
   * 这些字段统一在这里按固定顺序输出，而不是在页面里自由穿插。
   *
   * 原因是：
   * - 同一类信息如果顺序不一致，用户会觉得页面像不同产品拼出来的
   * - 后续补字段时，只需要改这一层，不需要同时扫 3 个页面
   */
  // 字段顺序固定下来以后，列表、详情和输入页就不会各自漂移。
  return (
    <>
      {description ? <p>{description}</p> : null}
      {timeText ? <p>时间：{timeText}</p> : null}
      {locationText ? <p>地点：{locationText}</p> : null}
      {progressText ? <p>当前状态：{progressText}</p> : null}
      {joinStatusText ? <p>我的状态：{joinStatusText}</p> : null}
      {counts ? <p>统计：签到 {counts.checkin ?? 0} / 签退 {counts.checkout ?? 0}</p> : null}
    </>
  );
}

export function ActivityMetaPanel({
  as: Container = "section",
  counts,
  description,
  footer,
  joinStatusText,
  locationText,
  progressText,
  statusSlot,
  subtitle,
  timeText,
  title,
  titleAs = "h3"
}: ActivityMetaPanelProps) {
  /**
   * `titleAs` 用来控制语义层级，而不是视觉层级。
   *
   * 例如详情页已经有页面级 `h1`，这里就降成 `p`，
   * 避免出现“双主标题”的可访问性噪音。
   */
  const TitleTag = titleAs;

  return (
    <Container className="activity-meta-panel">
      <div className="activity-meta-panel__header">
        <div className="activity-meta-panel__title-block">
          <TitleTag className="activity-meta-panel__title">{title}</TitleTag>
          {subtitle ? <p className="activity-meta-panel__subtitle">{subtitle}</p> : null}
        </div>
        {/* 状态位独立成 slot，是为了兼容列表卡片、详情页和未来管理员态的不同标签策略。 */}
        {statusSlot ? <div className="activity-meta-panel__status">{statusSlot}</div> : null}
      </div>
      <div className="activity-meta-panel__rows">
        {renderRows({
          counts,
          description,
          joinStatusText,
          locationText,
          progressText,
          timeText
        })}
      </div>
      {/* footer 常用于“查看详情”这类补充动作，避免动作和元信息混在同一组文本里。 */}
      {footer ? <div className="activity-meta-panel__footer">{footer}</div> : null}
    </Container>
  );
}
