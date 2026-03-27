import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSurface } from "./AppSurface";

describe("AppSurface", () => {
  it("writes a stable app-owned surface contract for shared page shells", () => {
    render(
      <AppSurface tone="staff" variant="staff-code">
        动态码展示区
      </AppSurface>
    );

    const surface = document.querySelector(".app-surface");

    expect(surface).toHaveAttribute("data-surface-tone", "staff");
    expect(surface).toHaveAttribute("data-surface-variant", "staff-code");
    expect(surface).toHaveClass("app-surface--staff-code");
  });
});
