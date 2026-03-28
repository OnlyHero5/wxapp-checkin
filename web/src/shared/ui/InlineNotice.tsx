import { NoticeBar } from "tdesign-mobile-react";

/**
 * 页面内联提示统一走 NoticeBar，而不是继续散写红字段落。
 *
 * 当前只收口最常见的两类：
 * - 错误提示
 * - 一般说明提示
 */
type InlineNoticeProps = {
  message: string;
  theme?: "error" | "info" | "success" | "warning";
};

export function InlineNotice({ message, theme = "error" }: InlineNoticeProps) {
  /**
   * 这里明确选择“页内 NoticeBar”而不是 Toast：
   * 1. 表单错误需要停留，不能一闪而过
   * 2. 当前页面大多是单列窄布局，顶部横条比浮层更稳定
   * 3. 测试也更容易稳定定位，不依赖全局浮层根节点
   */
  return (
    <NoticeBar
      className="inline-notice"
      content={message}
      data-notice-theme={theme}
      // 禁用 marquee，保证错误文案稳定停留在原位，不做跑马灯。
      marquee={false}
      theme={theme}
      // TDesign 的 NoticeBar 默认不展示，这里强制 visible 统一语义。
      visible
    />
  );
}
