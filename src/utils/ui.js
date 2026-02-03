const showToast = (title, icon = "none") => {
  wx.showToast({
    title,
    icon,
    duration: 1800
  });
};

const showModal = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      showCancel: false,
      success: () => resolve()
    });
  });
};

module.exports = {
  showToast,
  showModal
};
