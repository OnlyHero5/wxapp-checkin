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

const parseTimestamp = (value, fallbackValue) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
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
    actionBlocked: false,
    loading: true,
    refreshing: false,
    qrStatus: "loading",
    qrPayload: "",
    rotateSeconds: DEFAULT_ROTATE_SECONDS,
    graceSeconds: DEFAULT_GRACE_SECONDS,
    currentSlot: -1,
    displayExpireAt: 0,
    acceptExpireAt: 0,
    displayRemainingSeconds: 0,
    acceptRemainingSeconds: 0,
    serverOffsetMs: 0,
    lastGeneratedAt: "",
    checkinCount: 0,
    checkoutCount: 0,
    activityCompleted: false,
    qrSize: 200
  },
  onLoad(options) {
    this.bindNetwork();
    // Compute QR pixel size to fill .qr-box (520rpx width, 20rpx padding each side = 480rpx content)
    try {
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const screenWidth = sysInfo.windowWidth || 375;
      const qrSize = Math.floor((480 / 750) * screenWidth);
      this.setData({ qrSize });
    } catch (e) {
      this.setData({ qrSize: 240 });
    }
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
    this.syncCountdown();
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
      if (res.isOnline && this.data.role === "staff" && this.data.activityId) {
        this.loadQrSession({ silent: true });
        this.loadActivitySnapshot();
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
    await this.loadQrSession();
    this.startTimers();
    this.setData({ loading: false });
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
  getServerNow() {
    return Date.now() + (this.data.serverOffsetMs || 0);
  },
  syncCountdown() {
    if (this.data.activityCompleted || !this.data.qrPayload) {
      return;
    }

    const now = this.getServerNow();
    const displayRemainingSeconds = Math.max(0, Math.ceil((this.data.displayExpireAt - now) / 1000));
    const acceptRemainingSeconds = Math.max(0, Math.ceil((this.data.acceptExpireAt - now) / 1000));
    this.setData({
      displayRemainingSeconds,
      acceptRemainingSeconds
    });

    if (displayRemainingSeconds <= 0 && !this.data.refreshing && !this.data.actionBlocked) {
      this.loadQrSession({ silent: true, autoRotate: true });
    }
  },
  async loadQrSession(options = {}) {
    if (this.data.activityCompleted || this.data.role !== "staff") {
      return;
    }
    if (!this.data.isOnline || !this.data.sessionToken || !this.data.activityId) {
      if (!options.silent) {
        ui.showToast("当前无网络，二维码暂不可更新");
      }
      return;
    }
    if (this.data.refreshing) {
      return;
    }

    this.setData({ refreshing: true });
    try {
      const result = await api.createStaffQrSession({
        sessionToken: this.data.sessionToken,
        activityId: this.data.activityId,
        actionType: this.data.actionType
      });
      if (!result || result.status !== "success") {
        const errorCode = `${(result && (result.error_code || result.code)) || ""}`.trim().toLowerCase();
        const isOutsideTimeWindow = errorCode === "outside_activity_time_window";
        if (!options.silent) {
          ui.showToast((result && result.message) || "二维码加载失败");
        }
        if (isOutsideTimeWindow) {
          this.setData({
            qrStatus: "expired",
            qrPayload: "",
            displayExpireAt: 0,
            acceptExpireAt: 0,
            displayRemainingSeconds: 0,
            acceptRemainingSeconds: 0
          });
        } else if (result && result.status === "forbidden") {
          this.setData({
            actionBlocked: true,
            qrStatus: "expired"
          });
          this.clearTimers();
        }
        return;
      }

      const serverTime = parseTimestamp(result.server_time, Date.now());
      const rotateSeconds = parseWindowSeconds(result.rotate_seconds, DEFAULT_ROTATE_SECONDS);
      const graceSeconds = parseWindowSeconds(result.grace_seconds, DEFAULT_GRACE_SECONDS);
      const qrPayload = `${result.qr_payload || ""}`.trim();
      const displayExpireAt = parseTimestamp(result.display_expire_at, serverTime + rotateSeconds * 1000);
      const acceptExpireAt = parseTimestamp(result.accept_expire_at, displayExpireAt + graceSeconds * 1000);
      if (!qrPayload) {
        if (!options.silent) {
          ui.showToast("二维码数据缺失，请重试");
        }
        this.setData({ qrStatus: "expired" });
        return;
      }

      const now = Date.now();
      this.setData({
        qrStatus: "active",
        qrPayload,
        currentSlot: Number(result.slot || -1),
        rotateSeconds,
        graceSeconds,
        displayExpireAt,
        acceptExpireAt,
        serverOffsetMs: serverTime - now,
        displayRemainingSeconds: Math.max(0, Math.ceil((displayExpireAt - (now + (serverTime - now))) / 1000)),
        acceptRemainingSeconds: Math.max(0, Math.ceil((acceptExpireAt - (now + (serverTime - now))) / 1000)),
        lastGeneratedAt: formatDateTime(serverTime)
      });
      this.syncCountdown();
    } catch (err) {
      if (!options.silent) {
        ui.showToast("二维码加载失败");
      }
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
      const result = await api.getStaffActivityDetail(this.data.activityId, this.data.sessionToken);
      if (!result || result.status === "invalid_activity" || result.status === "forbidden") {
        if (!this.detailInvalidShown) {
          ui.showToast((result && result.message) || "活动不可用");
          this.detailInvalidShown = true;
        }
        this.clearTimers();
        this.setData({ activityCompleted: true, qrStatus: "expired" });
        return;
      }

      // Backend wraps detail fields inside result.data
      const detail = result.data || result;

      const isCompleted = `${detail.progress_status || ""}`.toLowerCase() === "completed";
      const isUnsupportedCheckout = this.data.actionType === "checkout" && !detail.support_checkout;
      const serverTime = Number(detail.server_time || Date.now());
      this.setData({
        activityTitle: this.data.activityTitle || detail.activity_title || "",
        checkinCount: Number(detail.checkin_count || 0),
        checkoutCount: Number(detail.checkout_count || 0),
        rotateSeconds: parseWindowSeconds(detail.rotate_seconds, this.data.rotateSeconds),
        graceSeconds: parseWindowSeconds(detail.grace_seconds, this.data.graceSeconds),
        serverOffsetMs: serverTime - Date.now()
      });
      if (isCompleted || isUnsupportedCheckout) {
        this.clearTimers();
        this.setData({
          activityCompleted: true,
          actionBlocked: isUnsupportedCheckout,
          qrStatus: "expired"
        });
        if (isUnsupportedCheckout && !this.unsupportedCheckoutShown) {
          ui.showToast("该活动暂不支持签退二维码");
          this.unsupportedCheckoutShown = true;
        }
      }
    } catch (err) {
      // wait next poll cycle
    } finally {
      this.activityLoading = false;
    }
  },
  async onTapRefresh() {
    if (this.data.activityCompleted) {
      ui.showToast("活动已结束");
      return;
    }
    if (this.data.actionBlocked) {
      ui.showToast("当前动作不可用");
      return;
    }
    await this.loadQrSession();
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
