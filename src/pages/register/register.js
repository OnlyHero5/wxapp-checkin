const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const crypto = require("../../utils/crypto");
const ui = require("../../utils/ui");

Page({
  data: {
    isOnline: true,
    studentId: "",
    name: "",
    wxIdentity: "",
    sessionToken: "",
    submitting: false
  },
  onLoad() {
    this.bindNetwork();
    this.init();
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
      wxIdentity: storage.getWxIdentity()
    });
  },
  onInputStudent(e) {
    this.setData({ studentId: e.detail.value.trim() });
  },
  onInputName(e) {
    this.setData({ name: e.detail.value.trim() });
  },
  async onSubmit() {
    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }
    const studentId = this.data.studentId;
    const name = this.data.name;
    if (!studentId || !name) {
      ui.showToast("请填写学号与姓名");
      return;
    }
    if (!this.data.sessionToken) {
      ui.showToast("身份获取失败，请重试");
      return;
    }

    this.setData({ submitting: true });
    const payload = {
      wx_identity: this.data.wxIdentity,
      student_id: studentId,
      name,
      timestamp: Date.now()
    };
    const encrypted = crypto.encryptPayload(payload);

    try {
      const result = await api.register({
        sessionToken: this.data.sessionToken,
        studentId,
        name,
        payloadEncrypted: encrypted
      });
      if (result && result.status === "success") {
        storage.setStudentId(studentId);
        storage.setName(name);
        storage.setBound(true);
        ui.showToast("绑定成功", "success");
        wx.switchTab({ url: "/pages/index/index" });
      } else {
        ui.showToast(result.message || "绑定失败");
      }
    } catch (err) {
      ui.showToast("绑定失败，请重试");
    }

    this.setData({ submitting: false });
  }
});
