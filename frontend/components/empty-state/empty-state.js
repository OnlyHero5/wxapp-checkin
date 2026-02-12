Component({
  properties: {
    title: {
      type: String,
      value: "暂无数据"
    },
    message: {
      type: String,
      value: ""
    },
    actionText: {
      type: String,
      value: "重试"
    },
    showAction: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    onTapAction() {
      this.triggerEvent("retry");
    }
  }
});
