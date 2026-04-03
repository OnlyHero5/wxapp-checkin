import { JSX } from "react";
import { Navigate } from "react-router-dom";
import { getSession, isStaffSession } from "../shared/session/session-store";
import { AppBusinessNav } from "../shared/ui/AppBusinessNav";
import { AppEmptyState } from "../shared/ui/AppEmptyState";
import { MobilePage } from "../shared/ui/MobilePage";

type RouteChildrenProps = {
  children: JSX.Element;
};

type PlaceholderPageProps = {
  description: string;
  title: string;
};

/**
 * 这一层的占位页只用于“路由存在但功能还未开发完成”的场景。
 *
 * 这里保留它，是为了后续新增页面时可以先把路由骨架挂上，
 * 再逐步把页面实现替换进去。
 */
export function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  return (
    <MobilePage eyebrow="手机 Web 改造首批" title={title}>
      <AppEmptyState message={description} />
    </MobilePage>
  );
}

/**
 * 路由层只依赖“本地是否存在会话 token”做第一层准入判断。
 *
 * 这样做的目的不是替代后端鉴权，而是：
 * 1. 避免未登录用户直接看到业务页壳层；
 * 2. 让前端在页面切换阶段尽早走到正确入口；
 * 3. 把“公共页 / 受保护页”的导航规则集中在一处维护。
 */
export function hasSession() {
  return !!getSession();
}

function AppBusinessShell({ children }: RouteChildrenProps) {
  return (
    <div className="app-business-shell">
      {/* 内容区单独包一层，方便底部固定导航给页面留下稳定的安全留白。 */}
      <div className="app-business-shell__content">{children}</div>
      <AppBusinessNav />
    </div>
  );
}

/**
 * 受保护路由：
 * 没有本地会话时直接跳到登录页。
 */
export function ProtectedRoute({ children }: RouteChildrenProps) {
  if (!hasSession()) {
    return <Navigate replace to="/login" />;
  }

  return <AppBusinessShell>{children}</AppBusinessShell>;
}

/**
 * staff 路由先判断是否登录，再判断当前本地会话是否具备 staff 身份。
 * 真正权限正确性仍以后端为准，这里只负责前端导航分流。
 */
export function StaffRoute({ children }: RouteChildrenProps) {
  if (!hasSession()) {
    return <Navigate replace to="/login" />;
  }
  if (!isStaffSession()) {
    return <Navigate replace to="/activities" />;
  }
  return <AppBusinessShell>{children}</AppBusinessShell>;
}

/**
 * 公共路由：
 * 已经有会话的用户不应该继续停留在登录页，
 * 否则会出现“明明已登录却还能看到登录表单”的体验问题。
 */
export function PublicRoute({ children }: RouteChildrenProps) {
  if (hasSession()) {
    return <Navigate replace to="/activities" />;
  }

  return children;
}
