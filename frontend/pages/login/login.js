const auth = require("../../utils/auth");
const LOGIN_SUCCESS_TARGET = "/pages/index/index";

Page({
  data: {
    loading: true,
    submitting: false,
    errorMessage: ""
  },
  onLoad() {
    this.relogin();
  },
  async relogin() {
    if (this.data.submitting) {
      return;
    }
    this.setData({
      loading: true,
      submitting: true,
      errorMessage: ""
    });

    const token = await auth.ensureSession({
      forceRefresh: true,
      silent: true
    });

    if (!token) {
      this.setData({
        loading: false,
        submitting: false,
        errorMessage: "登录失败，请重试"
      });
      return;
    }

    wx.switchTab({
      url: LOGIN_SUCCESS_TARGET,
      fail: () => {
        this.setData({
          loading: false,
          submitting: false,
          errorMessage: "页面跳转失败，请重试"
        });
      }
    });
  },
  onTapRetry() {
    this.relogin();
  }
});
