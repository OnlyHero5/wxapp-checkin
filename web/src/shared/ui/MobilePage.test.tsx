import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

describe("MobilePage", () => {
  it("defaults to compact layout while keeping the tone hook", () => {
    render(
      <MobilePage tone="checkin" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "compact");
  });

  it("writes the explicit showcase layout hook for responsive display pages", () => {
    render(
      <MobilePage layout="showcase-auto" tone="staff" title="活动管理">
        <p>当前动态码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-layout", "showcase-auto");
  });
});
