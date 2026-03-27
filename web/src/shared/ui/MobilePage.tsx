import { ReactNode } from "react";
import { Navbar } from "tdesign-mobile-react";
import { AppSurface } from "./AppSurface";
import type { VisualTone } from "./visual-tone";

export type MobilePageLayout = "compact" | "showcase-auto";

/**
 * 所有手机页统一使用的容器。
 *
 * 这个组件的价值主要在于：
 * 1. 标题区布局统一
 * 2. 宽度、留白、背景卡片统一
 * 3. 页面不用各自重复写壳层结构
 * 4. 通过 layout/tone 暴露稳定样式钩子，避免业务页各自拼接 data- 属性
 */
type MobilePageProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  headerActions?: ReactNode;
  layout?: MobilePageLayout;
  tone?: VisualTone;
  title: string;
};

export function MobilePage({
  children,
  description,
  eyebrow,
  headerActions,
  layout = "compact",
  title,
  tone = "default"
}: MobilePageProps) {
  // layout 先只承担页面壳层模式声明，后续桌面端重排继续复用同一契约。
  return (
    <main className="mobile-page" data-page-layout={layout} data-page-tone={tone}>
      <div className="mobile-page__shell">
        <AppSurface as="header" className="mobile-page__hero-surface" tone={tone} variant="page-hero">
          {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
          <section className="mobile-page__hero">
            {/* 标题和右侧动作都交给 Navbar 公共槽位，避免页面头部继续长成自定义壳层。 */}
            <Navbar
              animation={false}
              className="mobile-page__navbar"
              fixed={false}
              right={headerActions}
              safeAreaInsetTop={false}
              title={<h1 className="mobile-page__navbar-title">{title}</h1>}
            />
            {description ? <p className="mobile-page__description">{description}</p> : null}
          </section>
        </AppSurface>
        <AppSurface as="section" className="mobile-page__content-surface" tone="default" variant="page-content">
          <div className="mobile-page__content">{children}</div>
        </AppSurface>
      </div>
    </main>
  );
}
