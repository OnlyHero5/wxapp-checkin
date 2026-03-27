import { useEffect, useRef } from "react";
import { Cell, CellGroup, TabPanel, Tabs } from "tdesign-mobile-react";
import type { ActivityActionType } from "../../activities/api";
import type { CodeSessionResponse } from "../api";
import { AppButton } from "../../../shared/ui/AppButton";
import { DynamicCodeHero } from "./DynamicCodeHero";

type DynamicCodePanelProps = {
  activityId: string;
  actionType: ActivityActionType;
  codeSession: CodeSessionResponse | null;
  loading?: boolean;
  onActionChange: (value: ActivityActionType) => void;
  onRefresh: () => void;
};

/**
 * 页面切换签到/签退页签时，`actionType` 会先更新，再等待对应动态码请求返回。
 * 同理，切换活动路由时也会先拿到新的 `activityId`，再等待新活动的动态码返回。
 * hero 区必须同时校验“当前动作 + 当前活动”两层语义，避免把旧活动的码短暂挂到新活动标题下。
 */
function resolveDisplayedCodeSession(
  activityId: string,
  actionType: ActivityActionType,
  codeSession: CodeSessionResponse | null
) {
  if (
    !codeSession ||
    codeSession.action_type !== actionType ||
    codeSession.activity_id !== activityId
  ) {
    return null;
  }

  return codeSession;
}

/**
 * 管理端统计口径：
 * - 后端 `checkin_count` 是“已签到未签退”（仍在场）人数；
 * - 后端 `checkout_count` 是“已签退”人数；
 * - 因此累计签到人数 = checkin_count + checkout_count。
 *
 * 这样展示可以避免“签退后签到人数变成 0”的误解，同时保留一键签退需要的“未签退人数”。
 */
function resolveAttendanceCounts(codeSession: CodeSessionResponse | null) {
  const checkinCount = codeSession?.checkin_count ?? 0;
  const checkoutCount = codeSession?.checkout_count ?? 0;
  return {
    checkinCount,
    checkoutCount,
    totalCheckedIn: checkinCount + checkoutCount
  };
}

function resolveCountdownTimeMs(codeSession: CodeSessionResponse | null) {
  if (!codeSession) {
    return 0;
  }

  const receivedAtMs = Date.now();
  const serverTimeMs = codeSession.server_time_ms ?? receivedAtMs;
  const serverOffsetMs = serverTimeMs - receivedAtMs;
  return Math.max(0, codeSession.expires_at - (Date.now() + serverOffsetMs));
}

/**
 * 动态码面板只负责“当前码长什么样、切哪个动作、剩多久”，
 * 不在这一层直接耦合批量签退或页面级错误处理。
 */
export function DynamicCodePanel({
  activityId,
  actionType,
  codeSession,
  loading = false,
  onActionChange,
  onRefresh
}: DynamicCodePanelProps) {
  const displayedCodeSession = resolveDisplayedCodeSession(activityId, actionType, codeSession);
  const lastAutoRefreshKeyRef = useRef("");
  const onRefreshRef = useRef(onRefresh);
  const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);
  // 动作标签和当前 tab 绑定，确保首屏还没拿到码时也能给管理员稳定的语义提示。
  const actionLabel = actionType === "checkout" ? "当前签退码" : "当前签到码";
  const heroMetaLoading = loading || (!!codeSession && !displayedCodeSession);
  const heroDisplayCode = displayedCodeSession?.code ?? "------";
  const countdownTimeMs = heroMetaLoading ? 0 : resolveCountdownTimeMs(displayedCodeSession);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    /**
     * `CountDown` 现在只负责显示，不直接承担“业务自动刷新”职责。
     *
     * 原因：
     * 1. 到期后重拉新码是页面级业务行为，不能完全依赖组件内部时序；
     * 2. 这样测试和真实页面都能以同一口径在到期后触发刷新；
     * 3. 即使未来替换倒计时展示组件，也不需要重写刷新语义。
     */
    if (!displayedCodeSession || heroMetaLoading) {
      return;
    }

    const refreshKey = `${displayedCodeSession.activity_id}:${displayedCodeSession.action_type}:${displayedCodeSession.expires_at}`;
    const refreshTimer = window.setTimeout(() => {
      if (lastAutoRefreshKeyRef.current === refreshKey) {
        return;
      }
      lastAutoRefreshKeyRef.current = refreshKey;
      onRefreshRef.current();
    }, countdownTimeMs + 50);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [countdownTimeMs, displayedCodeSession, heroMetaLoading]);

  return (
    <section className="staff-panel" data-panel-tone="staff">
      {/* 控制区单独包一层，给展示型壳层稳定的布局挂点，避免依赖 TDesign 内部 DOM。 */}
      <div className="staff-panel__controls" data-display-zone="controls">
        <Tabs onChange={(value) => onActionChange(value as ActivityActionType)} value={actionType}>
          <TabPanel label="签到码" value="checkin" />
          <TabPanel label="签退码" value="checkout" />
        </Tabs>
      </div>
      {/* hero 区只关心“当前码”和倒计时，桌面大屏放大时不混入其它操作信息。 */}
      <div className="staff-code-panel" data-display-zone="hero">
        <DynamicCodeHero
          actionLabel={actionLabel}
          actionType={actionType}
          countdownTimeMs={countdownTimeMs}
          codeText={heroDisplayCode}
          loadingMetaText={heroMetaLoading ? "动态码加载中..." : undefined}
          onCountdownFinish={() => undefined}
          showSkeleton={loading}
        />
      </div>
      {/* 统计区与弱操作区拆开后，桌面态可以把“读数据”和“做刷新”分成不同视觉层级。 */}
      <div className="staff-panel__stats" data-display-zone="stats">
        <CellGroup theme="card" title="实时统计">
          <Cell note={`${totalCheckedIn}`} title="签到人数" />
          <Cell note={`${checkoutCount}`} title="签退人数" />
          <Cell note={`${checkinCount}`} title="未签退人数" />
        </CellGroup>
      </div>
      <div className="staff-panel__actions" data-display-zone="actions">
        <AppButton accentTone="staff" onClick={onRefresh} tone="secondary">
          立即刷新
        </AppButton>
      </div>
    </section>
  );
}
