const auth = require("../../utils/auth");
const api = require("../../utils/api");
const storage = require("../../utils/storage");
const ui = require("../../utils/ui");
const qrPayload = require("../../utils/qr-payload");

const DEFAULT_ROTATE_SECONDS = qrPayload.DEFAULT_ROTATE_SECONDS;
const DEFAULT_GRACE_SECONDS = qrPayload.DEFAULT_GRACE_SECONDS;
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

const randomNonce = () => {
  return Math.random().toString(36).slice(2, 8);
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
        this.loadQrConfig({ silent: true });
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
    await this.loadQrConfig();
    this.generateLocalPayload({ force: true });
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
  generateLocalPayload(options = {}) {
    if (this.activityCompleted || this.data.actionBlocked || this.data.role !== "staff" || !this.data.activityId) {
      return;
    }

    const now = this.getServerNow();
    const targetSlot = Number.isInteger(options.slot)
      ? options.slot
      : qrPayload.getCurrentSlot(now, this.data.rotateSeconds);
    if (!options.force && targetSlot === this.data.currentSlot) {
      return;
    }

    const payload = qrPayload.buildQrPayload({
      activityId: this.data.activityId,
      actionType: this.data.actionType,
      slot: targetSlot,
      nonce: randomNonce()
    });
    if (!payload) {
      this.setData({ qrStatus: "expired" });
      return;
    }

    const slotState = qrPayload.resolveSlotState({
      slot: targetSlot,
      nowMs: now,
      rotateSeconds: this.data.rotateSeconds,
      graceSeconds: this.data.graceSeconds
    });
    this.setData({
      qrStatus: "active",
      qrPayload: payload,
      currentSlot: targetSlot,
      displayExpireAt: slotState.display_expire_at,
      acceptExpireAt: slotState.accept_expire_at,
      displayRemainingSeconds: slotState.display_remaining_seconds,
      acceptRemainingSeconds: slotState.accept_remaining_seconds,
      lastGeneratedAt: formatDateTime(now)
    });
  },
  syncCountdown() {
    if (this.activityCompleted || this.data.currentSlot < 0) {
      return;
    }

    const now = this.getServerNow();
    const currentSlot = qrPayload.getCurrentSlot(now, this.data.rotateSeconds);
    if (currentSlot !== this.data.currentSlot) {
      this.generateLocalPayload({ slot: currentSlot, force: true });
      return;
    }

    const slotState = qrPayload.resolveSlotState({
      slot: this.data.currentSlot,
      nowMs: now,
      rotateSeconds: this.data.rotateSeconds,
      graceSeconds: this.data.graceSeconds
    });
    this.setData({
      displayRemainingSeconds: slotState.display_remaining_seconds,
      acceptRemainingSeconds: slotState.accept_remaining_seconds
    });
  },
  async loadQrConfig(options = {}) {
    if (this.activityCompleted || this.data.role !== "staff") {
      return;
    }
    if (!this.data.isOnline || !this.data.sessionToken || !this.data.activityId) {
      if (!options.silent) {
        ui.showToast("当前无网络，已切换本地换码");
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
        actionType: this.data.actionType,
        rotateSeconds: this.data.rotateSeconds,
        graceSeconds: this.data.graceSeconds
      });
      if (!result || result.status !== "success") {
        if (!options.silent) {
          ui.showToast((result && result.message) || "二维码配置加载失败");
        }
        if (result && result.status === "forbidden") {
          this.setData({
            actionBlocked: true,
            qrStatus: "expired"
          });
          this.clearTimers();
        }
        return;
      }

      const serverTime = Number(result.server_time || Date.now());
      const rotateSeconds = parseWindowSeconds(result.rotate_seconds, DEFAULT_ROTATE_SECONDS);
      const graceSeconds = parseWindowSeconds(result.grace_seconds, DEFAULT_GRACE_SECONDS);
      this.setData({
        rotateSeconds,
        graceSeconds,
        serverOffsetMs: serverTime - Date.now()
      });
    } catch (err) {
      if (!options.silent) {
        ui.showToast("二维码配置加载失败");
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
      const detail = await api.getStaffActivityDetail(this.data.activityId, this.data.sessionToken);
      if (!detail || detail.status === "invalid_activity" || detail.status === "forbidden") {
        if (!this.detailInvalidShown) {
          ui.showToast((detail && detail.message) || "活动不可用");
          this.detailInvalidShown = true;
        }
        this.activityCompleted = true;
        this.clearTimers();
        this.setData({ qrStatus: "expired" });
        return;
      }

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
        this.activityCompleted = true;
        this.clearTimers();
        this.setData({
          actionBlocked: isUnsupportedCheckout,
          qrStatus: "expired"
        });
        if (isUnsupportedCheckout && !this.unsupportedCheckoutShown) {
          ui.showToast("该活动暂不支持签退二维码");
          this.unsupportedCheckoutShown = true;
        }
        return;
      }

      if (!this.data.qrPayload || this.data.currentSlot < 0) {
        this.generateLocalPayload({ force: true });
      }
    } catch (err) {
      // wait next poll cycle
    } finally {
      this.activityLoading = false;
    }
  },
  async onTapRefresh() {
    if (this.activityCompleted) {
      ui.showToast("活动已结束");
      return;
    }
    if (this.data.actionBlocked) {
      ui.showToast("当前动作不可用");
      return;
    }
    await this.loadQrConfig();
    this.generateLocalPayload({ force: true });
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
