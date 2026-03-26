import { MouseEvent, ReactNode } from "react";
import { Link } from "tdesign-mobile-react";
import { useNavigate } from "react-router-dom";

type AppTextLinkProps = {
  children: ReactNode;
  to: string;
};

/**
 * 文本链接统一收口到组件库 Link。
 *
 * 这里保留 `href` 是为了让可访问性、长按复制地址和测试定位都继续成立；
 * 真正点击时仍通过 react-router 导航，避免整页刷新。
 */
export function AppTextLink({ children, to }: AppTextLinkProps) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigate(to);
  }

  return (
    <Link href={to} onClick={handleClick} theme="primary" underline>
      {children}
    </Link>
  );
}
