import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusTag } from "./StatusTag";

describe("StatusTag", () => {
  it("adds a stable ongoing class for ongoing activities", () => {
    render(<StatusTag status="ongoing" />);

    expect(screen.getByText("进行中").closest(".status-tag")).toHaveClass("status-tag", "status-tag--ongoing");
  });

  it("adds a stable completed class for completed activities", () => {
    render(<StatusTag status="completed" />);

    expect(screen.getByText("已完成").closest(".status-tag")).toHaveClass("status-tag", "status-tag--completed");
  });
});
