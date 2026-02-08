const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

const formatDateTime = (input) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const parseSceneFromText = (text) => {
  const value = `${text || ""}`.trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("s.")) {
    return value;
  }
  const match = value.match(/[?&]scene=([^&]+)/);
  if (!match || !match[1]) {
    return "";
  }
  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.startsWith("s.") ? decoded : "";
  } catch (err) {
    return "";
  }
};

const extractPayloadFromScanResult = (scanResult) => {
  const path = `${(scanResult && scanResult.path) || ""}`.trim();
  const rawResult = `${(scanResult && scanResult.result) || ""}`.trim();

  const sceneFromPath = parseSceneFromText(path);
  if (sceneFromPath) {
    return sceneFromPath;
  }
  const sceneFromResult = parseSceneFromText(rawResult);
  if (sceneFromResult) {
    return sceneFromResult;
  }
  if (rawResult) {
    return rawResult;
  }
  if (path) {
    return path;
  }
  return "";
};

const mapResultTitle = (status) => {
  if (status === "success") {
    return "提交成功";
  }
  if (status === "duplicate") {
    return "重复提交";
  }
  if (status === "expired" || status === "invalid_qr") {
    return "二维码失效";
  }
  if (status === "forbidden") {
    return "提交被拒绝";
  }
  return "提交失败";
};

const mapResultTagTheme = (status) => {
  if (status === "success") {
    return "success";
  }
  if (status === "duplicate") {
    return "warning";
  }
  return "danger";
};

const mapResultLabel = (status) => {
  if (status === "success") {
    return "成功";
  }
  if (status === "duplicate") {
    return "重复";
  }
  if (status === "expired" || status === "invalid_qr") {
    return "失效";
  }
  if (status === "forbidden") {
    return "拒绝";
  }
  return "失败";
};

const scanByCamera = () => {
  return new Promise((resolve, reject) => {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ["qrCode"],
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
};

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    role: "normal",
    bound: false,
    submitting: false,
    pendingScenePayload: "",
    lastResult: null
  },
  onLoad(options) {
    this.bindNetwork();
    const pendingScenePayload = `${(options && options.scene) || ""}`.trim();
    this.setData({
      pendingScenePayload
    });
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
    const role = storage.getRole();
    const bound = storage.isBound();
    this.setData({
      sessionToken,
      role,
      bound
    });

    if (!bound) {
      ui.showToast("请先完成身份绑定");
      wx.navigateTo({ url: "/pages/register/register" });
      return;
    }

    if (role !== "normal") {
      return;
    }

    const pendingScene = parseSceneFromText(this.data.pendingScenePayload);
    if (pendingScene) {
      this.consumePayload(pendingScene, {
        scanType: "WX_CODE",
        rawResult: pendingScene,
        path: this.data.pendingScenePayload
      });
    }
  },
  async onTapScan() {
    if (this.data.submitting) {
      return;
    }
    if (!this.data.isOnline) {
      ui.showToast("当前无网络");
      return;
    }
    if (!this.data.bound) {
      ui.showToast("请先完成身份绑定");
      wx.navigateTo({ url: "/pages/register/register" });
      return;
    }
    if (this.data.role !== "normal") {
      ui.showToast("仅普通用户可扫码提交");
      return;
    }

    let scanResult;
    this.setData({ submitting: true });
    try {
      scanResult = await scanByCamera();
    } catch (err) {
      if (!err || !err.errMsg || !err.errMsg.includes("cancel")) {
        ui.showToast("扫码失败，请重试");
      }
      this.setData({ submitting: false });
      return;
    }

    const qrPayload = extractPayloadFromScanResult(scanResult);
    if (!qrPayload) {
      ui.showToast("二维码内容无法识别");
      this.setData({ submitting: false });
      return;
    }

    await this.consumePayload(qrPayload, {
      scanType: scanResult.scanType || "",
      rawResult: scanResult.result || "",
      path: scanResult.path || ""
    });
  },
  async consumePayload(qrPayload, scanMeta = {}) {
    if (!qrPayload) {
      this.setData({ submitting: false });
      return;
    }
    this.setData({ submitting: true });
    try {
      const result = await api.consumeCheckinAction({
        sessionToken: this.data.sessionToken,
        qrPayload,
        scanType: scanMeta.scanType || "",
        rawResult: scanMeta.rawResult || "",
        path: scanMeta.path || ""
      });

      if (result && result.status === "success") {
        ui.showToast(result.message || "操作成功", "success");
      } else {
        ui.showToast((result && result.message) || "提交失败");
      }

      const actionLabel = result && result.action_type === "checkout" ? "签退" : "签到";
      const status = (result && result.status) || "failed";
      this.setData({
        pendingScenePayload: "",
        lastResult: {
          title: mapResultTitle(status),
          status,
          statusLabel: mapResultLabel(status),
          tagTheme: mapResultTagTheme(status),
          message: (result && result.message) || "提交失败",
          actionLabel: result && result.action_type ? actionLabel : "",
          activityTitle: (result && result.activity_title) || "",
          detailHint: result && result.in_grace_window ? "本次提交发生在二维码宽限时间窗口内。" : "",
          checkedAt: formatDateTime(new Date())
        }
      });
    } catch (err) {
      ui.showToast("提交失败，请稍后重试");
      this.setData({
        lastResult: {
          title: "提交失败",
          status: "failed",
          statusLabel: "失败",
          tagTheme: "danger",
          message: "网络异常，请稍后重试",
          actionLabel: "",
          activityTitle: "",
          detailHint: "",
          checkedAt: formatDateTime(new Date())
        }
      });
    }
    this.setData({ submitting: false });
  },
  goActivities() {
    wx.switchTab({ url: "/pages/index/index" });
  }
});
