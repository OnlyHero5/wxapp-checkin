import { ReactNode } from "react";
import { Navbar } from "tdesign-mobile-react";
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
        <header className="mobile-page__hero-surface">
          {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
          <section className="mobile-page__hero">
            {/* 标题仍交给 Navbar 承担语义与交互基线，但页面动作位回到我们自己的稳定 slot，
             * 避免后续样式继续绑死在 `.t-navbar__right` 这类内部 DOM 上。 */}
            <Navbar
              animation={false}
              className="mobile-page__navbar"
              fixed={false}
              safeAreaInsetTop={false}
              title={<h1 className="mobile-page__navbar-title">{title}</h1>}
            />
            {headerActions ? <div className="mobile-page__actions">{headerActions}</div> : null}
            {description ? <p className="mobile-page__description">{description}</p> : null}
          </section>
        </header>
        <section className="mobile-page__content-surface">
          <div className="mobile-page__content">{children}</div>
        </section>
      </div>
    </main>
  );
}
