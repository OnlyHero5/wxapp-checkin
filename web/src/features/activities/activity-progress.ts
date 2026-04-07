import type { ActivitySummary } from "./api";

const CHINA_TIMEZONE_OFFSET_HOURS = 8;

// 兼容当前文档、历史小程序和后端可能返回的多种“进行中”写法。
const ONGOING_PROGRESS_STATUSES = new Set([
  "ongoing",
  "in_progress",
  "in-progress",
  "active",
  "processing",
  "running",
  "进行中",
  "正在进行"
]);

// 同理，兼容多种“已完成”写法。
const COMPLETED_PROGRESS_STATUSES = new Set([
  "completed",
  "finished",
  "done",
  "ended",
  "已完成",
  "已结束"
]);

/**
 * 历史数据里时间格式并不总是统一，因此这里做容错解析。
 *
 * 支持：
 * - `2026-03-10 09:00:00`
 * - `2026/03/10 09:00:00`
 * - `2026.03.10 09:00:00`
 * - ISO 字符串中带 `T` 的变体
 */
export function parseActivityTime(timeText?: string) {
  if (!timeText || typeof timeText !== "string") {
    return 0;
  }

  // 先把几种常见分隔符归一到同一种格式，降低解析分支复杂度。
  const normalized = timeText
    .trim()
    .replace("T", " ")
    .replace(/\./g, "-")
    .replace(/\//g, "-");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const dateBits = (datePart || "").split("-").map((item) => Number(item));
  const timeBits = (timePart || "").split(":").map((item) => Number(item));

  if (dateBits.length < 3 || dateBits.some((item) => Number.isNaN(item))) {
    return 0;
  }

  return parseChinaLocalTimeToUnixMs({
    day: dateBits[2],
    hour: Number.isNaN(timeBits[0]) ? 0 : timeBits[0],
    minute: Number.isNaN(timeBits[1]) ? 0 : timeBits[1],
    month: Math.max(0, dateBits[1] - 1),
    second: Number.isNaN(timeBits[2]) ? 0 : timeBits[2],
    year: dateBits[0]
  });
}

type ChinaLocalTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

/**
 * 历史活动时间字符串的业务语义固定是北京时间本地时间。
 * 显式转成 UNIX 毫秒可以避免浏览器宿主时区不同导致排序和比较结果漂移。
 */
export function parseChinaLocalTimeToUnixMs(parts: ChinaLocalTimeParts) {
  const utcTimeMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour - CHINA_TIMEZONE_OFFSET_HOURS,
    parts.minute,
    parts.second
  );

  return Number.isNaN(utcTimeMs) ? 0 : utcTimeMs;
}

/**
 * 统一活动进度。
 *
 * 优先相信后端显式状态；
 * 若状态缺失，则退回到“根据开始时间做最保守推导”。
 */
export function resolveProgressStatus(activity: Pick<ActivitySummary, "progress_status" | "start_time">) {
  const rawStatus = `${activity.progress_status ?? ""}`.trim().toLowerCase();
  // 显式状态优先级最高，因为它最接近后端真实业务规则。
  if (ONGOING_PROGRESS_STATUSES.has(rawStatus)) {
    return "ongoing";
  }
  if (COMPLETED_PROGRESS_STATUSES.has(rawStatus)) {
    return "completed";
  }

  // 只有开始时间而没有显式状态时，前端无法可靠区分“已开始仍在进行”
  // 和“已经结束”，此时保守地按进行中处理，避免把可操作活动误伤成已完成。
  return "ongoing";
}
