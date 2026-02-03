App({
  globalData: {
    sessionToken: '',
    wxIdentity: '',
    isOnline: true,
    networkType: 'unknown'
  },
  onLaunch() {
    this._networkListeners = [];
    wx.getNetworkType({
      success: (res) => {
        this.globalData.isOnline = res.networkType !== 'none';
        this.globalData.networkType = res.networkType || 'unknown';
      }
    });
    wx.onNetworkStatusChange((res) => {
      this.globalData.isOnline = !!res.isConnected;
      this.globalData.networkType = res.networkType || 'unknown';
      this._networkListeners.forEach((fn) => {
        if (typeof fn === 'function') {
          fn({ isOnline: this.globalData.isOnline, networkType: this.globalData.networkType });
        }
      });
    });
  },
  onNetworkChange(listener) {
    this._networkListeners.push(listener);
    return () => {
      this._networkListeners = this._networkListeners.filter((item) => item !== listener);
    };
  }
});
