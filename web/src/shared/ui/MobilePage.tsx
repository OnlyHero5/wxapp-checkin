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
  // 页面级 tone 继续保留在根节点，方便业务页和测试稳定识别上下文语义。
  return (
    <main className="mobile-page" data-page-layout={layout} data-page-tone={tone}>
      <div className="mobile-page__shell">
        <header className="mobile-page__header">
          {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
          <Navbar
            animation={false}
            className="mobile-page__navbar"
            fixed={false}
            right={headerActions}
            safeAreaInsetTop={false}
            title={<h1 className="mobile-page__navbar-title">{title}</h1>}
          />
          {description ? <p className="mobile-page__description">{description}</p> : null}
        </header>
        <section className="mobile-page__content">{children}</section>
      </div>
    </main>
  );
}
