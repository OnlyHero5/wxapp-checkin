const auth = require("../../utils/auth");
const api = require("../../utils/api");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    sessionToken: "",
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
    this.setData({ sessionToken });
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
      this.setData({ detail: detail || {} });
    } catch (err) {
      ui.showToast("活动详情加载失败");
    }
    this.setData({ loading: false });
  },
  goBack() {
    wx.navigateBack();
  }
});
