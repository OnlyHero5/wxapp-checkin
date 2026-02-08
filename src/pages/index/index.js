const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

const ACTIVITY_TYPE_TONES = [
  { tone: "roadshow", keywords: ["路演", "roadshow"] },
  { tone: "competition", keywords: ["竞赛", "比赛", "hack", "挑战"] },
  { tone: "workshop", keywords: ["工作坊", "实战", "workshop"] },
  { tone: "forum", keywords: ["论坛", "峰会", "forum"] },
  { tone: "lecture", keywords: ["讲座", "分享", "lecture"] },
  { tone: "training", keywords: ["培训", "training"] },
  { tone: "community", keywords: ["社群", "meetup", "交流"] },
  { tone: "expo", keywords: ["展会", "开放日", "expo"] }
];

const parseActivityTime = (timeText) => {
  if (!timeText || typeof timeText !== "string") {
    return 0;
  }

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

  const date = new Date(
    dateBits[0],
    Math.max(0, dateBits[1] - 1),
    dateBits[2],
    Number.isNaN(timeBits[0]) ? 0 : timeBits[0],
    Number.isNaN(timeBits[1]) ? 0 : timeBits[1],
    Number.isNaN(timeBits[2]) ? 0 : timeBits[2]
  );
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const resolveActivityProgress = (activity) => {
  const rawStatus = `${activity.progress_status || activity.activity_status || ""}`.trim().toLowerCase();

  if (["ongoing", "in_progress", "in-progress", "active", "processing", "running", "进行中", "正在进行"].includes(rawStatus)) {
    return "ongoing";
  }
  if (["completed", "finished", "done", "ended", "已完成", "已结束"].includes(rawStatus)) {
    return "completed";
  }

  const timeValue = parseActivityTime(activity.start_time);
  if (!timeValue) {
    return "ongoing";
  }
  return timeValue >= Date.now() ? "ongoing" : "completed";
};

const sortActivitiesByTimeDesc = (activities) => {
  return activities.slice().sort((left, right) => parseActivityTime(right.start_time) - parseActivityTime(left.start_time));
};

const resolveActivityTypeTone = (typeText) => {
  const text = `${typeText || ""}`.trim().toLowerCase();
  if (!text) {
    return "default";
  }

  const matched = ACTIVITY_TYPE_TONES.find((item) => {
    return item.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
  return matched ? matched.tone : "default";
};

const resolveNormalJoinStatus = (activity) => {
  if (activity.my_checked_out) {
    return "已签退";
  }
  if (activity.my_checked_in) {
    return "已签到";
  }
  if (activity.my_registered) {
    return "已报名";
  }
  return "未报名";
};

const buildActivityGroups = (activities, role) => {
  const roleFilteredActivities = role === "normal"
    ? (activities || []).filter((item) => item.my_registered || item.my_checked_in || item.my_checked_out)
    : (activities || []);

  const normalized = roleFilteredActivities.map((item) => ({
    ...item,
    my_registered: !!item.my_registered,
    my_checked_in: !!item.my_checked_in,
    my_checked_out: !!item.my_checked_out,
    my_join_status: resolveNormalJoinStatus(item),
    progress_status: resolveActivityProgress(item),
    type_tone: resolveActivityTypeTone(item.activity_type)
  }));

  const ongoingActivities = sortActivitiesByTimeDesc(
    normalized.filter((item) => item.progress_status === "ongoing")
  );
  const completedActivities = sortActivitiesByTimeDesc(
    normalized.filter((item) => item.progress_status === "completed")
  );

  return {
    activities: normalized,
    ongoingActivities,
    completedActivities,
    activitySections: [
      {
        key: "ongoing",
        title: "正在进行",
        items: ongoingActivities
      },
      {
        key: "completed",
        title: "已完成",
        items: completedActivities
      }
    ]
  };
};

Page({
  data: {
    isOnline: true,
    initialized: false,
    role: "normal",
    sessionToken: "",
    loading: false,
    activities: [],
    ongoingActivities: [],
    completedActivities: [],
    activitySections: [],
    actionLoadingId: "",
    actionLoadingType: "",
    lastStatus: null
  },
  onLoad() {
    this.bindNetwork();
    this.init();
  },
  onShow() {
    if (this.data.initialized) {
      this.handleRoleEntry();
    }
  },
  onUnload() {
    if (this.unsubNetwork) {
      this.unsubNetwork();
    }
  },
  bindNetwork() {
    const app = getApp();
    this.setData({ isOnline: app.globalData.isOnline });
    this.unsubNetwork = app.onNetworkChange((res) => {
      this.setData({ isOnline: res.isOnline });
    });
  },
  async init() {
    const sessionToken = await auth.ensureSession();
    this.setData({
      sessionToken,
      role: storage.getRole(),
      initialized: true
    });
    this.handleRoleEntry();
  },
  ensureBound() {
    if (!storage.isBound()) {
      wx.navigateTo({ url: "/pages/register/register" });
      return false;
    }
    return true;
  },
  handleRoleEntry() {
    this.setData({ role: storage.getRole() });
    if (!this.ensureBound()) {
      return;
    }
    this.loadActivities();
  },
  async loadActivities() {
    if (!this.data.isOnline) {
      return;
    }
    this.setData({ loading: true });
    try {
      const result = await api.getStaffActivities(this.data.sessionToken);
      const grouped = buildActivityGroups((result && result.activities) || [], this.data.role);
      this.setData(grouped);
    } catch (err) {
      ui.showToast("活动信息加载失败");
    }
    this.setData({ loading: false });
  },
  onTapCheckin(e) {
    const activityId = e.currentTarget.dataset.id;
    this.openStaffQrPage(activityId, "checkin");
  },
  onTapCheckout(e) {
    const activityId = e.currentTarget.dataset.id;
    this.openStaffQrPage(activityId, "checkout");
  },
  onTapDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    if (!activityId) {
      return;
    }
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${activityId}` });
  },
  onGoScanPage() {
    wx.navigateTo({ url: "/pages/scan-action/scan-action" });
  },
  openStaffQrPage(activityId, actionType) {
    if (this.data.role !== "staff") {
      ui.showToast("仅工作人员可展示二维码");
      return;
    }

    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }
    const activity = this.data.activities.find((item) => item.activity_id === activityId);
    if (!activity) {
      ui.showToast("活动信息不存在");
      return;
    }
    if (activity.progress_status === "completed") {
      ui.showToast("已完成活动仅支持查看详情");
      return;
    }
    if (actionType === "checkout" && !activity.support_checkout) {
      ui.showToast("该活动暂不支持签退");
      return;
    }

    const encodedTitle = encodeURIComponent(activity.activity_title || "");
    wx.navigateTo({
      url: `/pages/staff-qr/staff-qr?id=${activityId}&actionType=${actionType}&title=${encodedTitle}`
    });
  },
  handleActionResult(result, actionType, activityTitle) {
    if (!result || result.status !== "success") {
      ui.showToast((result && result.message) || "操作失败");
      return;
    }
    const actionLabel = actionType === "checkout" ? "签退" : "签到";
    ui.showToast(result.message || `${actionLabel}成功`, "success");
    this.setData({
      lastStatus: {
        title: `${activityTitle} ${actionLabel}成功`,
        message: result.message || "已记录操作",
        meta: result.checkin_record_id ? `记录号: ${result.checkin_record_id}` : ""
      }
    });
    this.loadActivities();
  }
});
