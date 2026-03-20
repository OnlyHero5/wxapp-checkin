/**
 * 应用的浏览器入口文件。
 *
 * 这里故意保持很薄：
 * 1. 只负责把 React 根节点挂到 `#root`
 * 2. 统一注入全局样式
 * 3. 用 `StrictMode` 提前暴露副作用问题
 *
 * 后续如果要接运行时监控、全局埋点、国际化或主题提供器，
 * 也应该优先从这个入口继续向外包裹，而不是散落到页面内部。
 */
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "tdesign-mobile-react/es/style/index.css";
import App from "./app/App";
import "./app/styles/base.css";

// `createRoot` 是 React 18 推荐入口，支持并发渲染能力。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
