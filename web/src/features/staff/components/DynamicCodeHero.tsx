import { CountDown, Skeleton, Tag } from "tdesign-mobile-react";
import type { ReactNode } from "react";
import type { ActivityActionType } from "../../activities/api";

export type DynamicCodeHeroProps = {
  actionLabel: string;
  actionType: ActivityActionType;
  countdownTimeMs: number;
  codeText: string;
  loadingMetaText?: string;
  onCountdownFinish: () => void;
  showSkeleton: boolean;
};

function resolveActionTagTheme(actionType: ActivityActionType) {
  return actionType === "checkout" ? "warning" : "success";
}

type CountdownDisplayTimeData = {
  milliseconds: number;
  seconds: number;
};

export function resolveCountdownDisplaySeconds(timeData?: CountdownDisplayTimeData) {
  if (!timeData) {
    return "00";
  }

  /**
   * 视觉层必须按“向上取整秒数”展示：
   * - 剩 600ms 时仍然显示 `01`，避免用户误以为已经归零；
   * - 真正到 0 才显示 `00`，和自动刷新时机保持一致；
   * - 这里只负责显示，不改 CountDown 内部的真实结束时间。
   */
  const totalMs = Math.max(0, (timeData.seconds * 1000) + timeData.milliseconds);
  const displaySeconds = totalMs <= 0 ? 0 : Math.ceil(totalMs / 1000);
  return `${displaySeconds}`.padStart(2, "0");
}

export function DynamicCodeHero({
  actionLabel,
  actionType,
  countdownTimeMs,
  codeText,
  loadingMetaText,
  onCountdownFinish,
  showSkeleton
}: DynamicCodeHeroProps) {
  const countdownContent = ((timeData: CountdownDisplayTimeData) => {
    return resolveCountdownDisplaySeconds(timeData);
  }) as unknown as (() => ReactNode);

  /**
   * 动态码大字展示是组件库没有直接提供的展示型能力。
   *
   * 这里保留最小必要的自定义结构：
   * - 码值本体、骨架屏和倒计时文案；
   * - 标签、倒计时组件本身仍然使用 TDesign；
   * - 不再额外套一层项目级 surface 组件。
   */
  return (
    <section className="staff-code-panel__card staff-code-hero">
      {/* 这里不再使用 Badge ribbon：
       * 1. 截图已证明 ribbon 方案存在错图/错位风险；
       * 2. 当前需求真正需要的是“标题条 + 大号动态码”的双层结构；
       * 3. 标签仍继续复用组件库 Tag，而不是退回纯手写装饰。 */}
      <header className="staff-code-hero__header">
        <div className="staff-code-hero__title-block">
          <p className="staff-code-hero__eyebrow">动态验证码</p>
          <h2 className="staff-code-hero__title">{actionLabel}</h2>
        </div>
        <Tag
          className={`staff-code-hero__tag staff-code-hero__tag--${actionType}`}
          shape="round"
          theme={resolveActionTagTheme(actionType)}
          variant="light"
        >
          {actionType === "checkout" ? "签退" : "签到"}
        </Tag>
      </header>
      <section className="staff-code-panel__body">
        <span className="staff-code-panel__value-shell">
          <span className="staff-code-panel__value">{codeText}</span>
          {showSkeleton ? (
            <Skeleton
              animation="gradient"
              className="staff-code-panel__value-skeleton"
              rowCol={[
                [
                  {
                    height: "3.6rem",
                    margin: "0 auto",
                    type: "text",
                    width: "12rem"
                  }
                ],
                [
                  {
                    height: "1rem",
                    margin: "0.75rem auto 0",
                    type: "text",
                    width: "7rem"
                  }
                ]
              ]}
            />
          ) : null}
        </span>
        <div className="staff-code-panel__meta">
          {showSkeleton || loadingMetaText ? (
            loadingMetaText
          ) : (
            <>
              <span>剩余时间</span>
              <span className="staff-code-panel__countdown">
                <CountDown
                  content={countdownContent}
                  key={`${actionType}:${countdownTimeMs}`}
                  millisecond
                  onFinish={onCountdownFinish}
                  time={countdownTimeMs}
                />
              </span>
            </>
          )}
        </div>
      </section>
    </section>
  );
}
