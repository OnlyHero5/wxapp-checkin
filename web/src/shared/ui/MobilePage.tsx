import { ReactNode } from "react";
import { CellGroup, Navbar } from "tdesign-mobile-react";
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
        {/* 玻璃卡面本身改交给 CellGroup 承担，避免继续维护“看起来像组件、实际上是 div”的壳层。 */}
        <CellGroup className="mobile-page__hero-group" theme="card" title={eyebrow}>
          <section className="mobile-page__hero">
            {/* 标题行优先交给组件库 Navbar，减少自定义头部布局对安全区、换行和左右动作位的重复处理。 */}
            <Navbar
              animation={false}
              className="mobile-page__navbar"
              fixed={false}
              right={headerActions}
              safeAreaInsetTop={false}
              title={<h1 className="mobile-page__navbar-title">{title}</h1>}
            />
            {/* description 仍然保留在标题语境里，但不再额外包一层手写卡片。 */}
            {description ? <p className="mobile-page__description">{description}</p> : null}
          </section>
        </CellGroup>
        {/* content 区同样交给 CellGroup 提供 surface，业务页只关心内容本身。 */}
        <CellGroup className="mobile-page__content-group" theme="card">
          <section className="mobile-page__section">
            <div className="mobile-page__content">{children}</div>
          </section>
        </CellGroup>
      </div>
    </main>
  );
}
