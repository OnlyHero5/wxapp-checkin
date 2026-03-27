import { Badge, CountDown, Skeleton } from "tdesign-mobile-react";
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

function resolveActionBadgeColor(actionType: ActivityActionType) {
  return actionType === "checkout" ? "rgba(217, 119, 6, 0.92)" : "rgba(15, 159, 140, 0.92)";
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
  return (
    <section className="staff-code-panel__surface">
      <Badge
        className="staff-code-panel__badge"
        color={resolveActionBadgeColor(actionType)}
        count={actionLabel}
        shape="ribbon-left"
        size="large"
      >
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
                <span>剩余时间：</span>
                <span className="staff-code-panel__countdown">
                  <CountDown
                    format="ss"
                    key={`${actionType}:${countdownTimeMs}`}
                    onFinish={onCountdownFinish}
                    splitWithUnit
                    time={countdownTimeMs}
                  />
                </span>
              </>
            )}
          </div>
        </section>
      </Badge>
    </section>
  );
}
