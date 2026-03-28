import { ReactNode } from "react";
import { Navbar } from "tdesign-mobile-react";
import type { VisualTone } from "./visual-tone";

export type MobilePageLayout = "compact" | "showcase-auto";

/**
 * 手机页公共容器现在只保留“页面结构”职责，不再包装项目自有卡面系统。
 *
 * 这层负责：
 * 1. 统一宽度、留白和安全区；
 * 2. 统一复用 Navbar 作为页头；
 * 3. 给页面保留稳定的 layout / tone 钩子；
 * 4. 把视觉细节尽量留给组件库，而不是继续叠一层伪装 surface。
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
  /**
   * `MobilePage` 继续只承担页面壳层职责。
   *
   * 这一轮新增的 `mobile-page__bento-rail` 不是新的视觉组件，
   * 而是给所有业务页一个统一的单列轨道钩子，
   * 让 Task 4 以后接入主卡、次卡和动作带时不必再各写一套外层 grid。
   */
  return (
    <main className="mobile-page" data-page-layout={layout} data-page-tone={tone}>
      {/* `shell` 统一控制最大宽度和纵向节奏，避免业务页自己复制壳层尺寸。 */}
      <div className="mobile-page__shell">
        {/* 页头改成独立 masthead，后续各页只需要传 tone 和文案，不必重复手写首屏容器。 */}
        <header className="mobile-page__masthead">
          {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
          <section className="mobile-page__header">
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
        </header>
        <section className="mobile-page__content">
          {/* 正文统一进入单列便当轨道，后续主卡/次卡/动作带都按同一列向下堆叠。 */}
          <div className="mobile-page__content-stack mobile-page__bento-rail">{children}</div>
        </section>
      </div>
    </main>
  );
}
