/**
 * App 只承担“应用外壳”职责。
 *
 * 当前阶段还没有引入全局状态管理器或查询缓存，因此这里只包一层路由。
 * 如果后续增加 QueryClientProvider、错误边界、埋点上下文等，
 * 也应该放在这一层，避免页面组件各自重复接线。
 */
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";

export default function App() {
  return (
    // 生产环境会以浏览器真实 URL 作为单一事实来源，因此这里使用 BrowserRouter。
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
