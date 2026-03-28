import { useRef } from "react";
import { Cell, CellGroup, Col, Row, TabPanel, Tabs } from "tdesign-mobile-react";
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
  const lastFinishedRefreshKeyRef = useRef("");
  const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);
  // 动作标签和当前 tab 绑定，确保首屏还没拿到码时也能给管理员稳定的语义提示。
  const actionLabel = actionType === "checkout" ? "当前签退码" : "当前签到码";
  const heroMetaLoading = loading || (!!codeSession && !displayedCodeSession);
  const heroDisplayCode = displayedCodeSession?.code ?? "------";
  const countdownTimeMs = heroMetaLoading ? 0 : resolveCountdownTimeMs(displayedCodeSession);
  const refreshKey = displayedCodeSession
    ? `${displayedCodeSession.activity_id}:${displayedCodeSession.action_type}:${displayedCodeSession.expires_at}`
    : "";

  function handleCountdownFinish() {
    /**
     * 这里改成直接吃 TDesign `CountDown.onFinish`：
     * 1. 刷新时机与组件库显示生命周期保持一致；
     * 2. 不再在父层再手写一套 `setTimeout`；
     * 3. 仍保留 refreshKey 去重，避免同一轮动态码被重复刷新。
     */
    if (!displayedCodeSession || heroMetaLoading) {
      return;
    }
    if (lastFinishedRefreshKeyRef.current === refreshKey) {
      return;
    };
    lastFinishedRefreshKeyRef.current = refreshKey;
    onRefresh();
  }

  return (
    <section className="staff-panel" data-panel-tone="staff">
      <Row className="staff-panel__layout" gutter={16}>
        {/* 管理页首先面向手机值班场景，默认先全部走单列，桌面再由 CSS 做增强重排。 */}
        <Col className="staff-panel__col staff-panel__controls-col" span={24}>
          <section className="staff-panel__controls" data-display-zone="controls">
            <Tabs className="staff-panel__tabs" onChange={(value) => onActionChange(value as ActivityActionType)} value={actionType}>
              <TabPanel label="签到码" value="checkin" />
              <TabPanel label="签退码" value="checkout" />
            </Tabs>
          </section>
        </Col>
        <Col className="staff-panel__col staff-code-panel__col" span={24}>
          <section className="staff-code-panel" data-display-zone="hero">
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
        </Col>
        <Col className="staff-panel__col staff-panel__stats-col" span={24}>
          <section className="staff-panel__stats" data-display-zone="stats">
            <CellGroup className="staff-panel__stats-group" theme="card" title="实时统计">
              <Cell note={`${totalCheckedIn}`} title="签到人数" />
              <Cell note={`${checkoutCount}`} title="签退人数" />
              <Cell note={`${checkinCount}`} title="未签退人数" />
            </CellGroup>
          </section>
        </Col>
        <Col className="staff-panel__col staff-panel__actions-col" span={24}>
          <section className="staff-panel__actions" data-display-zone="actions">
            <AppButton onClick={onRefresh} tone="secondary">
              立即刷新
            </AppButton>
          </section>
        </Col>
      </Row>
    </section>
  );
}
