import { describe, expect, it } from "vitest";
import {
  buildActivityMetaSections
} from "./row-builders";

describe("activity meta row builders", () => {
  it("builds hero summary data for the single-card panel", () => {
    const sections = buildActivityMetaSections({
      description: "负责现场秩序维护",
      progressText: "进行中",
      subtitle: "志愿",
      title: "校园志愿活动"
    });

    expect(sections.hero).toEqual({
      description: "负责现场秩序维护",
      statusContent: "进行中",
      subtitle: "志愿",
      title: "校园志愿活动"
    });
  });

  it("keeps detail rows ordered by business reading sequence inside the detail section", () => {
    const sections = buildActivityMetaSections({
      checkinTimeText: "09:00",
      checkoutTimeText: "11:00",
      joinStatusText: "已报名",
      locationText: "本部操场",
      timeText: "2026-03-10 09:00",
      title: "校园志愿活动"
    });

    expect(sections.detail.rows.map((row) => row.label)).toEqual(["时间", "地点", "我的状态", "签到时间", "签退时间"]);
  });

  it("keeps cumulative count semantics in the metric section", () => {
    const sections = buildActivityMetaSections({
      counts: {
        checkin: 18,
        checkout: 3,
        expected: 25
      },
      title: "校园志愿活动"
    });

    expect(sections.metrics.rows).toEqual([
      {
        label: "应到",
        value: "25"
      },
      {
        label: "累计签到",
        value: "21"
      },
      {
        label: "已签退",
        value: "3"
      },
      {
        label: "未签退",
        value: "18"
      }
    ]);
  });
});
