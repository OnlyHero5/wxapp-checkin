import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityMetaPanel } from "./ActivityMetaPanel";

const baseCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../app/styles/base.css"),
  "utf8"
);

describe("ActivityMetaPanel responsive layout", () => {
  it("allows long detail values to shrink and wrap inside narrow cards", () => {
    const { container } = render(
      <ActivityMetaPanel
        locationText="苏州大学独墅湖校区二期图书馆西侧报告厅外长廊集合点与备用签到处"
        subtitle="志愿"
        timeText="2026-03-10 09:00:00"
        title="校园志愿活动"
      />
    );

    const detailValue = container.querySelector(".activity-meta-panel__detail-value");

    expect(detailValue).not.toBeNull();
    expect(baseCss).toMatch(/\.activity-meta-panel__detail-value\s*\{[^}]*min-width:\s*0;/);
    expect(baseCss).toMatch(/\.activity-meta-panel__detail-value\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  });
});
