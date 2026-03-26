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
          {/* eyebrow / description 仍然属于项目特有语义，继续作为轻量补充信息保留在标题行上下文里。 */}
          {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
          {description ? <p className="mobile-page__description">{description}</p> : null}
        </section>
        {/* content 区交给业务页自由组合表单、说明、结果态。 */}
        <section className="mobile-page__section">
          <div className="mobile-page__content">{children}</div>
        </section>
      </div>
    </main>
  );
}
