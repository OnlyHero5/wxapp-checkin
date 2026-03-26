import { Loading } from "tdesign-mobile-react";

/**
 * 页面级加载态统一收口到组件库，而不是继续散落纯文本 `<p>`。
 *
 * 这里刻意只暴露一条文案：
 * 1. 让各页加载态保持同一视觉语言；
 * 2. 避免页面层重复拼接 Loading 参数；
 * 3. 后续如果要统一留白或排版，只改这一处。
 */
type AppLoadingStateProps = {
  message: string;
};

export function AppLoadingState({ message }: AppLoadingStateProps) {
  // 使用垂直布局，保证窄屏下“指示器 + 文案”不会挤成一行。
  return (
    <section className="app-state app-state--loading" aria-live="polite">
      <Loading layout="vertical" loading text={message} />
    </section>
  );
}
