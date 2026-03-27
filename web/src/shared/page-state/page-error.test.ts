import { describe, expect, it } from "vitest";
import { resolvePageErrorMessage } from "./page-error";

describe("resolvePageErrorMessage", () => {
  it("优先复用 Error 实例自带的 message", () => {
    expect(resolvePageErrorMessage(new Error("活动详情加载失败"), "默认错误")).toBe("活动详情加载失败");
  });

  it("在未知错误上回退到调用方给定的兜底文案", () => {
    expect(resolvePageErrorMessage({ message: "" }, "默认错误")).toBe("默认错误");
  });
});
