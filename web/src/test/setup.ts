import "@testing-library/jest-dom/vitest";

// TDesign Tabs 在 jsdom 环境里会调用 `scrollTo`，这里补最小 polyfill，
// 避免测试因为宿主缺能力而不是因为业务代码出错。
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}
