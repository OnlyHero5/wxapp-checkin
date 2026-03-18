import { Navigate, Route, Routes } from "react-router-dom";
import { ActivitiesPage } from "../pages/activities/ActivitiesPage";
import { ActivityDetailPage } from "../pages/activity-detail/ActivityDetailPage";
import { ChangePasswordPage } from "../pages/change-password/ChangePasswordPage";
import { CheckinPage } from "../pages/checkin/CheckinPage";
import { CheckoutPage } from "../pages/checkout/CheckoutPage";
import { LoginPage } from "../pages/login/LoginPage";
import { ActivityRosterPage } from "../pages/activity-roster/ActivityRosterPage";
import { StaffManagePage } from "../pages/staff-manage/StaffManagePage";
import {
  getMustChangePassword,
  getSession,
  isStaffSession
} from "../shared/session/session-store";
import { AppBusinessNav } from "../shared/ui/AppBusinessNav";
import { MobilePage } from "../shared/ui/MobilePage";

/**
 * 这一层的占位页只用于“路由存在但功能还未开发完成”的场景。
 *
 * 这里保留它，是为了后续新增页面时可以先把路由骨架挂上，
 * 再逐步把页面实现替换进去。
 */
type PlaceholderPageProps = {
  description: string;
  title: string;
};

function PlaceholderPage({ description, title }: PlaceholderPageProps) {
  return (
    <MobilePage eyebrow="手机 Web 改造首批" title={title}>
      <p>{description}</p>
    </MobilePage>
  );
}

/**
 * 路由层只依赖“本地是否存在会话 token”做第一层准入判断。
 *
 * 这样做的目的不是替代后端鉴权，而是：
 * 1. 避免未登录用户直接看到业务页壳层
 * 2. 让前端在页面切换阶段尽早走到正确入口
 * 3. 把“公共页 / 受保护页”的导航规则集中在一处维护
 *
 * 真正的权限正确性仍然以后端返回为准，业务页面收到 `session_expired`
 * 后还会再次跳回 `/login`。
 */
function hasSession() {
  return !!getSession();
}

function mustChangePassword() {
  return getMustChangePassword();
}

function AppBusinessShell({ children }: { children: JSX.Element }) {
  return (
    <div className="app-business-shell">
      {children}
      <AppBusinessNav />
    </div>
  );
}

/**
 * 受保护路由：
 * 没有本地会话时直接跳到登录页。
 */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  if (!hasSession()) {
    return <Navigate replace to="/login" />;
  }
  if (mustChangePassword()) {
    return <Navigate replace to="/change-password" />;
  }

  return <AppBusinessShell>{children}</AppBusinessShell>;
}

/**
 * 强制改密路由：
 * - 未登录：回 /login
 * - 已完成改密：回 /activities（避免用户误留在改密页）
 */
function PasswordChangeRoute({ children }: { children: JSX.Element }) {
  if (!hasSession()) {
    return <Navigate replace to="/login" />;
  }
  if (!mustChangePassword()) {
    return <Navigate replace to="/activities" />;
  }
  return children;
}

function StaffRoute({ children }: { children: JSX.Element }) {
  if (!hasSession()) {
    return <Navigate replace to="/login" />;
  }
  if (mustChangePassword()) {
    return <Navigate replace to="/change-password" />;
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
function PublicRoute({ children }: { children: JSX.Element }) {
  if (hasSession()) {
    return <Navigate replace to={mustChangePassword() ? "/change-password" : "/activities"} />;
  }

  return children;
}

/**
 * 路由表的设计遵循当前文档基线：
 * 1. 站点根路径 `/` 必须自动落到登录或活动页
 * 2. `/login` 是公共入口
 * 3. `/activities/**` 及其子页都是登录后页面
 * 4. 未实现的路径统一给出明确 404 提示
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* 根路径不暴露空白页，直接根据登录态分流到最可能的入口。 */}
      <Route
        path="/"
        element={<Navigate replace to={hasSession() ? (mustChangePassword() ? "/change-password" : "/activities") : "/login"} />}
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            {/* 登录页只允许未登录用户进入。 */}
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <PasswordChangeRoute>
            {/* 改密页是强制入口：只有 must_change_password=true 时允许进入。 */}
            <ChangePasswordPage />
          </PasswordChangeRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute>
            {/* 活动列表是用户进入业务态后的首页。 */}
            <ActivitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/:activityId"
        element={
          <ProtectedRoute>
            {/* 详情页承接“查看活动 + 决定去签到还是去签退”的中间态。 */}
            <ActivityDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/:activityId/checkin"
        element={
          <ProtectedRoute>
            {/* 普通用户签到动作页。 */}
            <CheckinPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/:activityId/checkout"
        element={
          <ProtectedRoute>
            {/* 普通用户签退动作页。 */}
            <CheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/activities/:activityId/manage"
        element={
          <StaffRoute>
            {/* 管理员动态码管理页与批量签退入口。 */}
            <StaffManagePage />
          </StaffRoute>
        }
      />
      <Route
        path="/staff/activities/:activityId/roster"
        element={
          <StaffRoute>
            {/* 名单页承接“看参会人 + 修签到签退状态”，与发码管理页明确分层。 */}
            <ActivityRosterPage />
          </StaffRoute>
        }
      />
      <Route
        path="*"
        // 这里故意不做自动重定向，避免用户访问错误链接时失去排查线索。
        element={<PlaceholderPage title="页面不存在" description="请检查访问地址是否正确。" />}
      />
    </Routes>
  );
}
