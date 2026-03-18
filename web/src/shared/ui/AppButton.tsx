import { ReactNode } from "react";
import { Button } from "tdesign-mobile-react";

/**
 * 所有主次按钮统一走这一层，而不是让页面各自拼 TDesign 参数。
 *
 * 这样做的收益有两点：
 * 1. 主次动作的视觉层级集中维护
 * 2. 后续如果要统一尺寸、圆角或 loading 口径，只改这一处
 */
type AppButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  tone?: "primary" | "secondary";
  type?: "button" | "reset" | "submit";
};

export function AppButton({
  children,
  disabled = false,
  loading = false,
  onClick,
  tone = "primary",
  type = "button"
}: AppButtonProps) {
  /**
   * 当前项目只暴露两种按钮语义：
   * - `primary`：推进主流程
   * - `secondary`：重试、补充动作、次级跳转
   *
   * 不继续开放第三种/第四种视觉变体，
   * 是为了防止业务页重新长回“每页一套按钮参数”的状态。
   */
  // 这里刻意把“主按钮 / 次按钮”的映射钉死，避免页面自己发明 theme 组合。
  const buttonProps =
    tone === "primary"
      ? {
          theme: "primary" as const,
          variant: "base" as const
        }
      : {
          theme: "default" as const,
          variant: "outline" as const
        };

  return (
    <Button
      block
      className={`app-button app-button--${tone}`}
      disabled={disabled}
      loading={loading}
      // Button 统一使用矩形，是为了和页面卡片、输入框的直角系语言对齐。
      onClick={onClick}
      shape="rectangle"
      // 大号按钮更适合当前“手机单列布局 + 单手点击”的主链路。
      size="large"
      type={type}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
