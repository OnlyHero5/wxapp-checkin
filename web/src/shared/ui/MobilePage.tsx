import { ReactNode } from "react";

/**
 * 所有手机页统一使用的容器。
 *
 * 这个组件的价值主要在于：
 * 1. 标题区布局统一
 * 2. 宽度、留白、背景卡片统一
 * 3. 页面不用各自重复写壳层结构
 */
type MobilePageProps = {
  bottomNav?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  headerActions?: ReactNode;
  title: string;
};

export function MobilePage({ bottomNav, children, description, eyebrow, headerActions, title }: MobilePageProps) {
  return (
    <main className="mobile-page">
      <div className="mobile-page__shell">
        <section className="mobile-page__hero">
          <div className="mobile-page__hero-main">
            {/* eyebrow 用于表达“欢迎回来 / 首次访问 / 活动详情”这类辅助上下文。 */}
            {eyebrow ? <p className="mobile-page__eyebrow">{eyebrow}</p> : null}
            <header className="mobile-page__header">
              <h1>{title}</h1>
            </header>
            {description ? <p className="mobile-page__description">{description}</p> : null}
          </div>
          {headerActions ? <div className="mobile-page__hero-actions">{headerActions}</div> : null}
        </section>
        {/* content 区交给业务页自由组合表单、说明、结果态。 */}
        <section className="mobile-page__section">
          <div className="mobile-page__content">{children}</div>
        </section>
        {/* 底部导航独立于正文区块，保证滚到底部时仍有稳定返回入口。 */}
        {bottomNav ? <div className="mobile-page__bottom-nav">{bottomNav}</div> : null}
      </div>
    </main>
  );
}
