/**
 * 页面前后台切换的最小封装。
 *
 * 目前只暴露“重新回到前台”的订阅，
 * 因为活动详情页、动态码页、签到页真正需要的都是这个时机。
 */
export function subscribePageVisible(onVisible: () => void) {
  const handleVisibilityChange = () => {
    // 只有从 hidden -> visible 时才触发，避免页面切后台时误刷新。
    if (document.visibilityState === "visible") {
      onVisible();
    }
  };
  const handlePageShow = (event: Event) => {
    // bfcache 恢复通常只触发 pageshow，不一定再补 visibilitychange。
    if ((event as PageTransitionEvent).persisted) {
      onVisible();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  return () => {
    // 返回 unsubscribe，方便页面在 unmount 时安全释放监听。
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
  };
}
