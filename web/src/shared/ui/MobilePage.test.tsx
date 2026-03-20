import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

describe("MobilePage", () => {
  it("writes the page tone to the main shell for styling hooks", () => {
    render(
      <MobilePage tone="checkin" title="活动签到">
        <p>请输入签到码</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
  });
});
