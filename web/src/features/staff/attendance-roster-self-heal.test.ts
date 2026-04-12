import { describe, expect, it, vi } from "vitest";
import { ensureRosterConsistency } from "./attendance-roster-self-heal";

describe("attendance-roster-self-heal", () => {
  it("repairs dirty checked-out members and returns the refreshed roster", async () => {
    const getActivityRoster = vi
      .fn()
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 9,
            student_id: "9",
            name: "异常成员",
            checked_in: false,
            checked_out: true,
            checkin_time: "",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      })
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 9,
            student_id: "9",
            name: "异常成员",
            checked_in: true,
            checked_out: true,
            checkin_time: "2026-03-10 09:05",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      });
    const adjustAttendanceStates = vi.fn().mockResolvedValue({ status: "success" });

    const result = await ensureRosterConsistency({
      activityId: "act_101",
      adjustAttendanceStates,
      getActivityRoster
    });

    expect(getActivityRoster).toHaveBeenCalledTimes(2);
    expect(adjustAttendanceStates).toHaveBeenCalledWith("act_101", {
      user_ids: [9],
      patch: { checked_out: true },
      reason: "自动修复异常签退状态"
    });
    expect(result).toEqual({
      didHeal: true,
      roster: {
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 9,
            student_id: "9",
            name: "异常成员",
            checked_in: true,
            checked_out: true,
            checkin_time: "2026-03-10 09:05",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      }
    });
  });

  it("skips repair and returns the original roster when no anomaly exists", async () => {
    const getActivityRoster = vi.fn().mockResolvedValue({
      activity_id: "act_101",
      activity_title: "校园志愿活动",
      items: [
        {
          user_id: 8,
          student_id: "8",
          name: "正常成员",
          checked_in: true,
          checked_out: false,
          checkin_time: "2026-03-10 09:05",
          checkout_time: ""
        }
      ]
    });
    const adjustAttendanceStates = vi.fn();

    const result = await ensureRosterConsistency({
      activityId: "act_101",
      adjustAttendanceStates,
      getActivityRoster
    });

    expect(getActivityRoster).toHaveBeenCalledTimes(1);
    expect(adjustAttendanceStates).not.toHaveBeenCalled();
    expect(result).toEqual({
      didHeal: false,
      roster: {
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 8,
            student_id: "8",
            name: "正常成员",
            checked_in: true,
            checked_out: false,
            checkin_time: "2026-03-10 09:05",
            checkout_time: ""
          }
        ]
      }
    });
  });

  it("throws when the reread roster is still anomalous after an attempted heal", async () => {
    const getActivityRoster = vi
      .fn()
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 9,
            student_id: "9",
            name: "异常成员",
            checked_in: false,
            checked_out: true,
            checkin_time: "",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      })
      .mockResolvedValueOnce({
        activity_id: "act_101",
        activity_title: "校园志愿活动",
        items: [
          {
            user_id: 9,
            student_id: "9",
            name: "异常成员",
            checked_in: false,
            checked_out: true,
            checkin_time: "",
            checkout_time: "2026-03-10 10:10"
          }
        ]
      });
    const adjustAttendanceStates = vi.fn().mockResolvedValue({ status: "success" });

    await expect(ensureRosterConsistency({
      activityId: "act_101",
      adjustAttendanceStates,
      getActivityRoster
    })).rejects.toThrow("自动修复异常签退状态失败");

    expect(getActivityRoster).toHaveBeenCalledTimes(2);
    expect(adjustAttendanceStates).toHaveBeenCalledTimes(1);
  });
});
