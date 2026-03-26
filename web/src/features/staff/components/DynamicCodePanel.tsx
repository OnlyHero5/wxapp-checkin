import { useEffect, useRef, useState } from "react";
import { Badge, Cell, CellGroup, Grid, GridItem, Skeleton, TabPanel, Tabs } from "tdesign-mobile-react";
import type { ActivityActionType } from "../../activities/api";
import type { CodeSessionResponse } from "../api";
import { AppButton } from "../../../shared/ui/AppButton";

type DynamicCodePanelProps = {
  activityId: string;
  actionType: ActivityActionType;
  codeSession: CodeSessionResponse | null;
  loading?: boolean;
  onActionChange: (value: ActivityActionType) => void;
  onRefresh: () => void;
};

function formatRemainingSeconds(expiresInMs?: number) {
  if (!expiresInMs || expiresInMs <= 0) {
    return "0 秒";
  }
  return `${Math.ceil(expiresInMs / 1000)} 秒`;
}

function resolveRemainingMs(codeSession: CodeSessionResponse | null) {
  if (!codeSession) {
    return 0;
  }

  return Math.max(0, codeSession.expires_in_ms ?? 0);
}

function resolveActionBadgeColor(actionType: ActivityActionType) {
  return actionType === "checkout" ? "rgba(217, 119, 6, 0.92)" : "rgba(15, 159, 140, 0.92)";
}

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

type DynamicCodeHeroProps = {
  actionLabel: string;
  actionType: ActivityActionType;
  codeText: string;
  metaText: string;
  showSkeleton: boolean;
};

/**
 * 大码展示区继续保留“业务大字 + 倒计时”的重点，但 surface、角标和占位态都交给组件库组件。
 *
 * 这样做的边界很明确：
 * 1. `Badge` 负责动作语义，不再手写漂浮标签；
 * 2. `CellGroup` 负责卡片 surface；
 * 3. `Grid/GridItem` 负责大字与辅助信息的纵向排布；
 * 4. `Skeleton` 只在真实 loading 时接管展示，避免旧码和新码切换时闪旧内容。
 */
function DynamicCodeHero({
  actionLabel,
  actionType,
  codeText,
  metaText,
  showSkeleton
}: DynamicCodeHeroProps) {
  return (
    <CellGroup className="staff-code-panel__hero-group" theme="card">
      <Badge
        className="staff-code-panel__badge"
        color={resolveActionBadgeColor(actionType)}
        count={actionLabel}
        shape="ribbon-left"
        size="large"
      >
        <Grid align="center" className="staff-code-panel__display-grid" column={1} gutter={12}>
          <GridItem
            description={<p className="staff-code-panel__meta">{metaText}</p>}
            text={
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
            }
          />
        </Grid>
      </Badge>
    </CellGroup>
  );
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
  const [remainingMs, setRemainingMs] = useState(() => resolveRemainingMs(displayedCodeSession));
  const lastAutoRefreshKeyRef = useRef("");
  const onRefreshRef = useRef(onRefresh);
  const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);
  // 动作标签和当前 tab 绑定，确保首屏还没拿到码时也能给管理员稳定的语义提示。
  const actionLabel = actionType === "checkout" ? "当前签退码" : "当前签到码";
  const heroMetaLoading = loading || (!!codeSession && !displayedCodeSession);
  const heroDisplayCode = displayedCodeSession?.code ?? "------";
  const heroMetaText = heroMetaLoading ? "动态码加载中..." : `剩余时间：${formatRemainingSeconds(remainingMs)}`;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!displayedCodeSession) {
      setRemainingMs(0);
      return;
    }
    const nextCodeSession = displayedCodeSession;

    const receivedAtMs = Date.now();
    const serverTimeMs = nextCodeSession.server_time_ms ?? receivedAtMs;
    const serverOffsetMs = serverTimeMs - receivedAtMs;

    function measureRemainingMs() {
      return Math.max(0, nextCodeSession.expires_at - (Date.now() + serverOffsetMs));
    }

    setRemainingMs(measureRemainingMs());

    const countdownTimer = window.setInterval(() => {
      setRemainingMs(measureRemainingMs());
    }, 250);
    const refreshKey = `${nextCodeSession.activity_id}:${nextCodeSession.action_type}:${nextCodeSession.expires_at}`;
    const autoRefreshTimer = window.setTimeout(() => {
      if (lastAutoRefreshKeyRef.current === refreshKey) {
        return;
      }
      lastAutoRefreshKeyRef.current = refreshKey;
      onRefreshRef.current();
    }, Math.max(0, measureRemainingMs()) + 50);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(autoRefreshTimer);
    };
  }, [displayedCodeSession]);

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
          codeText={heroDisplayCode}
          metaText={heroMetaText}
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
