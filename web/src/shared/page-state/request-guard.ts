type RequestGuard = {
  beginRequest: () => number;
  isCurrent: (requestVersion: number) => boolean;
};

/**
 * 多个页面都在做“只认最后一次请求结果”的保护。
 *
 * 这里故意保持成极小的可变对象，而不是上来做复杂 hook：
 * 1. 便于在不同页面状态 hook 里用 `useRef` 持有；
 * 2. 逻辑足够简单，测试也不需要 React 环境；
 * 3. 后续如果某页不再需要它，也不会被共享抽象反向绑住。
 */
export function createRequestGuard(initialVersion = 0): RequestGuard {
  let currentVersion = initialVersion;

  return {
    /**
     * 每发起一次新请求，就推进一个版本号。
     *
     * 调用方拿到这个版本号后，等异步结果回来时再比一次，
     * 就能知道当前结果是不是已经落后。
     */
    beginRequest() {
      currentVersion += 1;
      return currentVersion;
    },
    /**
     * 只有最后一次开始的请求，才允许落回页面状态。
     */
    isCurrent(requestVersion) {
      return currentVersion === requestVersion;
    }
  };
}
