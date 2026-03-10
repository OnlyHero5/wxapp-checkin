import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ActivityCard } from "./ActivityCard";

describe("ActivityCard", () => {
  it("encodes special characters in activity detail links", () => {
    render(
      <MemoryRouter>
        <ActivityCard
          activity={{
            activity_id: "act/ 101?#",
            activity_title: "校园志愿活动",
            my_registered: true,
            progress_status: "ongoing"
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute(
      "href",
      "/activities/act%2F%20101%3F%23"
    );
  });
});
