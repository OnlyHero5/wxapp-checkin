import { describe, expect, it } from "vitest";
import {
  buildActivityMetaDetailRows,
  buildActivityMetaMetricRows,
  buildActivityMetaSummaryRows
} from "./row-builders";

describe("activity meta row builders", () => {
  it("keeps summary rows mapped to native TDesign cell props", () => {
    const rows = buildActivityMetaSummaryRows({
      description: "负责现场秩序维护",
      progressText: "进行中",
      subtitle: "志愿"
    });

    expect(rows).toEqual([
      {
        note: "志愿",
        title: "类型"
      },
      {
        align: "top",
        description: "负责现场秩序维护",
        title: "说明"
      },
      {
        note: "进行中",
        title: "状态"
      }
    ]);
  });

  it("keeps detail rows ordered by business reading sequence", () => {
    const rows = buildActivityMetaDetailRows({
      checkinTimeText: "09:00",
      checkoutTimeText: "11:00",
      joinStatusText: "已报名",
      locationText: "本部操场",
      timeText: "2026-03-10 09:00"
    });

    expect(rows.map((row) => row.title)).toEqual(["时间", "地点", "我的状态", "签到时间", "签退时间"]);
  });

  it("keeps cumulative count semantics in the metric rows", () => {
    const rows = buildActivityMetaMetricRows({
      checkin: 18,
      checkout: 3,
      expected: 25
    });

    expect(rows).toEqual([
      {
        note: "25",
        title: "应到"
      },
      {
        note: "21",
        title: "累计签到"
      },
      {
        note: "3",
        title: "已签退"
      },
      {
        note: "18",
        title: "未签退"
      }
    ]);
  });
});
