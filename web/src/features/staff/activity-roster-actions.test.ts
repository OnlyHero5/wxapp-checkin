import { describe, expect, it } from "vitest";
import {
  resolveAttendanceActionPayload,
  toggleSelectedRosterMember
} from "./activity-roster-actions";

describe("activity-roster-actions", () => {
  it("maps batch action keys to stable patch payloads and audit reasons", () => {
    expect(resolveAttendanceActionPayload("set_checked_in")).toEqual({
      patch: {
        checked_in: true,
        checked_out: false
      },
      reason: "设为已签到"
    });
    expect(resolveAttendanceActionPayload("clear_checked_out")).toEqual({
      patch: {
        checked_in: true,
        checked_out: false
      },
      reason: "设为未签退"
    });
  });

  it("toggles selected members without duplicating user ids", () => {
    expect(toggleSelectedRosterMember([], 101, true)).toEqual([101]);
    expect(toggleSelectedRosterMember([101], 101, true)).toEqual([101]);
    expect(toggleSelectedRosterMember([101, 202], 101, false)).toEqual([202]);
  });
});
