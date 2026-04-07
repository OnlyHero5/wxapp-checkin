import { describe, expect, it, vi } from "vitest";
import {
  formatServerTime,
  resolveCanCheckin,
  resolveCanCheckout,
  resolveProgressStatus
} from "./view-model";

describe("activities view-model", () => {
  it("treats activities without explicit progress_status as ongoing instead of completed", () => {
    expect(resolveProgressStatus({
      progress_status: undefined,
      start_time: "2026-03-01 09:00:00"
    })).toBe("ongoing");
  });

  it("keeps checkin and checkout available when only fallback fields are present", () => {
    expect(resolveCanCheckin({
      activity_id: "act_ongoing",
      activity_title: "校园志愿活动",
      my_checked_in: false,
      my_checked_out: false,
      progress_status: undefined,
      start_time: "2026-03-01 09:00:00",
      support_checkin: true
    })).toBe(true);

    expect(resolveCanCheckout({
      activity_id: "act_checkout",
      activity_title: "创新论坛",
      my_checked_in: true,
      my_checked_out: false,
      progress_status: undefined,
      start_time: "2026-03-01 09:00:00",
      support_checkout: true
    })).toBe(true);
  });

  it("formats server time with an explicit Asia/Shanghai timezone contract", () => {
    const formatSpy = vi.spyOn(Intl, "DateTimeFormat");

    formatServerTime(1773104400000);

    expect(formatSpy).toHaveBeenCalledWith("zh-CN", expect.objectContaining({
      timeZone: "Asia/Shanghai"
    }));
  });
});
