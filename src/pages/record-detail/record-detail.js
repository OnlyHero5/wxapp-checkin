const auth = require("../../utils/auth");
const api = require("../../utils/api");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    detail: {}
  },
  onLoad(options) {
    this.bindNetwork();
    this.init();
    if (options && options.id) {
      this.loadDetail(options.id);
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
  },
  async loadDetail(recordId) {
    if (!this.data.isOnline) {
      return;
    }
    try {
      const detail = await api.getRecordDetail(recordId);
      this.setData({ detail: detail || {} });
    } catch (err) {
      ui.showToast("详情加载失败");
    }
  },
  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
