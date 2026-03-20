/**
 * 共享视觉 tone 只表达“当前页面/组件属于哪类业务语境”，
 * 不在这里混入按钮主次、错误成功等语义层。
 *
 * 这样后续页面只需要声明 tone，
 * 共享层就能按统一规则决定页头、按钮和摘要区怎么着色。
 */
export type VisualTone = "brand" | "default" | "checkin" | "checkout" | "staff";
