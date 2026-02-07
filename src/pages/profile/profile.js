const auth = require("../../utils/auth");
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
    bound: false
  },
  onLoad() {
    this.bindNetwork();
    this.init();
  },
  onShow() {
    this.refreshProfile();
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
      bound: storage.isBound()
    });
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
