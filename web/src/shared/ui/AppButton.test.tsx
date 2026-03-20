import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppButton } from "./AppButton";

describe("AppButton", () => {
  it("adds a stable accent class for business tone styling", () => {
    render(<AppButton accentTone="checkin">提交签到码</AppButton>);

    expect(screen.getByRole("button", { name: "提交签到码" })).toHaveClass(
      "app-button",
      "app-button--primary",
      "app-button--accent-checkin"
    );
  });
});
