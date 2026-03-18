import { Link, useLocation } from "react-router-dom";

const activityMatchers = [
  /^\/activities(\/.*)?$/,
  /^\/staff\/activities(\/.*)?$/
];

/**
 * 顶级业务导航只表达两个稳定信息域：
 * - 活动
 * - 我的
 *
 * 这里故意不把“详情 / 签到 / 管理 / 名单”再抬升成顶级入口，
 * 否则用户会把返回链路误解成主导航结构。
 */
function resolveBusinessNavKey(pathname: string) {
  if (activityMatchers.some((pattern) => pattern.test(pathname))) {
    return "activities";
  }
  if (pathname === "/profile") {
    return "profile";
  }
  return "";
}

export function AppBusinessNav() {
  const { pathname } = useLocation();
  const activeKey = resolveBusinessNavKey(pathname);

  return (
    <nav
      aria-label="业务导航"
      className="page-bottom-nav app-business-nav"
      style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
    >
      <Link
        aria-current={activeKey === "activities" ? "page" : undefined}
        className={activeKey === "activities" ? "page-bottom-nav__item page-bottom-nav__item--active" : "page-bottom-nav__item"}
        to="/activities"
      >
        活动
      </Link>
      <Link
        aria-current={activeKey === "profile" ? "page" : undefined}
        className={activeKey === "profile" ? "page-bottom-nav__item page-bottom-nav__item--active" : "page-bottom-nav__item"}
        to="/profile"
      >
        我的
      </Link>
    </nav>
  );
}
