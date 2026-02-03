const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    activity: {},
    studentId: "",
    name: "",
    sessionToken: "",
    loading: false,
    lastStatus: null,
    showSuccess: false
  },
  onLoad() {
    this.bindNetwork();
    this.init();
  },
  onShow() {
    this.ensureBound();
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
    this.loadActivity();
  },
  async loadActivity() {
    try {
      const activity = await api.getActivityCurrent();
      this.setData({ activity: activity || {} });
    } catch (err) {
      ui.showToast("活动信息加载失败");
    }
  },
  ensureBound() {
    if (!storage.isBound()) {
      wx.navigateTo({ url: "/pages/register/register" });
      return;
    }
    this.setData({
      studentId: storage.getStudentId(),
      name: storage.getName()
    });
  },
  onScan() {
    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }
    if (!storage.isBound()) {
      ui.showToast("请先完成注册绑定");
      wx.navigateTo({ url: "/pages/register/register" });
      return;
    }
    this.setData({ loading: true, lastStatus: null });
    wx.scanCode({
      onlyFromCamera: true,
      success: async (res) => {
        try {
          const result = await api.verifyCheckin({
            sessionToken: this.data.sessionToken,
            qrToken: res.result,
            studentId: storage.getStudentId(),
            name: storage.getName()
          });
          this.handleCheckinResult(result);
        } catch (err) {
          ui.showToast("签到失败，请重试");
        }
        this.setData({ loading: false });
      },
      fail: () => {
        this.setData({ loading: false });
      }
    });
  },
  handleCheckinResult(result) {
    if (!result) {
      ui.showToast("签到失败");
      return;
    }
    const map = {
      success: {
        title: "签到成功",
        message: result.message || "签到已完成"
      },
      invalid_qr: {
        title: "二维码无效",
        message: result.message || "二维码已失效，请扫码最新二维码"
      },
      duplicate: {
        title: "重复签到",
        message: result.message || "该活动已签到"
      },
      identity_mismatch: {
        title: "身份不匹配",
        message: result.message || "请确认学号姓名与微信身份一致"
      }
    };
    const status = map[result.status] || {
      title: "签到失败",
      message: result.message || "未知错误"
    };
    status.meta = result.checkin_record_id ? `记录号: ${result.checkin_record_id}` : "";

    if (result.status === "success") {
      this.setData({ showSuccess: true });
    }
    this.setData({ lastStatus: status });
  },
  closeSuccess() {
    this.setData({ showSuccess: false });
  },
  goRecords() {
    this.setData({ showSuccess: false });
    wx.switchTab({ url: "/pages/records/records" });
  }
});
