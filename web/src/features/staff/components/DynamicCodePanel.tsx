import { useEffect, useRef, useState } from "react";
import { Cell, CellGroup, TabPanel, Tabs } from "tdesign-mobile-react";
import type { ActivityActionType } from "../../activities/api";
import type { CodeSessionResponse } from "../api";
import { AppButton } from "../../../shared/ui/AppButton";

type DynamicCodePanelProps = {
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

/**
 * 动态码面板只负责“当前码长什么样、切哪个动作、剩多久”，
 * 不在这一层直接耦合批量签退或页面级错误处理。
 */
export function DynamicCodePanel({
  actionType,
  codeSession,
  loading = false,
  onActionChange,
  onRefresh
}: DynamicCodePanelProps) {
  const [remainingMs, setRemainingMs] = useState(() => resolveRemainingMs(codeSession));
  const lastAutoRefreshKeyRef = useRef("");
  const onRefreshRef = useRef(onRefresh);
  const { checkinCount, checkoutCount, totalCheckedIn } = resolveAttendanceCounts(codeSession);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!codeSession) {
      setRemainingMs(0);
      return;
    }
    const nextCodeSession = codeSession;

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
  }, [codeSession]);

  return (
    <section className="staff-panel" data-panel-tone="staff">
      {/* Tabs 继续走组件库能力，避免页面自己拼“选中态按钮组”。 */}
      <Tabs onChange={(value) => onActionChange(value as ActivityActionType)} value={actionType}>
        <TabPanel label="签到码" value="checkin" />
        <TabPanel label="签退码" value="checkout" />
      </Tabs>
      <div className="staff-code-panel">
        <div className="staff-code-panel__glass">
          {/* 大号六码是管理页的视觉焦点，因此刻意和普通文本分层。 */}
          <p className="staff-code-panel__value">{codeSession?.code ?? "------"}</p>
          <p className="staff-code-panel__meta">
            {loading ? "动态码加载中..." : `剩余时间：${formatRemainingSeconds(remainingMs)}`}
          </p>
        </div>
      </div>
      <CellGroup theme="card" title="实时统计">
        <Cell note={`${totalCheckedIn}`} title="签到人数" />
        <Cell note={`${checkoutCount}`} title="签退人数" />
        <Cell note={`${checkinCount}`} title="未签退人数" />
      </CellGroup>
      <AppButton accentTone="staff" onClick={onRefresh} tone="secondary">
        立即刷新
      </AppButton>
    </section>
  );
}
