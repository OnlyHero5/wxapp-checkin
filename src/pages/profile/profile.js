const storage = require("../../utils/storage");

Page({
  data: {
    name: "",
    studentId: "",
    bound: false
  },
  onShow() {
    this.setData({
      name: storage.getName(),
      studentId: storage.getStudentId(),
      bound: storage.isBound()
    });
  },
  onAction() {
    wx.navigateTo({ url: "/pages/register/register" });
  }
});
