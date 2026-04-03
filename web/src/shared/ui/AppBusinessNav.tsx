import { TabBar, TabBarItem } from "tdesign-mobile-react";
import { useLocation, useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const activeKey = resolveBusinessNavKey(pathname);

  function handleChange(value: string | number) {
    if (value === "activities") {
      navigate("/activities");
      return;
    }

    if (value === "profile") {
      navigate("/profile");
    }
  }

  return (
    <nav aria-label="业务导航" className="app-business-nav">
      <TabBar
        bordered
        className="app-business-nav__bar"
        split
        value={activeKey || undefined}
        onChange={handleChange}
      >
        <TabBarItem value="activities">活动</TabBarItem>
        <TabBarItem value="profile">我的</TabBarItem>
      </TabBar>
    </nav>
  );
}
