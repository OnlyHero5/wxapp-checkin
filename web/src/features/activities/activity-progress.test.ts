import { describe, expect, it } from "vitest";
import {
  parseActivityTime,
  parseChinaLocalTimeToUnixMs,
  resolveProgressStatus
} from "./activity-progress";

describe("activity-progress", () => {
  it("parses legacy activity time text as a China-local wall clock timestamp", () => {
    // 这里固定校验北京时间 2026-03-10 09:00 对应的 UNIX 毫秒，
    // 防止后续有人再把旧库 DATETIME 退回成“按宿主浏览器时区解释”。
    expect(parseChinaLocalTimeToUnixMs({
      day: 10,
      hour: 9,
      minute: 0,
      month: 2,
      second: 0,
      year: 2026
    })).toBe(1773104400000);
    expect(parseActivityTime("2026-03-10 09:00:00")).toBe(1773104400000);
    expect(parseActivityTime("2026/03/10 09:00:00")).toBe(1773104400000);
  });

  it("still prefers explicit completed progress statuses", () => {
    // 进度状态仍以服务端显式字段优先，时间解析修复不能反向污染状态归一规则。
    expect(resolveProgressStatus({
      progress_status: "completed",
      start_time: "2026-03-10 09:00:00"
    })).toBe("completed");
  });
});
