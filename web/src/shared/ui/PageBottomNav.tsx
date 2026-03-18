import { Link } from "react-router-dom";

/**
 * 页面底部导航统一收口到这个组件，避免每一页各自拼一组“返回 / 切换”链接。
 *
 * 维护约束：
 * 1. 这里只负责渲染导航结构和激活态，不负责决定业务页该给哪些入口；
 * 2. 页内锚点和路由跳转都允许复用同一套样式，避免出现两套“底部栏”；
 * 3. 文案保持简短，优先服务“回列表 / 看详情 / 跳历史分组”这类高频动作。
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
