const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const crypto = require("../../utils/crypto");
const ui = require("../../utils/ui");
const validators = require("../../utils/validators");

Page({
  data: {
    isOnline: true,
    studentId: "",
    name: "",
    department: "",
    club: "",
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
      wxIdentity: storage.getWxIdentity(),
      studentId: storage.getStudentId(),
      name: storage.getName(),
      department: storage.getDepartment(),
      club: storage.getClub()
    });
  },
  async ensureIdentityReady() {
    if (this.data.sessionToken && this.data.wxIdentity) {
      return true;
    }

    const forceRefresh = !this.data.sessionToken || !this.data.wxIdentity;
    const sessionToken = await auth.ensureSession({
      forceRefresh,
      silent: true
    });
    const wxIdentity = storage.getWxIdentity();

    this.setData({
      sessionToken,
      wxIdentity
    });

    return !!sessionToken && !!wxIdentity;
  },
  onInputStudent(e) {
    const value = (e.detail && e.detail.value) ? e.detail.value : "";
    this.setData({ studentId: value.trim() });
  },
  onInputName(e) {
    const value = (e.detail && e.detail.value) ? e.detail.value : "";
    this.setData({ name: value.trim() });
  },
  onInputDepartment(e) {
    const value = (e.detail && e.detail.value) ? e.detail.value : "";
    this.setData({ department: value.trim() });
  },
  onInputClub(e) {
    const value = (e.detail && e.detail.value) ? e.detail.value : "";
    this.setData({ club: value.trim() });
  },
  async onSubmit() {
    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }

    const validation = validators.validateRegisterForm({
      studentId: this.data.studentId,
      name: this.data.name,
      department: this.data.department,
      club: this.data.club
    });
    if (!validation.ok) {
      ui.showToast(validation.firstError || "输入信息不合法");
      return;
    }

    const studentId = validation.normalized.studentId;
    const name = validation.normalized.name;
    const department = validation.normalized.department;
    const club = validation.normalized.club;
    this.setData({
      studentId,
      name,
      department,
      club
    });

    const identityReady = await this.ensureIdentityReady();
    if (!identityReady) {
      ui.showToast("登录态未建立，请确认后端已启动并可访问");
      return;
    }

    this.setData({ submitting: true });
    const payload = {
      wx_identity: this.data.wxIdentity,
      student_id: studentId,
      name,
      department,
      club,
      timestamp: Date.now()
    };
    const encrypted = crypto.encryptPayload(payload, this.data.sessionToken);

    try {
      const result = await api.register({
        sessionToken: this.data.sessionToken,
        studentId,
        name,
        department,
        club,
        payloadEncrypted: encrypted
      });
      if (result && result.status === "success") {
        const profile = result.user_profile || {};
        const role = `${result.role || storage.getRole() || "normal"}`.trim() === "staff" ? "staff" : "normal";
        const permissions = Array.isArray(result.permissions) ? result.permissions : [];
        storage.setStudentId(profile.student_id || studentId);
        storage.setName(profile.name || name);
        storage.setDepartment(profile.department || department);
        storage.setClub(profile.club || club);
        storage.setRole(role || "normal");
        storage.setPermissions(permissions);
        storage.setBound(true);
        ui.showToast("绑定成功", "success");
        if (role === "staff") {
          wx.switchTab({ url: "/pages/index/index" });
        } else {
          wx.switchTab({ url: "/pages/profile/profile" });
        }
      } else {
        ui.showToast((result && result.message) || "绑定失败");
      }
    } catch (err) {
      const backendMessage = (err && err.data && err.data.message) || (err && err.message) || "";
      ui.showToast(backendMessage || "绑定失败，请重试");
    }

    this.setData({ submitting: false });
  }
});
