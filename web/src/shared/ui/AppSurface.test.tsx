import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobilePage } from "./MobilePage";

describe("shared page shell", () => {
  it("does not render the legacy app-surface contract anymore", () => {
    render(
      <MobilePage title="活动管理">
        <p>动态码展示区</p>
      </MobilePage>
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(document.querySelector(".app-surface")).toBeNull();
  });
});
