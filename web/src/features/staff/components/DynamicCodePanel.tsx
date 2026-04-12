import { useCallback, useEffect, useRef } from "react";
import { TabPanel, Tabs } from "tdesign-mobile-react";
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
  if (!codeSession) {
    /**
     * 当动态码会话被主动掩掉或尚未可用时，
     * 这里必须明确展示“不可用”，不能伪造 0/0/0 这种看似精确的假统计。
     */
    return {
      checkinCount: "--",
      checkoutCount: "--",
      totalCheckedIn: "--"
    };
  }

  const checkinCount = codeSession?.checkin_count ?? 0;
  const checkoutCount = codeSession?.checkout_count ?? 0;
  return {
    checkinCount,
    checkoutCount,
    totalCheckedIn: checkinCount + checkoutCount
  };
}

function resolveCountdownTimeMsFromClientBaseline(
  codeSession: CodeSessionResponse | null,
  receivedAtMs: number
) {
  if (!codeSession) {
    return 0;
  }

  const serverTimeMs = codeSession.server_time_ms
    ?? (typeof codeSession.expires_in_ms === "number"
      ? codeSession.expires_at - codeSession.expires_in_ms
      : receivedAtMs);
  const elapsedClientMs = Math.max(0, Date.now() - receivedAtMs);
  return Math.max(0, codeSession.expires_at - serverTimeMs - elapsedClientMs);
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
  const autoRefreshStateRef = useRef<{ attemptCount: number; key: string }>({
    attemptCount: 0,
    key: ""
  });
  const countdownBaselineRef = useRef<{ key: string; receivedAtMs: number } | null>(null);
  const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);
  // 动作标签和当前 tab 绑定，确保首屏还没拿到码时也能给管理员稳定的语义提示。
  const actionLabel = actionType === "checkout" ? "当前签退码" : "当前签到码";
  const heroMetaLoading = loading || (!!codeSession && !displayedCodeSession);
  const heroDisplayCode = displayedCodeSession?.code ?? "------";
  const refreshKey = displayedCodeSession
    ? `${displayedCodeSession.activity_id}:${displayedCodeSession.action_type}:${displayedCodeSession.expires_at}`
    : "";
  if (displayedCodeSession && countdownBaselineRef.current?.key !== refreshKey) {
    // 每轮新动态码只记录一次“到达客户端的本地时间”，
    // 后续重渲染必须沿用同一基线，不能把倒计时重新算回初始剩余值。
    countdownBaselineRef.current = {
      key: refreshKey,
      receivedAtMs: Date.now()
    };
  }
  if (!displayedCodeSession) {
    countdownBaselineRef.current = null;
  }
  const countdownTimeMs = heroMetaLoading
    ? 0
    : resolveCountdownTimeMsFromClientBaseline(
      displayedCodeSession,
      countdownBaselineRef.current?.receivedAtMs ?? Date.now()
    );

  const tryTriggerAutoRefresh = useCallback((_reason: "expired-response" | "timer-finished") => {
    if (!displayedCodeSession || heroMetaLoading || !refreshKey) {
      return false;
    }

    if (autoRefreshStateRef.current.key !== refreshKey) {
      autoRefreshStateRef.current = {
        attemptCount: 0,
        key: refreshKey
      };
    }

    /**
     * 同一轮动态码最多允许自动补刷两次：
     * 1. 正常倒计时走到 0 触发的第一次刷新；
     * 2. 如果第一次刷新回来的仍是这轮过期会话，再补一次兜底刷新。
     *
     * 再往后继续拿到同一轮 key，基本就说明后端或网络真的卡住了，
     * 此时宁可停下来等待用户主动刷新，也不能把页面推入无限刷新环。
     */
    if (autoRefreshStateRef.current.attemptCount >= 2) {
      return false;
    }

    autoRefreshStateRef.current.attemptCount += 1;
    onRefresh();
    return true;
  }, [displayedCodeSession, heroMetaLoading, onRefresh, refreshKey]);

  useEffect(() => {
    /**
     * TDesign CountDown 只会在“内部从正数 tick 到 <= 0”时触发 `onFinish`。
     * 如果接口返回时这轮 code-session 已经过期，组件首帧只会看到 `00`，
     * 因此前端需要主动补一次刷新，把“首帧即过期”的缺口收口在面板内部。
     *
     * 这里继续沿用 refreshKey 去重：
     * - 同一轮过期动态码只允许补刷一次，避免后端继续回旧会话时进入刷新环；
     * - 新一轮动态码拿到新的 refreshKey 后，仍然可以再次正常自动刷新。
     */
    if (!displayedCodeSession || heroMetaLoading || countdownTimeMs > 0) {
      return;
    }
    tryTriggerAutoRefresh("expired-response");
  }, [countdownTimeMs, displayedCodeSession, heroMetaLoading, tryTriggerAutoRefresh]);

  function handleCountdownFinish() {
    /**
     * 这里改成直接吃 TDesign `CountDown.onFinish`：
     * 1. 刷新时机与组件库显示生命周期保持一致；
     * 2. 不再在父层再手写一套 `setTimeout`；
     * 3. 和“首帧即过期”的兜底共用同一份 refreshKey 去重，避免同一轮动态码被重复刷新。
     */
    if (!displayedCodeSession || heroMetaLoading) {
      return;
    }
    tryTriggerAutoRefresh("timer-finished");
  }

  /**
   * 动态码工作台改成项目自有 bento rail：
   * - 控制区、主码区、统计区、刷新条按固定顺序下排；
   * - 只把交互控件继续交给组件库；
   * - 不再让 `Row / Col / CellGroup` 决定管理页结构。
   */
  return (
    <section className="staff-panel" data-panel-tone="staff">
      <div className="staff-panel__rail">
        {/* tab 继续放在最前面，值班老师切签到/签退时不需要先跨过大块统计。 */}
        <section className="staff-panel__controls" data-display-zone="controls">
          <Tabs className="staff-panel__tabs" onChange={(value) => onActionChange(value as ActivityActionType)} value={actionType}>
            <TabPanel label="签到码" value="checkin" />
            <TabPanel label="签退码" value="checkout" />
          </Tabs>
        </section>
        <section className="staff-panel__hero" data-display-zone="hero">
          <DynamicCodeHero
            actionLabel={actionLabel}
            actionType={actionType}
            countdownTimeMs={countdownTimeMs}
            codeText={heroDisplayCode}
            loadingMetaText={heroMetaLoading ? "动态码加载中..." : undefined}
            onCountdownFinish={handleCountdownFinish}
            showSkeleton={loading}
          />
        </section>
        <section className="staff-panel__stats-strip" data-display-zone="stats">
          <header className="staff-panel__stats-header">
            <p className="staff-panel__section-eyebrow">实时统计</p>
            <p className="staff-panel__section-copy">这里会同步显示当前活动的签到与签退人数。</p>
          </header>
          <div className="staff-panel__metric-grid">
            {/* 这里明确展示累计签到，避免把“已签退成员”从签到统计里误剔除。 */}
            <section className="staff-panel__metric-card">
              <p className="staff-panel__metric-label">累计签到</p>
              <p className="staff-panel__metric-value">{totalCheckedIn}</p>
            </section>
            <section className="staff-panel__metric-card">
              <p className="staff-panel__metric-label">已签退</p>
              <p className="staff-panel__metric-value">{checkoutCount}</p>
            </section>
            <section className="staff-panel__metric-card">
              <p className="staff-panel__metric-label">未签退</p>
              <p className="staff-panel__metric-value">{checkinCount}</p>
            </section>
          </div>
        </section>
        <section className="staff-panel__action-bar" data-display-zone="actions">
          <div className="staff-panel__action-copy">
            <p className="staff-panel__section-eyebrow">刷新动态码</p>
            <p className="staff-panel__section-copy">如需获取最新验证码或人数变化，可手动刷新。</p>
          </div>
          <AppButton onClick={onRefresh} tone="secondary">
            立即刷新
          </AppButton>
        </section>
      </div>
    </section>
  );
}
