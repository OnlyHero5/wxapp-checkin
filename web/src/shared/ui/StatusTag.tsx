import { Tag } from "tdesign-mobile-react";

/**
 * 活动状态标签统一走 TDesign Tag。
 *
 * 这样可以把“进行中 / 已完成”的视觉层级从手写胶囊样式
 * 收口成一个可替换、可复用的组件原语。
 */
type StatusTagProps = {
  status: "completed" | "ongoing";
};

export function StatusTag({ status }: StatusTagProps) {
  /**
   * 当前阶段只有“进行中 / 已完成”两种用户真正关心的状态。
   *
   * 未来如果产品引入“待开始 / 已取消”等额外口径，
   * 也应该先在 view-model 里归一，再扩这里的视觉映射，
   * 不要让页面自己传任意中文标签进来。
   */
  const isOngoing = status === "ongoing";

  return (
    <Tag
      className={`status-tag status-tag--${status}`}
      shape="round"
      theme={isOngoing ? "primary" : "default"}
      variant={isOngoing ? "light" : "light-outline"}
    >
      {isOngoing ? "进行中" : "已完成"}
    </Tag>
  );
}
