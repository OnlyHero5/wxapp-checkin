import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppButton } from "./AppButton";

describe("AppButton", () => {
  it("keeps the TDesign button root while exposing a project-owned class for unified theming", () => {
    render(<AppButton>提交签到码</AppButton>);

    const button = screen.getByRole("button", { name: "提交签到码" });

    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("t-button");
    expect(button).toHaveClass("app-button");
  });
});
