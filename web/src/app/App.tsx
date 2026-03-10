/**
 * App 只承担“应用外壳”职责。
 *
 * 当前阶段还没有引入全局状态管理器或查询缓存，因此这里只包一层路由。
 * 如果后续增加 QueryClientProvider、错误边界、埋点上下文等，
 * 也应该放在这一层，避免页面组件各自重复接线。
 */
import { BrowserRouter } from "react-router-dom";
import { resolveRuntimeConfig } from "../shared/runtime/runtime-config";
import { AppRoutes } from "./router";

export default function App() {
  const { routerBasename } = resolveRuntimeConfig(import.meta.env as Record<string, string | undefined>);

  return (
    // basename 允许 Web-only 前端在 `/checkin/` 这类子路径下独立挂载，避免和其他 SPA 抢根路由。
    <BrowserRouter basename={routerBasename}>
      <AppRoutes />
    </BrowserRouter>
  );
}
