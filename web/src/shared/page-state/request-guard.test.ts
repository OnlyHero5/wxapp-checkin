import { describe, expect, it } from "vitest";
import { createRequestGuard } from "./request-guard";

describe("createRequestGuard", () => {
  it("每次开始新请求都会推进版本号", () => {
    const guard = createRequestGuard();

    expect(guard.beginRequest()).toBe(1);
    expect(guard.beginRequest()).toBe(2);
    expect(guard.beginRequest()).toBe(3);
  });

  it("只把最后一次请求视为当前有效请求", () => {
    const guard = createRequestGuard();
    const firstRequestVersion = guard.beginRequest();
    const secondRequestVersion = guard.beginRequest();

    expect(guard.isCurrent(firstRequestVersion)).toBe(false);
    expect(guard.isCurrent(secondRequestVersion)).toBe(true);
  });
});
