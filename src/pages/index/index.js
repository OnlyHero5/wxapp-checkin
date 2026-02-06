const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    initialized: false,
    role: "normal",
    sessionToken: "",
    loading: false,
    activities: [],
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
      this.setData({ activities: (result && result.activities) || [] });
    } catch (err) {
      ui.showToast("活动信息加载失败");
    }
    this.setData({ loading: false });
  },
  onTapCheckin(e) {
    const activityId = e.currentTarget.dataset.id;
    this.scanAndSubmit(activityId, "checkin");
  },
  onTapCheckout(e) {
    const activityId = e.currentTarget.dataset.id;
    this.scanAndSubmit(activityId, "checkout");
  },
  onTapDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    if (!activityId) {
      return;
    }
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${activityId}` });
  },
  scanAndSubmit(activityId, actionType) {
    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }
    const activity = this.data.activities.find((item) => item.activity_id === activityId);
    if (!activity) {
      ui.showToast("活动信息不存在");
      return;
    }
    if (actionType === "checkout" && !activity.support_checkout) {
      ui.showToast("该活动暂不支持签退");
      return;
    }

    this.setData({
      actionLoadingId: activityId,
      actionLoadingType: actionType,
      lastStatus: null
    });

    wx.scanCode({
      onlyFromCamera: true,
      success: async (res) => {
        try {
          const result = await api.staffActivityAction({
            sessionToken: this.data.sessionToken,
            activityId,
            actionType,
            qrToken: res.result,
          });
          this.handleActionResult(result, actionType, activity.activity_title);
        } catch (err) {
          ui.showToast(`${actionType === "checkout" ? "签退" : "签到"}失败，请重试`);
        }
        this.setData({ actionLoadingId: "", actionLoadingType: "" });
      },
      fail: () => {
        this.setData({ actionLoadingId: "", actionLoadingType: "" });
      }
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
