const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");

const DEFAULT_ROTATE_SECONDS = 10;
const DEFAULT_GRACE_SECONDS = 20;
const DETAIL_POLL_INTERVAL = 3000;

const formatDateTime = (input) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const parseWindowSeconds = (value, fallbackValue) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return Math.floor(parsed);
};

const parseActionType = (value) => {
  return value === "checkout" ? "checkout" : "checkin";
};

const decodeTitle = (value) => {
  if (!value) {
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return `${value}`;
  }
};

Page({
  data: {
    isOnline: true,
    sessionToken: "",
    role: "normal",
    activityId: "",
    activityTitle: "",
    actionType: "checkin",
    actionLabel: "签到",
    loading: true,
    refreshing: false,
    qrStatus: "loading",
    qrPayload: "",
    qrImageUrl: "",
    qrFallbackPath: "",
    sessionId: "",
    rotateSeconds: DEFAULT_ROTATE_SECONDS,
    graceSeconds: DEFAULT_GRACE_SECONDS,
    displayExpireAt: 0,
    acceptExpireAt: 0,
    displayRemainingSeconds: 0,
    acceptRemainingSeconds: 0,
    serverOffsetMs: 0,
    lastGeneratedAt: "",
    checkinCount: 0,
    checkoutCount: 0
  },
  onLoad(options) {
    this.bindNetwork();
    const actionType = parseActionType(options && options.actionType);
    const actionLabel = actionType === "checkout" ? "签退" : "签到";
    const activityTitle = decodeTitle(options && options.title);
    const activityId = (options && options.id) || "";
    this.setData({
      actionType,
      actionLabel,
      activityTitle,
      activityId
    });
    wx.setNavigationBarTitle({
      title: `${actionLabel}二维码`
    });
    if (!activityId) {
      ui.showToast("活动信息缺失");
      this.goBack();
      return;
    }
    this.init();
  },
  onShow() {
    if (this.data.sessionId) {
      this.syncCountdown();
    }
  },
  onUnload() {
    this.clearTimers();
    if (this.unsubNetwork) {
      this.unsubNetwork();
    }
  },
  bindNetwork() {
    const app = getApp();
    this.setData({ isOnline: app.globalData.isOnline });
    this.unsubNetwork = app.onNetworkChange((res) => {
      this.setData({ isOnline: res.isOnline });
      if (res.isOnline && this.data.role === "staff" && this.data.activityId && !this.data.sessionId) {
        this.refreshQrSession();
      }
    });
  },
  async init() {
    const sessionToken = await auth.ensureSession();
    const role = storage.getRole();
    this.setData({
      sessionToken,
      role
    });
    if (role !== "staff") {
      ui.showToast("仅工作人员可展示二维码");
      this.goBack();
      return;
    }
    await this.loadActivitySnapshot();
    await this.refreshQrSession();
    this.startTimers();
  },
  startTimers() {
    this.clearTimers();
    this.countdownTimer = setInterval(() => {
      this.syncCountdown();
    }, 1000);
    this.detailPollTimer = setInterval(() => {
      this.loadActivitySnapshot();
    }, DETAIL_POLL_INTERVAL);
  },
  clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.detailPollTimer) {
      clearInterval(this.detailPollTimer);
      this.detailPollTimer = null;
    }
  },
  syncCountdown() {
    if (!this.data.displayExpireAt || !this.data.acceptExpireAt) {
      return;
    }
    const now = Date.now() + (this.data.serverOffsetMs || 0);
    const displayRemainingSeconds = Math.max(0, Math.ceil((this.data.displayExpireAt - now) / 1000));
    const acceptRemainingSeconds = Math.max(0, Math.ceil((this.data.acceptExpireAt - now) / 1000));
    this.setData({
      displayRemainingSeconds,
      acceptRemainingSeconds
    });
    if (displayRemainingSeconds <= 1 && this.data.role === "staff" && !this.data.refreshing) {
      this.refreshQrSession({ auto: true });
      return;
    }
    if (acceptRemainingSeconds <= 0 && !this.data.refreshing) {
      this.setData({ qrStatus: "expired" });
    }
  },
  async refreshQrSession(options = {}) {
    const auto = !!options.auto;
    if (this.data.refreshing || !this.data.activityId || !this.data.sessionToken) {
      return;
    }
    if (!this.data.isOnline) {
      if (!auto) {
        ui.showToast("当前无网络");
      }
      return;
    }

    const shouldShowLoadingMask = !this.data.sessionId;
    this.setData({
      refreshing: true,
      loading: shouldShowLoadingMask,
      qrStatus: shouldShowLoadingMask ? "loading" : this.data.qrStatus
    });

    try {
      const result = await api.createStaffQrSession({
        sessionToken: this.data.sessionToken,
        activityId: this.data.activityId,
        actionType: this.data.actionType,
        rotateSeconds: DEFAULT_ROTATE_SECONDS,
        graceSeconds: DEFAULT_GRACE_SECONDS
      });
      if (!result || result.status !== "success") {
        if (!auto) {
          ui.showToast((result && result.message) || "二维码生成失败");
        }
        this.setData({
          loading: false,
          qrStatus: this.data.sessionId ? "active" : "expired"
        });
        return;
      }
      const serverTime = Number(result.server_time || Date.now());
      const serverOffsetMs = serverTime - Date.now();
      const displayExpireAt = Number(result.display_expire_at || (serverTime + DEFAULT_ROTATE_SECONDS * 1000));
      const acceptExpireAt = Number(result.accept_expire_at || (displayExpireAt + DEFAULT_GRACE_SECONDS * 1000));
      const rotateSeconds = parseWindowSeconds(result.rotate_seconds, DEFAULT_ROTATE_SECONDS);
      const graceSeconds = parseWindowSeconds(result.grace_seconds, DEFAULT_GRACE_SECONDS);
      const qrPayload = result.qr_payload || result.qr_scene || result.qr_fallback_path || "";
      const now = Date.now() + serverOffsetMs;
      this.setData({
        loading: false,
        qrStatus: "active",
        qrPayload,
        qrImageUrl: result.qr_image_url || "",
        qrFallbackPath: result.qr_fallback_path || "",
        sessionId: result.session_id || "",
        rotateSeconds,
        graceSeconds,
        displayExpireAt,
        acceptExpireAt,
        serverOffsetMs,
        displayRemainingSeconds: Math.max(0, Math.ceil((displayExpireAt - now) / 1000)),
        acceptRemainingSeconds: Math.max(0, Math.ceil((acceptExpireAt - now) / 1000)),
        lastGeneratedAt: formatDateTime(serverTime)
      });
    } catch (err) {
      if (!auto) {
        ui.showToast("二维码生成失败");
      }
      this.setData({
        loading: false,
        qrStatus: this.data.sessionId ? "active" : "expired"
      });
    } finally {
      this.setData({ refreshing: false });
    }
  },
  async loadActivitySnapshot() {
    if (this.activityLoading || !this.data.activityId || !this.data.sessionToken || !this.data.isOnline) {
      return;
    }
    this.activityLoading = true;
    try {
      const detail = await api.getStaffActivityDetail(this.data.activityId, this.data.sessionToken);
      if (!detail || detail.status === "invalid_activity" || detail.status === "forbidden") {
        if (!this.detailInvalidShown) {
          ui.showToast((detail && detail.message) || "活动不可用");
          this.detailInvalidShown = true;
        }
        this.clearTimers();
        this.setData({ qrStatus: "expired" });
        return;
      }

      const isCompleted = `${detail.progress_status || ""}`.toLowerCase() === "completed";
      this.setData({
        activityTitle: this.data.activityTitle || detail.activity_title || "",
        checkinCount: Number(detail.checkin_count || 0),
        checkoutCount: Number(detail.checkout_count || 0)
      });
      if (isCompleted) {
        this.clearTimers();
        this.setData({ qrStatus: "expired" });
      }
    } catch (err) {
      // ignore polling error, wait next poll cycle
    } finally {
      this.activityLoading = false;
    }
  },
  onTapRefresh() {
    this.refreshQrSession();
  },
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: "/pages/index/index" });
  }
});
