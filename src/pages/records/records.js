const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    loading: false,
    records: []
  },
  onLoad() {
    this.bindNetwork();
    this.init();
  },
  onShow() {
    const ready = this.ensureBound();
    if (ready) {
      this.loadRecords();
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
  ensureBound() {
    if (!storage.isBound()) {
      wx.navigateTo({ url: "/pages/register/register" });
      return false;
    }
    return true;
  },
  async loadRecords() {
    if (!this.data.isOnline) {
      return;
    }
    this.setData({ loading: true });
    try {
      const result = await api.getRecords(this.data.sessionToken);
      this.setData({ records: (result && result.records) || [] });
    } catch (err) {
      ui.showToast("记录加载失败");
    }
    this.setData({ loading: false });
  },
  openDetail(e) {
    const recordId = e.currentTarget.dataset.id;
    if (!recordId) {
      return;
    }
    wx.navigateTo({ url: `/pages/record-detail/record-detail?id=${recordId}` });
  }
});
