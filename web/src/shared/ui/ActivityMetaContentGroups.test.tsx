import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityMetaContentGroups } from "./ActivityMetaContentGroups";

describe("ActivityMetaContentGroups", () => {
  it("renders detail rows and metrics through dedicated reusable groups", () => {
    render(
      <ActivityMetaContentGroups
        counts={{
          checkin: 18,
          checkout: 3,
          expected: 26
        }}
        rows={[
          {
            label: "时间",
            value: "2026-03-10 09:00:00"
          },
          {
            label: "地点",
            value: "本部操场"
          }
        ]}
      />
    );

    expect(screen.getByText("活动信息")).toBeInTheDocument();
    expect(screen.getByText("统计")).toBeInTheDocument();
    expect(screen.getByText("本部操场")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });
});
