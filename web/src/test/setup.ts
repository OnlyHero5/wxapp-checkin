import "@testing-library/jest-dom/vitest";

// TDesign Tabs 在 jsdom 环境里会调用 `scrollTo`，这里补最小 polyfill，
// 避免测试因为宿主缺能力而不是因为业务代码出错。
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}

// TDesign Form 会通过原生 `requestSubmit` 驱动提交；
// jsdom 当前实现会直接抛 `Not implemented`，这里统一覆盖成最小可用行为。
if (typeof HTMLFormElement !== "undefined") {
  HTMLFormElement.prototype.requestSubmit = function requestSubmit() {
    this.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
}
