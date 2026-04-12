import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribePageVisible } from "./page-lifecycle";

const originalVisibilityState = document.visibilityState;

afterEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: originalVisibilityState
  });
});

describe("subscribePageVisible", () => {
  it("invokes the callback when the page returns to visible", () => {
    const callback = vi.fn();
    const unsubscribe = subscribePageVisible(callback);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden"
    });
    document.dispatchEvent(new Event("visibilitychange"));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible"
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("invokes the callback when the page is restored from bfcache via pageshow", () => {
    const callback = vi.fn();
    const unsubscribe = subscribePageVisible(callback);
    const pageShowEvent = new Event("pageshow");
    Object.defineProperty(pageShowEvent, "persisted", {
      configurable: true,
      value: true
    });

    window.dispatchEvent(pageShowEvent);

    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
