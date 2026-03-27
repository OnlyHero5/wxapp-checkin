import { ReactNode } from "react";
import { Button } from "tdesign-mobile-react";

/**
 * 所有主次按钮仍然统一走这一层，但现在只保留“业务语义 -> 组件库参数”的薄映射。
 *
 * 这里刻意不再输出项目自有 class：
 * 1. 按钮形态、尺寸、禁用与 loading 交给 TDesign；
 * 2. 页面不再维护第二套按钮视觉体系；
 * 3. 这一层只负责防止业务页反复手写同一组 theme / variant 组合。
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
   * 当前项目只保留两种稳定语义：
   * - `primary`：推进当前主链路
   * - `secondary`：返回、重试、补充动作
   *
   * 颜色、边框和按钮内部结构全部交回组件库，
   * 避免业务代码继续通过自定义 class 拼出“伪组件库按钮”。
   */
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
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      size="large"
      type={type}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
