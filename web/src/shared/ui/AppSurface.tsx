import { ElementType, ReactNode } from "react";
import type { VisualTone } from "./visual-tone";

export type AppSurfaceVariant = "activity-meta" | "page-content" | "page-hero" | "staff-code";

/**
 * 统一页面壳层只负责输出“项目自有 surface 契约”。
 *
 * 之所以单独抽这一层，是因为当前组件库没有直接承接页面卡面的通用组件，
 * 但我们仍然需要把壳层语义集中起来，避免 `MobilePage`、活动面板和 staff 大卡各自散落一套类名组合。
 */
type AppSurfaceProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  tone?: VisualTone;
  variant: AppSurfaceVariant;
};

export function AppSurface({
  as: Container = "div",
  children,
  className,
  tone = "default",
  variant
}: AppSurfaceProps) {
  // 统一把 tone / variant 落成稳定 data 属性，样式层后续只认这套契约。
  const surfaceClassName = ["app-surface", `app-surface--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Container className={surfaceClassName} data-surface-tone={tone} data-surface-variant={variant}>
      {children}
    </Container>
  );
}
