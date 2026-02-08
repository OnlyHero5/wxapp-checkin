const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    role: "normal",
    activityId: "",
    loading: false,
    detail: {}
  },
  onLoad(options) {
    this.bindNetwork();
    this.setData({
      activityId: (options && options.id) || ""
    });
    this.init();
  },
  onShow() {
    if (this.data.activityId && this.data.sessionToken) {
      this.loadDetail();
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
      role: storage.getRole()
    });
    this.loadDetail();
  },
  async loadDetail() {
    if (!this.data.activityId) {
      return;
    }
    if (!this.data.isOnline) {
      return;
    }
    this.setData({ loading: true });
    try {
      const detail = await api.getStaffActivityDetail(this.data.activityId, this.data.sessionToken);
      if (!detail || detail.status === "invalid_activity") {
        ui.showToast((detail && detail.message) || "活动不存在或已下线");
        wx.navigateBack();
        return;
      }

      if (detail.status === "forbidden") {
        ui.showToast(detail.message || "无权限查看该活动");
        wx.navigateBack();
        return;
      }

      const normalizedDetail = {
        ...detail,
        my_registered: !!detail.my_registered,
        my_checked_in: !!detail.my_checked_in,
        my_checked_out: !!detail.my_checked_out,
        my_join_status: detail.my_checked_out
          ? "已签退"
          : (detail.my_checked_in ? "已签到" : (detail.my_registered ? "已报名" : "未报名"))
      };

      this.setData({ detail: normalizedDetail });
    } catch (err) {
      ui.showToast("活动详情加载失败");
    }
    this.setData({ loading: false });
  },
  goBack() {
    wx.navigateBack();
  }
});
