import { Link } from "react-router-dom";

/**
 * 页面局部导航统一收口到这个组件，避免每一页各自拼一组“页内锚点 / 分段切换”。
 *
 * 维护约束：
 * 1. 这里只负责渲染局部导航结构和激活态，不负责承接业务态顶级导航；
 * 2. 页内锚点和轻量分段切换允许复用同一套样式，避免出现两套“局部 tab”；
 * 3. 返回链路优先走页面标题区或正文里的文本入口，不再伪装成底部 tab。
 */
export type PageBottomNavItem = {
  active?: boolean;
  href?: string;
  label: string;
  to?: string;
};

type PageBottomNavProps = {
  items: PageBottomNavItem[];
};

export function PageBottomNav({ items }: PageBottomNavProps) {
  return (
    <nav
      aria-label="页面导航"
      className="page-bottom-nav"
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const className = item.active
          ? "page-bottom-nav__item page-bottom-nav__item--active"
          : "page-bottom-nav__item";

        // 页内分组跳转继续用原生锚点，避免为了 hash 导航额外引入状态同步逻辑。
        if (item.href) {
          return (
            <a className={className} href={item.href} key={`${item.label}:${item.href}`}>
              {item.label}
            </a>
          );
        }

        // 其余跳转统一走 react-router，保证应用内导航不刷新整页。
        return (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={className}
            key={`${item.label}:${item.to ?? ""}`}
            to={item.to ?? "."}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
