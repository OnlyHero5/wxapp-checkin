import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppButton } from "./AppButton";

describe("AppButton", () => {
  it("keeps only a thin TDesign wrapper instead of writing project-owned button classes", () => {
    render(<AppButton>提交签到码</AppButton>);

    const button = screen.getByRole("button", { name: "提交签到码" });

    expect(button).toHaveAttribute("type", "button");
    expect(button.className).toContain("t-button");
    expect(button).not.toHaveClass("app-button");
  });
});
