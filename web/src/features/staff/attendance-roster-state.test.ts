import { describe, expect, it } from "vitest";
import {
  buildAttendanceAdjustmentPatch,
  collectAnomalousRosterUserIds,
  normalizeRosterItem
} from "./attendance-roster-state";

describe("attendance-roster-state", () => {
  it("treats checked-out members as checked-in even when backend flags are dirty", () => {
    const normalized = normalizeRosterItem({
      user_id: 12,
      student_id: "2025000012",
      name: "异常成员",
      checked_in: false,
      checked_out: true,
      checkin_time: "",
      checkout_time: "2026-03-10 10:10"
    });

    expect(normalized.checked_in).toBe(true);
    expect(normalized.checked_out).toBe(true);
    expect(normalized.normalized_state).toBe("checked_out");
    expect(normalized.is_data_anomalous).toBe(true);
  });

  it("collects only dirty checked-out members for self-heal", () => {
    expect(
      collectAnomalousRosterUserIds([
        {
          user_id: 1,
          student_id: "1",
          name: "A",
          checked_in: false,
          checked_out: false,
          checkin_time: "",
          checkout_time: ""
        },
        {
          user_id: 2,
          student_id: "2",
          name: "B",
          checked_in: false,
          checked_out: true,
          checkin_time: "",
          checkout_time: "2026-03-10 10:10"
        }
      ])
    ).toEqual([2]);
  });

  it("maps attendance actions to single-field command patches", () => {
    expect(buildAttendanceAdjustmentPatch("set_checked_in")).toEqual({
      checked_in: true
    });
    expect(buildAttendanceAdjustmentPatch("clear_checked_in")).toEqual({
      checked_in: false
    });
    expect(buildAttendanceAdjustmentPatch("set_checked_out")).toEqual({
      checked_out: true
    });
    expect(buildAttendanceAdjustmentPatch("clear_checked_out")).toEqual({
      checked_out: false
    });
  });
});
