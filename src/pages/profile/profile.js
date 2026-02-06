const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    role: "normal",
    roleLabel: "普通用户",
    name: "",
    studentId: "",
    department: "",
    club: "",
    avatarUrl: "",
    socialScore: 0,
    lectureScore: 0,
    showHistory: false,
    bound: false,
    loadingHistory: false,
    historyRecords: []
  },
  onLoad() {
    this.bindNetwork();
    this.init();
  },
  onShow() {
    this.refreshProfile();
    if (storage.isBound() && this.data.showHistory) {
      this.loadHistory();
    } else {
      this.setData({ historyRecords: [] });
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
    this.refreshProfile();
    if (storage.isBound() && this.data.showHistory) {
      this.loadHistory();
    } else {
      this.setData({ historyRecords: [] });
    }
  },
  refreshProfile() {
    const role = storage.getRole();
    this.setData({
      role,
      roleLabel: role === "staff" ? "工作人员" : "普通用户",
      name: storage.getName(),
      studentId: storage.getStudentId(),
      department: storage.getDepartment(),
      club: storage.getClub(),
      avatarUrl: storage.getAvatarUrl(),
      socialScore: storage.getSocialScore(),
      lectureScore: storage.getLectureScore(),
      showHistory: role === "staff",
      bound: storage.isBound()
    });
  },
  async loadHistory() {
    if (!this.data.isOnline) {
      return;
    }
    this.setData({ loadingHistory: true });
    try {
      const result = await api.getRecords(this.data.sessionToken);
      this.setData({ historyRecords: (result && result.records) || [] });
    } catch (err) {
      ui.showToast("活动记录加载失败");
    }
    this.setData({ loadingHistory: false });
  },
  openHistoryDetail(e) {
    const recordId = e.currentTarget.dataset.id;
    if (!recordId) {
      return;
    }
    wx.navigateTo({ url: `/pages/record-detail/record-detail?id=${recordId}` });
  },
  goActivities() {
    if (this.data.role !== "staff") {
      ui.showToast("你当前是普通用户");
      return;
    }
    wx.switchTab({ url: "/pages/index/index" });
  },
  onAction() {
    wx.navigateTo({ url: "/pages/register/register" });
  }
});
