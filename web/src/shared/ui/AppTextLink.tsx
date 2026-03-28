import { MouseEvent, ReactNode } from "react";
import { Link } from "tdesign-mobile-react";
import { useNavigate } from "react-router-dom";

type AppTextLinkProps = {
  children: ReactNode;
  to: string;
  target?: string;
};

export function shouldKeepBrowserNavigation(event: Pick<MouseEvent<HTMLAnchorElement>, "altKey" | "button" | "ctrlKey" | "currentTarget" | "metaKey" | "shiftKey">) {
  /**
   * 链接仍然要保留浏览器原生语义：
   * - Cmd/Ctrl 点击、新标签页、鼠标中键不应被前端路由劫持；
   * - 只有“普通左键 + 当前页打开”才交给 react-router。
   */
  const anchorTarget = event.currentTarget.getAttribute("target");
  return (
    event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || !!anchorTarget && anchorTarget !== "_self"
  );
}

/**
 * 文本链接统一收口到组件库 Link。
 *
 * 这里保留 `href` 是为了让可访问性、长按复制地址和测试定位都继续成立；
 * 真正点击时仍通过 react-router 导航，避免整页刷新。
 */
export function AppTextLink({ children, to, target }: AppTextLinkProps) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (shouldKeepBrowserNavigation(event)) {
      return;
    }

    event.preventDefault();
    navigate(to);
  }

  return (
    <Link className="app-text-link" href={to} onClick={handleClick} target={target} theme="primary" underline>
      {children}
    </Link>
  );
}
