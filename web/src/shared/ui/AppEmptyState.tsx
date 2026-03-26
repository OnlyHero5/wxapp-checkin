import { ReactElement } from "react";
import { Empty } from "tdesign-mobile-react";

/**
 * 页面级空态与“当前不可操作”提示统一走组件库 Empty。
 *
 * 这层只负责：
 * 1. 统一空态文案容器；
 * 2. 可选承接一个补充动作；
 * 3. 避免各页再手写一段灰色段落冒充状态组件。
 */
type AppEmptyStateProps = {
  action?: ReactElement;
  message: string;
};

export function AppEmptyState({ action, message }: AppEmptyStateProps) {
  // 当前项目先不自定义插画，优先复用组件库默认空态语义。
  return (
    <section className="app-state app-state--empty">
      <Empty action={action} description={message} />
    </section>
  );
}
