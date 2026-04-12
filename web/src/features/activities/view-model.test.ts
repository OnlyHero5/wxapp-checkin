import { describe, expect, it, vi } from "vitest";
import {
  formatServerTime,
  resolveActivityDisplayStatus,
  resolveCanCheckin,
  resolveCanCheckout,
  resolveJoinStatus,
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

  it("treats a completed activity as finished only after both checkin and checkout are done", () => {
    expect(resolveActivityDisplayStatus({
      my_checked_in: true,
      my_checked_out: true,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("completed");

    expect(resolveJoinStatus({
      my_checked_in: true,
      my_checked_out: true,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("已完成");
  });

  it("marks completed activities without checkin or checkout explicitly as missing steps", () => {
    expect(resolveActivityDisplayStatus({
      my_checked_in: false,
      my_checked_out: false,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("missed_checkin");
    expect(resolveJoinStatus({
      my_checked_in: false,
      my_checked_out: false,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("未签到");

    expect(resolveActivityDisplayStatus({
      my_checked_in: true,
      my_checked_out: false,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("missed_checkout");
    expect(resolveJoinStatus({
      my_checked_in: true,
      my_checked_out: false,
      my_registered: true,
      progress_status: "completed",
      start_time: "2026-03-01 09:00:00"
    })).toBe("未签退");
  });
});
