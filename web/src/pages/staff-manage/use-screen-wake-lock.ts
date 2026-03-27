import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = {
  release?: () => Promise<void> | void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

/**
 * staff 管理页需要尽量保持屏幕常亮，避免动态码展示时自动锁屏。
 *
 * 这个 hook 只负责：
 * 1. 申请和释放浏览器 wake lock
 * 2. 翻译兼容性提示文案
 * 3. 把“页面生命周期”和“业务刷新”解耦
 */
export function useScreenWakeLock() {
  const [wakeLockMessage, setWakeLockMessage] = useState("");
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const releaseWakeLock = useCallback(async () => {
    const currentWakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (!currentWakeLock?.release) {
      return;
    }

    try {
      await currentWakeLock.release();
    } catch {
      return;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    const wakeLock = (navigator as WakeLockNavigator | undefined)?.wakeLock;
    if (!wakeLock || typeof wakeLock.request !== "function") {
      setWakeLockMessage("当前浏览器不支持自动保持屏幕常亮，请手动关闭自动锁屏或保持屏幕常亮。");
      return;
    }

    try {
      wakeLockRef.current = await wakeLock.request("screen");
      setWakeLockMessage("");
    } catch {
      setWakeLockMessage("无法自动保持屏幕常亮，请手动关闭自动锁屏或保持屏幕常亮。");
    }
  }, []);

  useEffect(() => {
    void requestWakeLock();

    return () => {
      void releaseWakeLock();
    };
  }, [releaseWakeLock, requestWakeLock]);

  return {
    requestWakeLock,
    wakeLockMessage
  };
}
